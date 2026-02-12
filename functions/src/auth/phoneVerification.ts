/**
 * 전화번호 인증 Cloud Functions
 *
 * 기능:
 * - 전화번호 인증 코드 발송 (SMS)
 * - 인증 코드 확인
 * - 중복 전화번호 방지
 *
 * 주의:
 * - 실제 SMS 발송을 위해서는 Twilio, AWS SNS 등의 외부 서비스가 필요합니다.
 * - 현재는 로깅만 구현되어 있으며, 실제 SMS 발송 코드는 TODO로 표시되어 있습니다.
 */

import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  requireAuth,
  requireString,
} from '../errors/validators';
import {
  ValidationError,
  NotFoundError,
  BusinessError,
  ERROR_CODES,
} from '../errors/AppError';
import { handleFunctionError } from '../errors/errorHandler';

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * 6자리 인증 코드 생성
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 전화번호 형식 검증 (한국 번호)
 */
function validatePhoneNumber(phoneNumber: string): boolean {
  // 한국 전화번호 형식: 010-1234-5678, 01012345678, +821012345678
  const regex = /^(\+82|0)10[0-9]{8}$/;
  const cleanNumber = phoneNumber.replace(/-/g, '');
  return regex.test(cleanNumber);
}

/**
 * 전화번호 정규화 (+8210... 형식)
 */
function normalizePhoneNumber(phoneNumber: string): string {
  let clean = phoneNumber.replace(/-/g, '');

  // 010으로 시작하면 +8210으로 변환
  if (clean.startsWith('010')) {
    clean = '+82' + clean.substring(1);
  }

  // 이미 +82로 시작하면 그대로 반환
  if (clean.startsWith('+82')) {
    return clean;
  }

  return clean;
}

/**
 * 인증 코드 발송
 */
export const sendPhoneVerificationCode = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
      // 1. 인증 확인
      const userId = requireAuth(request);

      // 2. 전화번호 검증
      const phoneNumber = requireString(request.data.phoneNumber, '전화번호');

      if (!validatePhoneNumber(phoneNumber)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)',
          field: 'phoneNumber',
        });
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      // 3. 중복 전화번호 확인
      const existingPhone = await db
        .collection('userVerifications')
        .where('phoneNumber', '==', normalizedPhone)
        .where('phoneVerified', '==', true)
        .get();

      if (!existingPhone.empty) {
        const existingUserId = existingPhone.docs[0]?.data()?.userId;
        if (existingUserId !== userId) {
          throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
            userMessage: '이미 사용 중인 전화번호입니다.',
            metadata: { phoneNumber: normalizedPhone },
          });
        }
      }

      // 4. 최근 발송 확인 (1분 쿨다운)
      const recentVerifications = await db
        .collection('phoneVerifications')
        .where('userId', '==', userId)
        .where('phoneNumber', '==', normalizedPhone)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!recentVerifications.empty) {
        const lastVerification = recentVerifications.docs[0]?.data();
        if (lastVerification) {
          const lastCreated = lastVerification.createdAt?.toDate();
          const now = new Date();
          const diffMinutes = (now.getTime() - lastCreated.getTime()) / 1000 / 60;

          if (diffMinutes < 1) {
            throw new BusinessError(ERROR_CODES.AUTH_RATE_LIMITED, {
              userMessage: '1분 후에 다시 시도해주세요.',
              metadata: { remainingSeconds: Math.ceil((1 - diffMinutes) * 60) },
            });
          }
        }
      }

      // 5. 인증 코드 생성
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

      // 6. Firestore에 인증 기록 저장
      const verificationRef = db.collection('phoneVerifications').doc();
      await verificationRef.set({
        userId,
        phoneNumber: normalizedPhone,
        verificationCode,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 7. SMS 발송 (실제 구현 필요)
      logger.info('인증 코드 발송 준비', {
        userId,
        phoneNumber: normalizedPhone,
        code: verificationCode, // 개발 환경에서만 로그
      });

      // TODO: 실제 SMS 발송 구현
      // await sendSMS(normalizedPhone, `T-HOLDEM 인증 코드: ${verificationCode}`);

      logger.info('인증 코드 발송 완료', { userId, phoneNumber: normalizedPhone });

      return {
        success: true,
        message: '인증 코드가 발송되었습니다.',
        expiresIn: 300, // 5분 (초 단위)
        // 개발 환경에서만 코드 반환 (프로덕션에서는 제거)
        ...(process.env.NODE_ENV === 'development' && { code: verificationCode }),
      };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: 'sendPhoneVerificationCode',
        context: { phoneNumber: request.data?.phoneNumber },
      });
    }
  });

