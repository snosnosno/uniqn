/**
 * 전화번호 중복 확인 Cloud Function
 *
 * @description
 * 회원가입 Step 2에서 SMS 인증 발송 전 전화번호 중복을 확인합니다.
 * 인증 없이 호출 가능 (회원가입 전이므로).
 * Firebase Auth + Firestore 양쪽 모두 확인하여 정합성을 보장합니다.
 *
 * @version 1.0.0
 */

import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ValidationError, ERROR_CODES } from '../errors/AppError';
import { handleFunctionError } from '../errors/errorHandler';
import { checkIpRateLimit } from '../middleware/rateLimiter';

/**
 * 한국 전화번호 형식 검증 (E.164 또는 010 형식)
 */
function isValidKoreanPhone(phone: string): boolean {
  // E.164: +821012345678 또는 로컬: 01012345678
  const e164Regex = /^\+82[0-9]{9,10}$/;
  const localRegex = /^01[0-9]{8,9}$/;
  return e164Regex.test(phone) || localRegex.test(phone);
}

/**
 * 전화번호를 E.164 형식으로 변환
 */
function toE164(phone: string): string {
  const cleaned = phone.replace(/[-\s]/g, '');
  if (cleaned.startsWith('+82')) return cleaned;
  if (cleaned.startsWith('0')) return `+82${cleaned.slice(1)}`;
  return `+82${cleaned}`;
}

/**
 * 전화번호 마스킹 (로그용)
 */
function maskPhone(phone: string): string {
  if (phone.length < 4) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

/**
 * 전화번호 중복 확인
 *
 * - Firebase Auth에서 해당 전화번호로 등록된 계정 존재 여부 확인
 * - Firestore users 컬렉션에서 phone 필드 조회
 * - 인증 불필요 (회원가입 전 호출)
 * - IP 기반 Rate Limiting 적용
 */
export const checkPhoneExists = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request) => {
    try {
      // 1. IP 기반 Rate Limiting
      const clientIp = request.rawRequest?.ip || 'unknown';
      const rateLimitResult = await checkIpRateLimit(clientIp, {
        windowMs: 60 * 1000,     // 1분
        maxRequests: 10,          // IP당 1분에 10회
        keyPrefix: 'ratelimit:check-phone',
      });

      if (!rateLimitResult.allowed) {
        throw new ValidationError(ERROR_CODES.AUTH_RATE_LIMITED, {
          userMessage: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
        });
      }

      // 2. 전화번호 파라미터 검증
      const rawPhone = request.data?.phone;
      if (!rawPhone || typeof rawPhone !== 'string' || rawPhone.trim().length === 0) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '전화번호를 입력해주세요.',
          field: 'phone',
        });
      }

      // 3. 전화번호 정규화 + 형식 검증
      const cleaned = rawPhone.replace(/[-\s]/g, '');

      if (!isValidKoreanPhone(cleaned)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '올바른 전화번호 형식이 아닙니다.',
          field: 'phone',
        });
      }

      const e164Phone = toE164(cleaned);

      // 4. Firebase Auth에서 확인
      let existsInAuth = false;
      try {
        await admin.auth().getUserByPhoneNumber(e164Phone);
        existsInAuth = true;
      } catch (authError: unknown) {
        if (
          authError &&
          typeof authError === 'object' &&
          'code' in authError &&
          (authError as { code: string }).code === 'auth/user-not-found'
        ) {
          existsInAuth = false;
        } else {
          throw authError;
        }
      }

      // 5. Firestore에서도 확인 (Auth에 없지만 Firestore에만 있는 경우 대비)
      let existsInFirestore = false;
      if (!existsInAuth) {
        // 로컬 형식으로도 검색 (010-xxxx-xxxx)
        const localPhone = cleaned.startsWith('+82') ? `0${cleaned.slice(3)}` : cleaned;
        const formattedPhone = localPhone.length === 11
          ? `${localPhone.slice(0, 3)}-${localPhone.slice(3, 7)}-${localPhone.slice(7)}`
          : localPhone;

        const snapshot = await admin.firestore()
          .collection('users')
          .where('phone', 'in', [e164Phone, localPhone, formattedPhone])
          .limit(1)
          .get();

        existsInFirestore = !snapshot.empty;
      }

      const exists = existsInAuth || existsInFirestore;

      logger.info('전화번호 중복 확인 완료', {
        phone: maskPhone(e164Phone),
        exists,
        source: existsInAuth ? 'auth' : existsInFirestore ? 'firestore' : 'none',
      });

      return { exists };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: 'checkPhoneExists',
        context: { phone: request.data?.phone ? maskPhone(request.data.phone) : undefined },
      });
    }
  }
);
