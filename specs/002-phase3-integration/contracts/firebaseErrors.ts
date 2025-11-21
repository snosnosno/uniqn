/**
 * FirebaseErrorUtils Contracts
 *
 * Standardized Firebase error handling across 20 files
 * User-friendly error messages in Korean/English
 *
 * @module contracts/firebaseErrors
 * @see app2/src/utils/firebaseErrors.ts (implementation)
 */

import { FirebaseError } from 'firebase/app';

/**
 * Supported locales
 */
export type Locale = 'ko' | 'en';

/**
 * Error message in multiple languages
 */
export interface ErrorMessage {
  ko: string;
  en: string;
}

/**
 * Firebase error code mapping
 *
 * Maps Firebase error codes to user-friendly messages
 */
export interface FirebaseErrorMapping {
  /**
   * Error code (without 'firestore/' or 'auth/' prefix)
   */
  code: string;

  /**
   * Localized error messages
   */
  message: ErrorMessage;

  /**
   * Suggested user action (optional)
   */
  action?: ErrorMessage;
}

/**
 * Common Firebase error codes
 */
export const FIREBASE_ERROR_CODES = {
  PERMISSION_DENIED: 'permission-denied',
  NOT_FOUND: 'not-found',
  UNAUTHENTICATED: 'unauthenticated',
  ALREADY_EXISTS: 'already-exists',
  RESOURCE_EXHAUSTED: 'resource-exhausted',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
} as const;

/**
 * Firebase error code type
 */
export type FirebaseErrorCode = typeof FIREBASE_ERROR_CODES[keyof typeof FIREBASE_ERROR_CODES];

/**
 * Firebase error utility function contracts
 */
export interface FirebaseErrorUtilsModule {
  /**
   * Convert Firebase error to user-friendly message
   *
   * @param error - Firebase error (FirebaseError, Error, or unknown)
   * @param locale - Language ('ko' | 'en', default: 'ko')
   * @returns User-friendly error message
   *
   * @example
   * getFirebaseErrorMessage(error, 'ko'); // "권한이 없습니다. 관리자에게 문의하세요."
   * getFirebaseErrorMessage(error, 'en'); // "Permission denied. Contact administrator."
   * getFirebaseErrorMessage(unknownError); // "일시적인 오류가 발생했습니다." (fallback)
   */
  getFirebaseErrorMessage(
    error: FirebaseError | Error | unknown,
    locale?: Locale
  ): string;

  /**
   * Check if error is permission denied (Type Guard)
   *
   * @param error - Error to check
   * @returns True if permission denied error
   *
   * @example
   * if (isPermissionDenied(error)) {
   *   // Handle permission denied specifically
   *   navigate('/login');
   * }
   */
  isPermissionDenied(error: unknown): error is FirebaseError;

  /**
   * Handle Firebase error (log + return message)
   *
   * Logs error using logger.error() and returns user message
   *
   * @param error - Firebase error
   * @param context - Error context (component, action, etc.)
   * @returns User-friendly error message
   *
   * @example
   * handleFirebaseError(error, {
   *   component: 'JobPostingForm',
   *   action: 'submit'
   * });
   * // logger: "[FirebaseError] permission-denied at JobPostingForm.submit"
   * // return: "권한이 없습니다. 관리자에게 문의하세요."
   */
  handleFirebaseError(
    error: unknown,
    context?: Record<string, any>
  ): string;
}

/**
 * Firebase error message mapping
 *
 * Full mapping of all error codes to localized messages
 */
export interface FirebaseErrorMessages {
  'permission-denied': ErrorMessage;
  'not-found': ErrorMessage;
  'unauthenticated': ErrorMessage;
  'already-exists': ErrorMessage;
  'resource-exhausted': ErrorMessage;
  'cancelled': ErrorMessage;
  'unknown': ErrorMessage;
  [key: string]: ErrorMessage; // Allow extension
}

/**
 * Error handling context
 */
export interface ErrorContext {
  /**
   * Component name where error occurred
   */
  component?: string;

  /**
   * Action that triggered error
   */
  action?: string;

  /**
   * Additional metadata
   */
  [key: string]: any;
}

/**
 * Error handling strategy
 */
export interface ErrorHandlingStrategy {
  /**
   * Log errors using logger.error()
   */
  logging: 'logger';

  /**
   * Return user-friendly messages
   */
  userMessages: true;

  /**
   * Never expose technical error codes to users
   */
  exposeTechnicalDetails: false;

  /**
   * Always provide fallback message for unknown errors
   */
  fallbackMessage: 'Temporary error occurred. Please try again.';
}

/**
 * Usage pattern: Before → After
 */
export interface FirebaseErrorMigrationPattern {
  /**
   * Before: Duplicated error handling (20 files)
   * @example
   * try {
   *   await saveData();
   * } catch (error) {
   *   console.error('Error:', error); // ❌
   *   alert('오류가 발생했습니다.'); // ❌
   * }
   */
  before: string;

  /**
   * After: Standardized error handling
   * @example
   * import { handleFirebaseError } from '@/utils/firebaseErrors';
   *
   * try {
   *   await saveData();
   * } catch (error) {
   *   const message = handleFirebaseError(error, {
   *     component: 'Form',
   *     action: 'save'
   *   }); // ✅
   *   toast.error(message);
   * }
   */
  after: string;

  /**
   * Files to migrate (20 files)
   */
  targetFiles: string[];
}
