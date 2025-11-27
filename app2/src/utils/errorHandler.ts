/**
 * 통합 에러 처리 유틸리티 (SSOT)
 *
 * 이 파일은 T-HOLDEM 프로젝트의 에러 처리 표준을 정의합니다.
 * 모든 에러 처리는 이 모듈의 함수들을 사용해야 합니다.
 *
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 *
 * 주요 함수:
 * - extractErrorMessage: unknown 에러에서 메시지 추출
 * - toError: unknown을 Error 객체로 변환
 * - handleError: 표준화된 에러 처리 (로깅 + 알림)
 * - withErrorHandler: 비동기 작업 에러 래퍼
 * - withRetry: 재시도 로직 포함 에러 처리
 *
 * 사용 예시:
 * ```typescript
 * // ✅ 권장 패턴 - handleError 사용
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   handleError(error, {
 *     component: 'MyComponent',
 *     action: 'riskyOperation',
 *     showAlert: true
 *   });
 * }
 *
 * // ✅ 권장 패턴 - withErrorHandler 사용
 * const result = await withErrorHandler(
 *   () => fetchData(),
 *   { component: 'DataService', action: 'fetchData' }
 * );
 *
 * // ✅ 권장 패턴 - withRetry 사용
 * const result = await withRetry(
 *   () => unstableApiCall(),
 *   { component: 'ApiService', maxRetries: 3 }
 * );
 * ```
 *
 * @see utils/firebaseErrors.ts - Firebase 전용 에러 처리
 * @see utils/logger.ts - 로깅 유틸리티
 */

import { logger } from './logger';
import { toast } from './toast';
import { handleFirebaseError as handleFirebaseErrorUtil, FirebaseError } from './firebaseErrors';

// =============================================================================
// Result 타입 정의 (Phase 5 에러 처리 표준화)
// =============================================================================

/**
 * 성공 결과 타입
 */
export interface SuccessResult<T> {
  success: true;
  data: T;
  error?: never;
}

/**
 * 실패 결과 타입
 */
export interface ErrorResult {
  success: false;
  data?: never;
  error: string;
  originalError?: unknown;
}

/**
 * Result 타입 - 성공 또는 실패를 명시적으로 나타냄
 *
 * @description
 * 비동기 작업의 결과를 안전하게 처리하기 위한 타입입니다.
 * null 대신 명시적인 성공/실패 구분을 제공합니다.
 *
 * @example
 * ```typescript
 * const result = await safeAsync(() => fetchData(), { component: 'MyComponent' });
 *
 * if (result.success) {
 *   // result.data는 타입 안전하게 사용 가능
 *   console.log(result.data);
 * } else {
 *   // result.error에서 에러 메시지 확인
 *   console.error(result.error);
 * }
 * ```
 */
export type Result<T> = SuccessResult<T> | ErrorResult;

/**
 * 성공 결과 생성 헬퍼
 */
export const success = <T>(data: T): SuccessResult<T> => ({
  success: true,
  data,
});

/**
 * 실패 결과 생성 헬퍼
 */
export const failure = (error: string, originalError?: unknown): ErrorResult => ({
  success: false,
  error,
  originalError,
});

/**
 * Result가 성공인지 확인하는 타입 가드
 */
export const isSuccess = <T>(result: Result<T>): result is SuccessResult<T> => {
  return result.success === true;
};

/**
 * Result가 실패인지 확인하는 타입 가드
 */
export const isFailure = <T>(result: Result<T>): result is ErrorResult => {
  return result.success === false;
};

/**
 * unknown 타입의 에러에서 안전하게 메시지를 추출합니다.
 *
 * @param error - 에러 객체 (unknown 타입)
 * @param fallbackMessage - 메시지 추출 실패 시 반환할 기본 메시지
 * @returns 에러 메시지 문자열
 *
 * @example
 * ```typescript
 * catch (error) {
 *   return { success: false, error: extractErrorMessage(error) };
 * }
 * ```
 */