/**
 * 인증 코드 확인
 */
export const verifyPhoneCode = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
      // 1. 인증 확인
      const userId = requireAuth(request);

      // 2. 입력값 검증
      const phoneNumber = requireString(request.data.phoneNumber, '전화번호');
      const code = requireString(request.data.code, '인증 코드');

      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      // 3. 인증 기록 조회
      const verificationSnapshot = await db
        .collection('phoneVerifications')
        .where('userId', '==', userId)
        .where('phoneNumber', '==', normalizedPhone)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (verificationSnapshot.empty) {
        throw new NotFoundError({
          userMessage: '인증 요청을 찾을 수 없습니다. 인증 코드를 다시 요청해주세요.',
        });
      }

      const verificationDoc = verificationSnapshot.docs[0];
      if (!verificationDoc) {
        throw new NotFoundError({
          userMessage: '인증 요청을 찾을 수 없습니다.',
        });
      }

      const verification = verificationDoc.data();

      // 4. 만료 확인
      const now = new Date();
      const expiresAt = verification.expiresAt.toDate();

      if (now > expiresAt) {
        await verificationDoc.ref.update({
          status: 'expired',
          updatedAt: FieldValue.serverTimestamp(),
        });

        throw new BusinessError(ERROR_CODES.AUTH_TOKEN_EXPIRED, {
          userMessage: '인증 코드가 만료되었습니다. 다시 요청해주세요.',
        });
      }

      // 5. 시도 횟수 확인
      if (verification.attempts >= verification.maxAttempts) {
        await verificationDoc.ref.update({
          status: 'failed',
          updatedAt: FieldValue.serverTimestamp(),
        });

        throw new BusinessError(ERROR_CODES.AUTH_TOO_MANY_REQUESTS, {
          userMessage: '인증 시도 횟수를 초과했습니다. 인증 코드를 다시 요청해주세요.',
        });
      }

      // 6. 인증 코드 확인
      if (verification.verificationCode !== code) {
        await verificationDoc.ref.update({
          attempts: verification.attempts + 1,
          updatedAt: FieldValue.serverTimestamp(),
        });

        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: `인증 코드가 일치하지 않습니다. (${verification.maxAttempts - verification.attempts - 1}회 남음)`,
          field: 'code',
        });
      }

      // 7. 인증 성공 처리
      await db.runTransaction(async (transaction) => {
        // 인증 기록 업데이트
        transaction.update(verificationDoc.ref, {
          status: 'verified',
          verifiedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // 사용자 인증 상태 업데이트
        const userVerificationRef = db.collection('userVerifications').doc(userId);
        const userVerification = await transaction.get(userVerificationRef);

        if (!userVerification.exists) {
          transaction.set(userVerificationRef, {
            userId,
            emailVerified: request.auth?.token.email_verified || false,
            phoneVerified: true,
            phoneNumber: normalizedPhone,
            verifiedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          transaction.update(userVerificationRef, {
            phoneVerified: true,
            phoneNumber: normalizedPhone,
            verifiedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // 사용자 문서에도 전화번호 업데이트
        const userRef = db.collection('users').doc(userId);
        transaction.update(userRef, {
          phone: normalizedPhone,
          phoneVerified: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      logger.info('전화번호 인증 완료', { userId, phoneNumber: normalizedPhone });

      return {
        success: true,
        message: '전화번호 인증이 완료되었습니다.',
        phoneNumber: normalizedPhone,
      };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: 'verifyPhoneCode',
        context: { phoneNumber: request.data?.phoneNumber },
      });
    }
  });

/**
 * 인증 상태 조회
 */
export const getVerificationStatus = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
      // 1. 인증 확인
      const userId = requireAuth(request);

      // 2. 인증 상태 조회
      const userVerificationDoc = await db
        .collection('userVerifications')
        .doc(userId)
        .get();

      if (!userVerificationDoc.exists) {
        return {
          userId,
          emailVerified: request.auth!.token.email_verified || false,
          phoneVerified: false,
          phoneNumber: null,
        };
      }

      const verificationData = userVerificationDoc.data();

      return {
        userId,
        emailVerified: verificationData?.emailVerified || false,
        phoneVerified: verificationData?.phoneVerified || false,
        phoneNumber: verificationData?.phoneNumber || null,
        verifiedAt: verificationData?.verifiedAt || null,
      };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: 'getVerificationStatus',
        context: { userId: request.auth?.uid },
      });
    }
  });
