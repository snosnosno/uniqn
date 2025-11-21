/**
 * Firebase Error Handling Utilities
 *
 * 표준화된 Firebase 에러 처리 및 사용자 친화적 메시지 제공
 * - i18n 지원 (한국어/영어)
 * - Type Guard를 통한 타입 안전성
 * - logger를 통한 중앙 집중식 에러 로깅
 *
 * @version 1.0.0
 * @created 2025-11-20
 * @feature 002-phase3-integration
 */

import { logger } from './logger';

/**
 * Firebase Error Interface
 *
 * Firebase SDK에서 발생하는 에러의 표준 구조
 */
export interface FirebaseError {
  code: string;
  message: string;
  name: string;
}

/**
 * Firebase 에러 메시지 맵 (i18n)
 *
 * 주요 Firebase 에러 코드에 대한 사용자 친화적 메시지
 * - ko: 한국어 메시지
 * - en: 영어 메시지
 */
const FIREBASE_ERROR_MESSAGES: Record<string, { ko: string; en: string }> = {
  'permission-denied': {
    ko: '권한이 없습니다. 관리자에게 문의하세요.',
    en: 'Permission denied. Please contact administrator.',
  },
  'not-found': {
    ko: '요청한 데이터를 찾을 수 없습니다.',
    en: 'Document not found.',
  },
  'unauthenticated': {
    ko: '로그인이 필요합니다.',
    en: 'Authentication required.',
  },
  'already-exists': {
    ko: '이미 존재하는 데이터입니다.',
    en: 'Document already exists.',
  },
  'resource-exhausted': {
    ko: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
    en: 'Request quota exceeded. Please try again later.',
  },
  'cancelled': {
    ko: '작업이 취소되었습니다.',
    en: 'Operation cancelled.',
  },
  'unknown': {
    ko: '알 수 없는 오류가 발생했습니다.',
    en: 'An unknown error occurred.',
  },
};

/**
 * Firebase 에러 코드를 사용자 친화적 메시지로 변환
 *
 * @param error - Firebase 에러 객체
 * @param locale - 언어 코드 ('ko' | 'en')
 * @returns 사용자 친화적 에러 메시지
 *
 * @example
 * ```typescript
 * const error = { code: 'permission-denied', message: 'Permission denied', name: 'FirebaseError' };
 * const message = getFirebaseErrorMessage(error, 'ko');
 * // => '권한이 없습니다. 관리자에게 문의하세요.'
 * ```
 */
export function getFirebaseErrorMessage(
  error: FirebaseError,
  locale: 'ko' | 'en' = 'ko'
): string {
  // Firebase 에러 코드가 정의된 메시지에 있는지 확인
  const errorMessage = FIREBASE_ERROR_MESSAGES[error.code];

  if (errorMessage) {
    return errorMessage[locale];
  }

  // 정의되지 않은 에러 코드는 'unknown' 메시지 반환
  const unknownMessage = FIREBASE_ERROR_MESSAGES['unknown'];
  return unknownMessage ? unknownMessage[locale] : '알 수 없는 오류가 발생했습니다.';
}

/**
 * permission-denied 에러인지 확인하는 Type Guard
 *
 * @param error - 검사할 에러 객체
 * @returns permission-denied 에러 여부
 *
 * @example
 * ```typescript
 * if (isPermissionDenied(error)) {
 *   // 권한 관련 처리
 *   showPermissionDialog();
 * }
 * ```
 */
export function isPermissionDenied(error: unknown): error is FirebaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as FirebaseError).code === 'permission-denied'
  );
}

/**
 * Firebase 에러를 로깅하고 사용자 메시지 반환
 *
 * logger를 사용하여 에러 컨텍스트를 기록하고,
 * 사용자 친화적 메시지를 반환합니다.
 *
 * @param error - Firebase 에러 객체
 * @param context - 에러 발생 컨텍스트 (선택)
 * @param locale - 언어 코드 ('ko' | 'en')
 * @returns 사용자 친화적 에러 메시지
 *
 * @example
 * ```typescript
 * try {
 *   await deleteDoc(docRef);
 * } catch (error) {
 *   const message = handleFirebaseError(
 *     error as FirebaseError,
 *     { operation: 'deleteStaff', userId: 'user123' },
 *     'ko'
 *   );
 *   showToast(message, 'error');
 * }
 * ```
 */
export function handleFirebaseError(
  error: FirebaseError,
  context?: Record<string, unknown>,
  locale: 'ko' | 'en' = 'ko'
): string {
  // Error 객체 생성
  const errorObject = new Error(error.message);
  errorObject.name = error.name;

  // logger를 사용하여 에러 기록
  logger.error(
    'Firebase Error',
    errorObject,
    {
      component: 'firebaseErrors',
      data: {
        code: error.code,
        message: error.message,
        context,
      },
    }
  );

  // 사용자 친화적 메시지 반환
  return getFirebaseErrorMessage(error, locale);
}