export const extractErrorMessage = (
  error: unknown,
  fallbackMessage: string = '알 수 없는 오류가 발생했습니다.'
): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    // Firebase/Firestore 에러 등 code와 message가 있는 경우
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    // code만 있는 경우
    if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
      return `에러 코드: ${(error as { code: string }).code}`;
    }
  }
  return fallbackMessage;
};

/**
 * unknown 타입의 에러를 Error 객체로 안전하게 변환합니다.
 *
 * @param error - 에러 객체 (unknown 타입)
 * @returns Error 객체
 */
export const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(extractErrorMessage(error));
};

export interface ErrorHandlerOptions {
  component: string;
  action?: string;
  userId?: string;
  data?: any;
  showAlert?: boolean;
  fallbackMessage?: string;
}

/**
 * 표준화된 에러 처리 함수
 */
export const handleError = (error: unknown, options: ErrorHandlerOptions): string => {
  const { component, action, userId, data, showAlert = false, fallbackMessage } = options;

  // 에러 메시지 추출
  let errorMessage: string;
  let errorObject: Error;

  if (error instanceof Error) {
    errorMessage = error.message;
    errorObject = error;
  } else if (typeof error === 'string') {
    errorMessage = error;
    errorObject = new Error(error);
  } else {
    errorMessage = fallbackMessage || '알 수 없는 오류가 발생했습니다.';
    errorObject = new Error(errorMessage);
  }

  // 로깅
  const logContext: any = {
    component,
    data,
    errorDetails: {
      message: errorMessage,
      stack: errorObject.stack,
      name: errorObject.name,
    },
  };

  if (action) logContext.action = action;
  if (userId) logContext.userId = userId;

  logger.error(`[${component}] ${action || 'Error'}:`, errorObject, logContext);

  // 알림 표시 (옵션)
  if (showAlert && typeof window !== 'undefined') {
    toast.error(errorMessage);
  }

  return errorMessage;
};

/**
 * 비동기 작업을 위한 에러 래퍼
 */
export const withErrorHandler = async <T>(
  asyncFn: () => Promise<T>,
  options: ErrorHandlerOptions
): Promise<T | null> => {
  try {
    return await asyncFn();
  } catch (error) {
    handleError(error, options);
    return null;
  }
};

/**
 * React 컴포넌트용 에러 바운더리 헬퍼
 */
export class ErrorBoundaryHelper {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  static logComponentError(error: Error, errorInfo: any, componentName: string) {
    handleError(error, {
      component: `${componentName} (ErrorBoundary)`,
      action: 'Component Error',
      data: { errorInfo },
    });
  }
}

/**
 * Firebase 에러 처리 헬퍼
 *
 * @deprecated 새로운 firebaseErrors 모듈의 handleFirebaseError를 사용하세요
 * @see {@link handleFirebaseErrorUtil}
 */
export const handleFirebaseError = (error: any, options: ErrorHandlerOptions): string => {
  // 새로운 firebaseErrors 유틸리티 사용
  const context = {
    component: options.component,
    action: options.action,
    userId: options.userId,
    ...options.data,
  };

  const userFriendlyMessage = handleFirebaseErrorUtil(
    error as FirebaseError,
    context,
    'ko' // 기본 한국어
  );

  // 알림 표시 (옵션)
  if (options.showAlert && typeof window !== 'undefined') {
    toast.error(userFriendlyMessage);
  }

  return userFriendlyMessage;
};

/**
 * 네트워크 에러 처리 헬퍼
 */
export const handleNetworkError = (error: any, options: ErrorHandlerOptions): string => {
  let userFriendlyMessage = '네트워크 연결을 확인해주세요.';

  if (error?.message?.includes('fetch')) {
    userFriendlyMessage = '서버에 연결할 수 없습니다.';
  } else if (error?.message?.includes('timeout')) {
    userFriendlyMessage = '요청 시간이 초과되었습니다.';
  }

  return handleError(error, {
    ...options,
    fallbackMessage: userFriendlyMessage,
  });
};

/**
 * 유효성 검사 에러 처리 헬퍼
 */
