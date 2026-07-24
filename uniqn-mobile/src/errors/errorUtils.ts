/**
 * UNIQN Mobile - 에러 유틸리티
 *
 * @description 에러 처리를 위한 유틸리티 함수들
 * @version 1.0.0
 */

import { AppError, NetworkError, ERROR_CODES, ERROR_MESSAGES, isAppError } from './AppError';

// ============================================================================
// Error Type Conversion (Lightweight)
// ============================================================================

/**
 * unknown 타입을 안전하게 Error로 변환 (로깅용)
 *
 * @description logger.error()에서 사용. normalizeError()보다 가볍고
 * Error 타입만 필요한 경우에 적합
 *
 * @example
 * try {
 *   await someOperation();
 * } catch (error) {
 *   logger.error('작업 실패', toError(error), { context });
 * }
 */
export function toError(error: unknown): Error {
  // 이미 Error 인스턴스인 경우
  if (error instanceof Error) {
    return error;
  }

  // AppError인 경우 (Error를 상속하므로 위에서 처리되지만 명시적으로)
  if (isAppError(error)) {
    return error;
  }

  // 문자열 에러
  if (typeof error === 'string') {
    return new Error(error);
  }

  // 객체에 message 필드가 있는 경우
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const err = new Error((error as { message: string }).message);
    // code가 있으면 추가
    if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
      (err as Error & { code?: string }).code = (error as { code: string }).code;
    }
    return err;
  }

  // null/undefined
  if (error === null || error === undefined) {
    return new Error('Unknown error occurred');
  }

  // 그 외 모든 경우
  return new Error(String(error));
}

/**
 * unknown 에러에서 에러 코드 추출
 *
 * @description Firebase 에러 등에서 코드를 안전하게 추출
 */
export function getErrorCode(error: unknown): string | undefined {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

/**
 * unknown 에러에서 메시지 추출
 *
 * @description 로깅 컨텍스트에 에러 정보를 포함할 때 사용
 */
export function getErrorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

// ============================================================================
// Error Normalization
// ============================================================================

/** 네트워크 장애로 분류할 메시지 패턴 (normalizeError · handleSupabaseError 공용) */
const NETWORK_MESSAGE_PATTERNS = [
  'network',
  'timeout',
  'offline',
  'connection',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
];

/**
 * 에러 메시지가 네트워크 장애 패턴인지 판별
 *
 * @description fetch 단절이 PostgrestError 형태(code='')로 전파되면 UNKNOWN(E7000)으로
 * 오분류된다 (Sentry UNIQN-MOBILE-1M). Supabase 에러 매핑 경로에서도 공용으로 사용.
 */
export function isNetworkErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return NETWORK_MESSAGE_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()));
}

/**
 * message 없는 객체를 안전하게 직렬화 (순환 참조 방어, 300자 제한)
 */
function safeStringifyError(error: object): string {
  try {
    const json = JSON.stringify(error);
    if (json && json !== '{}') {
      return json.slice(0, 300);
    }
  } catch {
    // 순환 참조 등 직렬화 불가 — String() 폴백
  }
  return String(error);
}

/**
 * 모든 종류의 에러를 AppError로 정규화
 */
export function normalizeError(error: unknown): AppError {
  // 이미 AppError인 경우
  if (isAppError(error)) {
    return error;
  }

  // 네트워크 에러 (fetch, axios 등)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new NetworkError(ERROR_CODES.NETWORK_OFFLINE, {
      message: error.message,
      originalError: error,
    });
  }

  // 일반 Error 객체
  if (error instanceof Error) {
    if (isNetworkErrorMessage(error.message)) {
      return new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        message: error.message,
        originalError: error,
      });
    }

    return new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      message: error.message,
      originalError: error,
    });
  }

  // 문자열 에러
  if (typeof error === 'string') {
    return new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      message: error,
    });
  }

  // message/code를 가진 객체 (Supabase 에러 등 Error 미상속 throw) —
  // String()은 "[object Object]"로 원인을 소실시킨다 (Sentry UNIQN-MOBILE-1K)
  if (error !== null && typeof error === 'object') {
    const extracted = getErrorMessageFromUnknown(error);
    const message = extracted === '[object Object]' ? safeStringifyError(error) : extracted;
    const originalCode = getErrorCode(error);
    const metadata = originalCode ? { originalCode } : undefined;

    if (isNetworkErrorMessage(message)) {
      return new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, { message, metadata });
    }

    return new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      message,
      metadata,
    });
  }

  // 그 외 원시값 (number/boolean 등)
  return new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'unknown',
    message: String(error),
  });
}

// ============================================================================
// Error Wrapper Functions
// ============================================================================

