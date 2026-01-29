/**
 * UNIQN Mobile - 에러 유틸리티
 *
 * @description 에러 처리를 위한 유틸리티 함수들
 * @version 1.0.0
 */

import {
  AppError,
  NetworkError,
  ERROR_CODES,
  ERROR_MESSAGES,
  isAppError,
} from './AppError';
import { mapFirebaseError, isFirebaseError } from './firebaseErrorMapper';

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

/**
 * 모든 종류의 에러를 AppError로 정규화
 */
export function normalizeError(error: unknown): AppError {
  // 이미 AppError인 경우
  if (isAppError(error)) {
    return error;
  }

  // Firebase 에러인 경우
  if (isFirebaseError(error)) {
    return mapFirebaseError(error);
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
    // 네트워크 관련 에러 메시지 패턴
    const networkPatterns = [
      'network',
      'timeout',
      'offline',
      'connection',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
    ];

    const isNetworkError = networkPatterns.some((pattern) =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isNetworkError) {
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

  // 그 외 모든 경우
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
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * 비동기 함수를 Result 패턴으로 래핑
 * 에러를 throw하지 않고 Result 객체로 반환
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
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

  if (isFirebaseError(error)) {
    const appError = mapFirebaseError(error);
    return appError.userMessage;
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
 * 재시도 옵션
 */
export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: AppError, attempt: number) => boolean;
  onRetry?: (error: AppError, attempt: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  shouldRetry: (error) => error.isRetryable,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onRetry: () => {}, // 기본값은 빈 함수 (옵션이 제공되면 덮어씀)
};

/**
 * 자동 재시도 로직이 포함된 비동기 함수 실행
 * - Exponential backoff (지수 백오프) 적용
 * - Jitter (지터) 추가로 서버 부하 분산
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = normalizeError(error);

      // 마지막 시도이거나 재시도 불가능한 에러면 throw
      if (attempt > opts.maxRetries || !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // 재시도 콜백
      opts.onRetry(lastError, attempt);

      // 지수 백오프 딜레이 + 지터 (서버 부하 분산)
      const baseDelay = opts.delayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
      const jitter = Math.random() * 0.3 * baseDelay; // 0~30% 랜덤 추가
      const delay = baseDelay + jitter;
      await sleep(delay);
    }
  }

  // 이론적으로 여기 도달하지 않지만, TypeScript를 위해
  throw lastError || new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'unknown',
  });
}

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
    ERROR_CODES.FIREBASE_UNAVAILABLE,
    ERROR_CODES.SECURITY_RATE_LIMIT,
    ERROR_CODES.AUTH_TOO_MANY_REQUESTS,
  ];

  return retryableCodes.includes(appError.code as typeof retryableCodes[number]);
}

/**
 * 지연 함수
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    return authCodes.includes(error.code as typeof authCodes[number]);
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
