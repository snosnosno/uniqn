/**
 * 통합 에러 처리 유틸리티
 * 일관된 에러 처리 패턴을 제공합니다.
 */

import { logger } from './logger';

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
    alert(errorMessage);
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
 */
export const handleFirebaseError = (error: any, options: ErrorHandlerOptions): string => {
  let userFriendlyMessage = options.fallbackMessage || '작업 중 오류가 발생했습니다.';
  
  // Firebase 에러 코드에 따른 메시지 매핑
  if (error?.code) {
    switch (error.code) {
      case 'permission-denied':
        userFriendlyMessage = '권한이 없습니다.';
        break;
      case 'not-found':
        userFriendlyMessage = '요청한 데이터를 찾을 수 없습니다.';
        break;
      case 'already-exists':
        userFriendlyMessage = '이미 존재하는 데이터입니다.';
        break;
      case 'unauthenticated':
        userFriendlyMessage = '로그인이 필요합니다.';
        break;
      case 'unavailable':
        userFriendlyMessage = '서비스를 일시적으로 사용할 수 없습니다.';
        break;
      case 'deadline-exceeded':
        userFriendlyMessage = '요청 시간이 초과되었습니다.';
        break;
      default:
        userFriendlyMessage = error.message || userFriendlyMessage;
    }
  }
  
  return handleError(error, {
    ...options,
    fallbackMessage: userFriendlyMessage
  });
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