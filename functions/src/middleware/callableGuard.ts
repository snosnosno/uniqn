/**
 * onCall 함수 공용 보안 미들웨어
 *
 * @description
 * Rate Limiting + reCAPTCHA v3 검증을 공통 래퍼로 추출하여
 * checkPhoneExists / checkEmailExists / checkNicknameExists 등의
 * 보일러플레이트 중복을 제거합니다.
 *
 * @version 1.0.0
 */

import type { CallableRequest } from "firebase-functions/v2/https";
import { ValidationError, ERROR_CODES } from "../errors/AppError";
import { handleFunctionError } from "../errors/errorHandler";
import { checkIpRateLimit } from "./rateLimiter";
import { verifyRecaptchaToken } from "../utils/recaptcha";

// ============================================================================
// Types
// ============================================================================

export interface CallableGuardOptions {
  /** 함수명 (에러 핸들링용) */
  operation: string;
  /** Rate Limit 설정 */
  rateLimit: {
    maxRequests: number;
    keyPrefix: string;
    /** 인증 사용자 최대 요청 수 (미지정 시 maxRequests와 동일) */
    authenticatedMaxRequests?: number;
  };
  /** reCAPTCHA 검증 활성화 (기본: true) */
  requireRecaptcha?: boolean;
  /** 에러 발생 시 로그에 포함할 컨텍스트 생성 함수 */
  errorContext?: (request: CallableRequest) => Record<string, unknown>;
}

// ============================================================================
// Guard
// ============================================================================

/**
 * Rate Limiting + reCAPTCHA 검증을 수행한 후 핸들러를 실행합니다.
 * 에러 발생 시 handleFunctionError로 래핑하여 throw합니다.
 *
 * @example
 * export const checkPhoneExists = onCall(
 *   { region: "asia-northeast3", cors: true },
 *   (request) => withCallableGuard(request, {
 *     operation: "checkPhoneExists",
 *     rateLimit: { maxRequests: 5, keyPrefix: "ratelimit:check-phone", authenticatedMaxRequests: 20 },
 *     errorContext: (req) => ({ phone: maskPhone(req.data?.phone) }),
 *   }, async (req) => {
 *     // 비즈니스 로직만 작성
 *   }),
 * );
 */
export async function withCallableGuard<T>(
  request: CallableRequest,
  options: CallableGuardOptions,
  handler: (request: CallableRequest) => Promise<T>,
): Promise<T> {
  const { operation, rateLimit, requireRecaptcha = true, errorContext } =
    options;

  try {
    // 1. IP 기반 Rate Limiting
    const clientIp = request.rawRequest?.ip || "unknown";
    const isAuthenticated = !!request.auth;
    const maxRequests =
      isAuthenticated && rateLimit.authenticatedMaxRequests
        ? rateLimit.authenticatedMaxRequests
        : rateLimit.maxRequests;

    const rateLimitResult = await checkIpRateLimit(clientIp, {
      windowMs: 60 * 1000,
      maxRequests,
      keyPrefix: rateLimit.keyPrefix,
    });

    if (!rateLimitResult.allowed) {
      throw new ValidationError(ERROR_CODES.AUTH_RATE_LIMITED, {
        userMessage: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
      });
    }

    // 2. reCAPTCHA v3 검증 (토큰이 있을 때만, 네이티브는 항상 스킵)
    // 웹에서 토큰 미제공 시: Rate Limiting으로 보호 (Phone Auth 흐름에서 RecaptchaVerifier와 충돌 방지)
    if (requireRecaptcha) {
      const recaptchaToken = request.data?.recaptchaToken as
        | string
        | undefined;

      if (recaptchaToken) {
        const isValid = await verifyRecaptchaToken(recaptchaToken);
        if (!isValid) {
          throw new ValidationError(ERROR_CODES.AUTH_CAPTCHA_FAILED, {
            userMessage: "보안 검증에 실패했습니다. 다시 시도해주세요.",
          });
        }
      }
    }

    // 3. 핸들러 실행
    return await handler(request);
  } catch (error) {
    throw handleFunctionError(error, {
      operation,
      context: errorContext ? errorContext(request) : {},
    });
  }
}
