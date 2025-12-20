/**
 * UNIQN Mobile - 에러 유틸리티
 *
 * @description 에러 정규화 및 처리 유틸리티
 * @version 1.0.0
 */

import { FirebaseError } from 'firebase/app';

// ============================================================================
// Types
// ============================================================================

export interface NormalizedError {
  code: string;
  message: string;
  originalError: unknown;
  isFirebaseError: boolean;
  isNetworkError: boolean;
}

// ============================================================================
// Error Normalization
// ============================================================================

/**
 * 다양한 에러 타입을 표준화된 형태로 변환
 */
export function normalizeError(error: unknown): NormalizedError {
  // Firebase 에러
  if (error instanceof FirebaseError) {
    return {
      code: error.code,
      message: getFirebaseErrorMessage(error.code),
      originalError: error,
      isFirebaseError: true,
      isNetworkError: error.code === 'unavailable' || error.code === 'network-request-failed',
    };
  }

  // 일반 Error
  if (error instanceof Error) {
    const isNetworkError =
      error.message.includes('network') ||
      error.message.includes('fetch') ||
      error.message.includes('timeout');

    return {
      code: 'unknown',
      message: error.message,
      originalError: error,
      isFirebaseError: false,
      isNetworkError,
    };
  }

  // 문자열 에러
  if (typeof error === 'string') {
    return {
      code: 'unknown',
      message: error,
      originalError: error,
      isFirebaseError: false,
      isNetworkError: false,
    };
  }

  // 알 수 없는 에러
  return {
    code: 'unknown',
    message: '알 수 없는 오류가 발생했습니다.',
    originalError: error,
    isFirebaseError: false,
    isNetworkError: false,
  };
}

// ============================================================================
// Firebase Error Messages
// ============================================================================

/**
 * Firebase 에러 코드에 대한 사용자 친화적 메시지 반환
 */
export function getFirebaseErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    // 인증 관련
    'auth/user-not-found': '등록되지 않은 사용자입니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/weak-password': '비밀번호가 너무 약합니다.',
    'auth/invalid-email': '올바르지 않은 이메일 형식입니다.',
    'auth/too-many-requests': '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
    'auth/invalid-credential': '잘못된 인증 정보입니다.',

    // Firestore 관련
    'permission-denied': '권한이 없습니다.',
    'not-found': '데이터를 찾을 수 없습니다.',
    unavailable: '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.',
    cancelled: '작업이 취소되었습니다.',
    'deadline-exceeded': '요청 시간이 초과되었습니다.',
    'already-exists': '이미 존재하는 데이터입니다.',
    'resource-exhausted': '일시적으로 요청이 많습니다. 잠시 후 다시 시도해주세요.',
    'failed-precondition': '작업을 수행할 수 없는 상태입니다.',
    aborted: '작업이 중단되었습니다.',
    'out-of-range': '유효하지 않은 범위입니다.',
    unimplemented: '지원하지 않는 기능입니다.',
    internal: '내부 오류가 발생했습니다.',
    'data-loss': '데이터 손실이 발생했습니다.',
    unauthenticated: '로그인이 필요합니다.',
  };

  return messages[code] || '오류가 발생했습니다. 다시 시도해주세요.';
}

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Firebase 에러인지 확인
 */
export function isFirebaseError(error: unknown): error is FirebaseError {
  return error instanceof FirebaseError;
}

/**
 * 네트워크 에러인지 확인
 */
export function isNetworkError(error: unknown): boolean {
  const normalized = normalizeError(error);
  return normalized.isNetworkError;
}

/**
 * 인증 에러인지 확인
 */
export function isAuthError(error: unknown): boolean {
  if (isFirebaseError(error)) {
    return error.code.startsWith('auth/');
  }
  return false;
}

/**
 * 권한 에러인지 확인
 */
export function isPermissionError(error: unknown): boolean {
  if (isFirebaseError(error)) {
    return error.code === 'permission-denied' || error.code === 'unauthenticated';
  }
  return false;
}
