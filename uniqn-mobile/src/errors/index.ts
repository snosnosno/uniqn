/**
 * UNIQN Mobile - 에러 시스템 배럴 Export
 *
 * @description 구조화된 에러 처리 시스템
 * @version 1.0.0
 *
 * @example
 * // 에러 클래스 사용
 * import { AppError, AuthError, NetworkError, ERROR_CODES } from '@/errors';
 *
 * throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
 *
 * @example
 * // Firebase 에러 변환
 * import { mapFirebaseError, normalizeError } from '@/errors';
 *
 * try {
 *   await signIn(email, password);
 * } catch (error) {
 *   const appError = mapFirebaseError(error);
 *   toast.error(appError.userMessage);
 * }
 *
 * @example
 * // 에러 래핑
 * import { withErrorHandling, withRetry } from '@/errors';
 *
 * const safeFetch = withErrorHandling(fetchData, { component: 'JobList' });
 * const retryableFetch = withRetry(fetchData, { maxRetries: 3 });
 */

// ============================================================================
// Error Classes & Types
// ============================================================================

export {
  // Types
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorCode,
  // Constants
  ERROR_CODES,
  ERROR_MESSAGES,
  // Classes
  AppError,
  NetworkError,
  AuthError,
  ValidationError,
  PermissionError,
  BusinessError,
  // Type Guards
  isAppError,
  isNetworkError,
  isAuthError,
  isValidationError,
  isPermissionError,
  isBusinessError,
} from './AppError';

// ============================================================================
// Firebase Error Mapping
// ============================================================================

export {
  mapFirebaseError,
  mapFirebaseAuthError,
  mapFirebaseFirestoreError,
  mapFirebaseStorageError,
  isFirebaseError,
} from './firebaseErrorMapper';

// ============================================================================
// Error Utilities
// ============================================================================

export {
  // Normalization
  normalizeError,
  // Wrappers
  withErrorHandling,
  withSyncErrorHandling,
  // Result Pattern
  type Result,
  tryCatch,
  tryCatchSync,
  // Message Utilities
  getErrorMessage,
  extractUserMessage,
  // Retry Utilities
  type RetryOptions,
  withRetry,
  // Error Boundary Helpers
  isRecoverableError,
  requiresReauthentication,
  getErrorAction,
} from './errorUtils';
