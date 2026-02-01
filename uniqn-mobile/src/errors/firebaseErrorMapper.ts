/**
 * UNIQN Mobile - Firebase 에러 매핑
 *
 * @description Firebase 에러를 AppError로 변환
 * @version 1.0.0
 */

import { AppError, AuthError, NetworkError, PermissionError, ERROR_CODES } from './AppError';

// ============================================================================
// Firebase Auth Error Codes
// ============================================================================

const FIREBASE_AUTH_ERROR_MAP: Record<string, { code: string; message?: string }> = {
  // 인증 에러
  'auth/invalid-email': { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS },
  'auth/user-disabled': { code: ERROR_CODES.AUTH_ACCOUNT_DISABLED },
  'auth/user-not-found': { code: ERROR_CODES.AUTH_USER_NOT_FOUND },
  'auth/wrong-password': { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS },
  'auth/invalid-credential': { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS },
  'auth/email-already-in-use': { code: ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS },
  'auth/weak-password': { code: ERROR_CODES.AUTH_WEAK_PASSWORD },
  'auth/requires-recent-login': { code: ERROR_CODES.AUTH_REQUIRES_RECENT_LOGIN },
  'auth/too-many-requests': { code: ERROR_CODES.AUTH_TOO_MANY_REQUESTS },
  'auth/id-token-expired': { code: ERROR_CODES.AUTH_TOKEN_EXPIRED },
  'auth/session-cookie-expired': { code: ERROR_CODES.AUTH_SESSION_EXPIRED },
  'auth/invalid-verification-code': {
    code: ERROR_CODES.VALIDATION_FORMAT,
    message: '인증 코드가 올바르지 않습니다',
  },
  'auth/invalid-verification-id': {
    code: ERROR_CODES.VALIDATION_FORMAT,
    message: '인증 정보가 올바르지 않습니다',
  },
  'auth/credential-already-in-use': {
    code: ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS,
    message: '이미 사용 중인 인증 정보입니다',
  },
  'auth/network-request-failed': { code: ERROR_CODES.NETWORK_OFFLINE },
  'auth/timeout': { code: ERROR_CODES.NETWORK_TIMEOUT },
  'auth/operation-not-allowed': {
    code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
    message: '허용되지 않은 작업입니다',
  },
};

// ============================================================================
// Firebase Firestore Error Codes
// ============================================================================

const FIREBASE_FIRESTORE_ERROR_MAP: Record<string, { code: string; message?: string }> = {
  'permission-denied': { code: ERROR_CODES.FIREBASE_PERMISSION_DENIED },
  'not-found': { code: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND },
  'already-exists': {
    code: ERROR_CODES.VALIDATION_SCHEMA,
    message: '이미 존재하는 데이터입니다',
  },
  'resource-exhausted': { code: ERROR_CODES.FIREBASE_QUOTA_EXCEEDED },
  'failed-precondition': {
    code: ERROR_CODES.VALIDATION_SCHEMA,
    message: '요청 조건이 충족되지 않았습니다',
  },
  aborted: { code: ERROR_CODES.FIREBASE_ABORTED },
  'out-of-range': {
    code: ERROR_CODES.VALIDATION_SCHEMA,
    message: '요청 값이 범위를 벗어났습니다',
  },
  unimplemented: {
    code: ERROR_CODES.UNKNOWN,
    message: '지원되지 않는 기능입니다',
  },
  internal: { code: ERROR_CODES.UNKNOWN },
  unavailable: { code: ERROR_CODES.FIREBASE_UNAVAILABLE },
  'data-loss': { code: ERROR_CODES.UNKNOWN, message: '데이터 손실이 발생했습니다' },
  unauthenticated: { code: ERROR_CODES.AUTH_SESSION_EXPIRED },
  cancelled: { code: ERROR_CODES.FIREBASE_ABORTED },
  'deadline-exceeded': { code: ERROR_CODES.NETWORK_TIMEOUT },
};

// ============================================================================
// Firebase Storage Error Codes
// ============================================================================

const FIREBASE_STORAGE_ERROR_MAP: Record<string, { code: string; message?: string }> = {
  'storage/unknown': { code: ERROR_CODES.UNKNOWN },
  'storage/object-not-found': {
    code: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND,
    message: '파일을 찾을 수 없습니다',
  },
  'storage/bucket-not-found': { code: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND },
  'storage/project-not-found': { code: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND },
  'storage/quota-exceeded': { code: ERROR_CODES.FIREBASE_QUOTA_EXCEEDED },
  'storage/unauthenticated': { code: ERROR_CODES.AUTH_SESSION_EXPIRED },
  'storage/unauthorized': { code: ERROR_CODES.FIREBASE_PERMISSION_DENIED },
  'storage/retry-limit-exceeded': { code: ERROR_CODES.NETWORK_REQUEST_FAILED },
  'storage/invalid-checksum': {
    code: ERROR_CODES.VALIDATION_SCHEMA,
    message: '파일이 손상되었습니다',
  },
  'storage/canceled': { code: ERROR_CODES.FIREBASE_ABORTED },
  'storage/invalid-url': { code: ERROR_CODES.VALIDATION_FORMAT },
  'storage/server-file-wrong-size': {
    code: ERROR_CODES.VALIDATION_SCHEMA,
    message: '파일 크기가 올바르지 않습니다',
  },
};

