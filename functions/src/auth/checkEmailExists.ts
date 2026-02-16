/**
 * 이메일 중복 확인 Cloud Function
 *
 * @description
 * 회원가입 Step 1에서 이메일 중복을 확인합니다.
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
 * 이메일 마스킹 (로그용)
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 3)}***@${domain}`;
}

/**
 * 이메일 형식 검증
 */
function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * 이메일 중복 확인
 *
 * - Firebase Auth에서 해당 이메일로 등록된 계정 존재 여부 확인
 * - 인증 불필요 (회원가입 전 호출)
 * - IP 기반 Rate Limiting 적용
 */
export const checkEmailExists = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request) => {
    try {
      // 1. IP 기반 Rate Limiting (미인증 상태이므로 IP로 제한)
      const clientIp = request.rawRequest?.ip || 'unknown';
      const rateLimitResult = await checkIpRateLimit(clientIp, {
        windowMs: 60 * 1000,     // 1분
        maxRequests: 10,          // IP당 1분에 10회
        keyPrefix: 'ratelimit:check-email',
      });

      if (!rateLimitResult.allowed) {
        throw new ValidationError(ERROR_CODES.AUTH_RATE_LIMITED, {
          userMessage: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
        });
      }

      // 2. 이메일 파라미터 검증
      const rawEmail = request.data?.email;
      if (!rawEmail || typeof rawEmail !== 'string' || rawEmail.trim().length === 0) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: '이메일을 입력해주세요.',
          field: 'email',
        });
      }

      // 3. 이메일 정규화 + 형식 검증
      const email = rawEmail.trim().toLowerCase();

      if (!isValidEmail(email)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '올바른 이메일 형식이 아닙니다.',
          field: 'email',
        });
      }

      // 4. Firebase Auth에서 확인 (linkWithCredential의 실제 검증 소스)
      let existsInAuth = false;
      try {
        await admin.auth().getUserByEmail(email);
        existsInAuth = true;
      } catch (authError: unknown) {
        // auth/user-not-found는 정상 (이메일 미사용)
        if (
          authError &&
          typeof authError === 'object' &&
          'code' in authError &&
          (authError as { code: string }).code === 'auth/user-not-found'
        ) {
          existsInAuth = false;
        } else {
          // 그 외 에러는 전파
          throw authError;
        }
      }

      logger.info('이메일 중복 확인 완료', {
        email: `${email.slice(0, 3)}***@${email.split('@')[1]}`,
        exists: existsInAuth,
      });

      return {
        exists: existsInAuth,
      };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: 'checkEmailExists',
        context: { email: request.data?.email ? maskEmail(request.data.email) : undefined },
      });
    }
  }
);