export const handleValidationError = (
  field: string,
  message: string,
  options: ErrorHandlerOptions
): string => {
  const errorMessage = `${field}: ${message}`;

  return handleError(new Error(errorMessage), {
    ...options,
    action: 'Validation Error',
  });
};

/**
 * 에러 재시도 헬퍼
 */
export const withRetry = async <T>(
  asyncFn: () => Promise<T>,
  options: ErrorHandlerOptions & { maxRetries?: number; delay?: number }
): Promise<T | null> => {
  const { maxRetries = 3, delay = 1000, ...errorOptions } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      if (attempt === maxRetries) {
        handleError(error, {
          ...errorOptions,
          data: { ...errorOptions.data, attempts: attempt },
        });
        return null;
      }

      logger.warn(`[${errorOptions.component}] Retry attempt ${attempt}/${maxRetries}`, {
        component: errorOptions.component,
        attempt,
        maxRetries,
      });

      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  return null;
};

// =============================================================================
// safeAsync - Result 타입 기반 비동기 래퍼 (Phase 5)
// =============================================================================

/**
 * 에러 컨텍스트 인터페이스
 */
export interface ErrorContext {
  component: string;
  action?: string;
  userId?: string;
  data?: Record<string, unknown>;
}

/**
 * 비동기 작업을 Result 타입으로 안전하게 래핑
 *
 * @description
 * withErrorHandler와 달리 null 대신 명시적인 Result 타입을 반환합니다.
 * 성공/실패를 타입 레벨에서 구분할 수 있습니다.
 *
 * @param asyncFn 실행할 비동기 함수
 * @param context 에러 컨텍스트 정보
 * @returns Result<T> - 성공 시 { success: true, data: T }, 실패 시 { success: false, error: string }
 *
 * @example
 * ```typescript
 * // 기본 사용
 * const result = await safeAsync(
 *   () => fetchUserData(userId),
 *   { component: 'UserService', action: 'fetchUser' }
 * );
 *
 * if (result.success) {
 *   setUser(result.data);
 * } else {
 *   showError(result.error);
 * }
 *
 * // 구조 분해 사용
 * const { success, data, error } = await safeAsync(
 *   () => saveData(payload),
 *   { component: 'DataService' }
 * );
 * ```
 */
export const safeAsync = async <T>(
  asyncFn: () => Promise<T>,
  context: ErrorContext
): Promise<Result<T>> => {
  try {
    const data = await asyncFn();
    return success(data);
  } catch (error) {
    const errorMessage = extractErrorMessage(error);

    // 로깅
    logger.error(`[${context.component}] ${context.action || 'Error'}:`, toError(error), {
      component: context.component,
      operation: context.action,
      userId: context.userId,
    });

    return failure(errorMessage, error);
  }
};

/**
 * safeAsync with 재시도 로직
 *
 * @param asyncFn 실행할 비동기 함수
 * @param context 에러 컨텍스트
 * @param options 재시도 옵션
 * @returns Result<T>
 *
 * @example
 * ```typescript
 * const result = await safeAsyncWithRetry(
 *   () => unstableApiCall(),
 *   { component: 'ApiService' },
 *   { maxRetries: 3, delay: 1000 }
 * );
 * ```
 */
export const safeAsyncWithRetry = async <T>(
  asyncFn: () => Promise<T>,
  context: ErrorContext,
  options: { maxRetries?: number; delay?: number } = {}
): Promise<Result<T>> => {
  const { maxRetries = 3, delay = 1000 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await asyncFn();
      return success(data);
    } catch (error) {
      if (attempt === maxRetries) {
        const errorMessage = extractErrorMessage(error);

        logger.error(
          `[${context.component}] ${context.action || 'Error'} (after ${attempt} attempts):`,
          toError(error),
          {
            component: context.component,
            operation: context.action,
            userId: context.userId,
          }
        );

        return failure(errorMessage, error);
      }

      logger.warn(`[${context.component}] Retry attempt ${attempt}/${maxRetries}`, {
        component: context.component,
        attempt,
        maxRetries,
      });

      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  // 이 코드에 도달하면 안 됨 (TypeScript 만족용)
  return failure('최대 재시도 횟수를 초과했습니다.');
};
