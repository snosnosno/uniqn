/**
 * 통합 에러 처리 유틸리티
 * 일관된 에러 처리 패턴을 제공합니다.
 */

import { logger } from './logger';
import { toast } from './toast';
import {
  handleFirebaseError as handleFirebaseErrorUtil,
  FirebaseError
} from './firebaseErrors';

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
export const handleError = (
  error: unknown,
  options: ErrorHandlerOptions
): string => {
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
      name: errorObject.name
    }
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
      data: { errorInfo }
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
    ...options.data
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
    fallbackMessage: userFriendlyMessage
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
    action: 'Validation Error'
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
          data: { ...errorOptions.data, attempts: attempt }
        });
        return null;
      }
      
      logger.warn(`[${errorOptions.component}] Retry attempt ${attempt}/${maxRetries}`, {
        component: errorOptions.component,
        attempt,
        maxRetries
      });
      
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  return null;
};