// ============================================================================
// Error Mapping Functions
// ============================================================================

/**
 * Firebase 에러인지 확인
 */
export function isFirebaseError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Firebase Auth 에러를 AppError로 변환
 */
export function mapFirebaseAuthError(error: unknown): AppError {
  if (!isFirebaseError(error)) {
    return new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'auth',
      originalError: error instanceof Error ? error : undefined,
    });
  }

  const mapping = FIREBASE_AUTH_ERROR_MAP[error.code];

  if (mapping) {
    return new AuthError(mapping.code, {
      message: error.message,
      userMessage: mapping.message,
      originalError: error instanceof Error ? error : undefined,
      metadata: { firebaseCode: error.code },
    });
  }

  // 네트워크 관련 에러 처리
  if (error.code.includes('network')) {
    return new NetworkError(ERROR_CODES.NETWORK_OFFLINE, {
      message: error.message,
      originalError: error instanceof Error ? error : undefined,
      metadata: { firebaseCode: error.code },
    });
  }

  return new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
    message: error.message,
    originalError: error instanceof Error ? error : undefined,
    metadata: { firebaseCode: error.code },
  });
}

/**
 * Firebase Firestore 에러를 AppError로 변환
 */
export function mapFirebaseFirestoreError(error: unknown): AppError {
  if (!isFirebaseError(error)) {
    return new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'firebase',
      originalError: error instanceof Error ? error : undefined,
    });
  }

  // Firestore 에러 코드 추출 (firestore/ 접두사 제거)
  const errorCode = error.code.replace('firestore/', '');
  const mapping = FIREBASE_FIRESTORE_ERROR_MAP[errorCode];

  if (mapping) {
    // 권한 에러
    if (errorCode === 'permission-denied' || errorCode === 'unauthenticated') {
      return new PermissionError(mapping.code, {
        message: error.message,
        userMessage: mapping.message,
        originalError: error instanceof Error ? error : undefined,
        metadata: { firebaseCode: error.code },
      });
    }

    // 네트워크 관련 에러
    if (errorCode === 'unavailable' || errorCode === 'deadline-exceeded') {
      return new NetworkError(mapping.code, {
        message: error.message,
        userMessage: mapping.message,
        originalError: error instanceof Error ? error : undefined,
        metadata: { firebaseCode: error.code },
      });
    }

    return new AppError({
      code: mapping.code,
      category: 'firebase',
      message: error.message,
      userMessage: mapping.message,
      originalError: error instanceof Error ? error : undefined,
      metadata: { firebaseCode: error.code },
    });
  }

  return new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'firebase',
    message: error.message,
    originalError: error instanceof Error ? error : undefined,
    metadata: { firebaseCode: error.code },
  });
}

/**
 * Firebase Storage 에러를 AppError로 변환
 */
export function mapFirebaseStorageError(error: unknown): AppError {
  if (!isFirebaseError(error)) {
    return new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'firebase',
      originalError: error instanceof Error ? error : undefined,
    });
  }

  const mapping = FIREBASE_STORAGE_ERROR_MAP[error.code];

  if (mapping) {
    // 권한 에러
    if (error.code === 'storage/unauthorized' || error.code === 'storage/unauthenticated') {
      return new PermissionError(mapping.code, {
        message: error.message,
        userMessage: mapping.message,
        originalError: error instanceof Error ? error : undefined,
        metadata: { firebaseCode: error.code },
      });
    }

    // 네트워크 관련 에러
    if (error.code === 'storage/retry-limit-exceeded') {
      return new NetworkError(mapping.code, {
        message: error.message,
        userMessage: mapping.message,
        originalError: error instanceof Error ? error : undefined,
        metadata: { firebaseCode: error.code },
      });
    }

    return new AppError({
      code: mapping.code,
      category: 'firebase',
      message: error.message,
      userMessage: mapping.message,
      originalError: error instanceof Error ? error : undefined,
      metadata: { firebaseCode: error.code },
    });
  }

  return new AppError({
    code: ERROR_CODES.UNKNOWN,
    category: 'firebase',
    message: error.message,
    originalError: error instanceof Error ? error : undefined,
    metadata: { firebaseCode: error.code },
  });
}

/**
 * 모든 Firebase 에러를 자동으로 분류하여 AppError로 변환
 */
export function mapFirebaseError(error: unknown): AppError {
  if (!isFirebaseError(error)) {
    return new AppError({
      code: ERROR_CODES.UNKNOWN,
      category: 'unknown',
      originalError: error instanceof Error ? error : undefined,
    });
  }

  // Auth 에러
  if (error.code.startsWith('auth/')) {
    return mapFirebaseAuthError(error);
  }

  // Storage 에러
  if (error.code.startsWith('storage/')) {
    return mapFirebaseStorageError(error);
  }

  // Firestore 에러 (접두사가 없거나 firestore/로 시작)
  return mapFirebaseFirestoreError(error);
}

export default mapFirebaseError;