/**
 * 비동기 함수를 에러 처리로 래핑
 * @param fn 래핑할 비동기 함수
 * @param context 에러 로깅용 컨텍스트
 */
export function withErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  context?: { component?: string; operation?: string }
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = normalizeError(error);

      // 에러 메타데이터에 컨텍스트 추가
      if (context) {
        (appError as AppError & { metadata: Record<string, unknown> }).metadata = {
          ...appError.metadata,
          ...context,
        };
      }

      // 여기서 로깅을 수행할 수 있음
      // logger.error(appError.message, appError, context);

      throw appError;
    }
  };
}

/**
 * 동기 함수를 에러 처리로 래핑
 */
export function withSyncErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => T,
  context?: { component?: string; operation?: string }
): (...args: Args) => T {
  return (...args: Args): T => {
    try {
      return fn(...args);
    } catch (error) {
      const appError = normalizeError(error);

      if (context) {
        (appError as AppError & { metadata: Record<string, unknown> }).metadata = {
          ...appError.metadata,
          ...context,
        };
      }

      throw appError;
    }
  };
}

// ============================================================================
// Error Result Pattern
// ============================================================================

/**
 * Result 타입 (에러 핸들링용)
 */
export type Result<T, E = AppError> = { success: true; data: T } | { success: false; error: E };

/**
 * 비동기 함수를 Result 패턴으로 래핑
 * 에러를 throw하지 않고 Result 객체로 반환
 */
export async function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}

/**
 * 동기 함수를 Result 패턴으로 래핑
 */
export function tryCatchSync<T>(fn: () => T): Result<T> {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}

// ============================================================================
// Error Message Utilities
// ============================================================================

/**
 * 에러 코드로 사용자 친화적 메시지 가져오기
 */
export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN];
}

/**
 * 에러에서 사용자에게 보여줄 메시지 추출
 */
export function extractUserMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    // 개발자 메시지는 숨기고 일반 메시지 반환
    return ERROR_MESSAGES[ERROR_CODES.UNKNOWN];
  }

  return ERROR_MESSAGES[ERROR_CODES.UNKNOWN];
}

// ============================================================================
// Error Retry Utilities
// ============================================================================

/**
 * 재시도 가능한 에러인지 판별
 * 네트워크, Firebase unavailable, rate limit 에러는 재시도 가능
 */
export function isRetryableError(error: unknown): boolean {
  const appError = normalizeError(error);

  // 명시적으로 재시도 가능 표시된 에러
  if (appError.isRetryable) return true;

  // 네트워크 에러
  if (appError.category === 'network') return true;

  // 재시도 가능한 에러 코드들
  const retryableCodes = [
    ERROR_CODES.NETWORK_OFFLINE,
    ERROR_CODES.NETWORK_TIMEOUT,
    ERROR_CODES.NETWORK_SERVER_UNREACHABLE,
    ERROR_CODES.NETWORK_REQUEST_FAILED,
    ERROR_CODES.INFRA_UNAVAILABLE,
    ERROR_CODES.SECURITY_RATE_LIMIT,
    ERROR_CODES.AUTH_TOO_MANY_REQUESTS,
  ];

  return retryableCodes.includes(appError.code as (typeof retryableCodes)[number]);
}

// ============================================================================
// Error Boundary Helpers
// ============================================================================

/**
 * 에러가 복구 가능한지 확인
 */
export function isRecoverableError(error: unknown): boolean {
  if (isAppError(error)) {
    // 네트워크 에러나 재시도 가능한 에러는 복구 가능
    return error.isRetryable || error.category === 'network';
  }
  return false;
}

/**
 * 에러가 인증 관련인지 확인 (로그아웃 필요 여부 판단)
 */
export function requiresReauthentication(error: unknown): boolean {
  if (isAppError(error)) {
    const authCodes = [
      ERROR_CODES.AUTH_TOKEN_EXPIRED,
      ERROR_CODES.AUTH_SESSION_EXPIRED,
      ERROR_CODES.AUTH_REQUIRES_RECENT_LOGIN,
    ];
    return authCodes.includes(error.code as (typeof authCodes)[number]);
  }
  return false;
}

/**
 * 에러 심각도에 따른 처리 방법 결정
 */
export function getErrorAction(error: AppError): 'toast' | 'alert' | 'redirect' | 'crash' {
  switch (error.severity) {
    case 'low':
      return 'toast';
    case 'medium':
      return error.category === 'auth' ? 'redirect' : 'alert';
    case 'high':
      return 'alert';
    case 'critical':
      return 'crash';
    default:
      return 'toast';
  }
}
