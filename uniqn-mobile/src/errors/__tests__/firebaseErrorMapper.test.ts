/**
 * UNIQN Mobile - firebaseErrorMapper 단위 테스트
 *
 * @description Firebase 에러 매핑 함수 테스트
 * @version 1.0.0
 */

import {
  isFirebaseError,
  mapFirebaseAuthError,
  mapFirebaseFirestoreError,
  mapFirebaseStorageError,
  mapFirebaseError,
} from '../firebaseErrorMapper';
import {
  ERROR_CODES,
  isAppError,
  isAuthError,
  isNetworkError,
  isPermissionError,
} from '../AppError';

// ============================================================================
// isFirebaseError Tests
// ============================================================================

describe('isFirebaseError', () => {
  it('Firebase 에러 객체를 감지', () => {
    const firebaseError = { code: 'auth/invalid-email', message: 'Invalid email' };
    expect(isFirebaseError(firebaseError)).toBe(true);
  });

  it('code 속성이 문자열이면 true', () => {
    const error = { code: 'some-code', message: 'Error message' };
    expect(isFirebaseError(error)).toBe(true);
  });

  it('code 속성이 없으면 false', () => {
    const error = { message: 'Error without code' };
    expect(isFirebaseError(error)).toBe(false);
  });

  it('code가 문자열이 아니면 false', () => {
    const error = { code: 123, message: 'Error' };
    expect(isFirebaseError(error)).toBe(false);
  });

  it('null은 false', () => {
    expect(isFirebaseError(null)).toBe(false);
  });

  it('undefined는 false', () => {
    expect(isFirebaseError(undefined)).toBe(false);
  });

  it('일반 Error 객체는 false', () => {
    const error = new Error('Normal error');
    expect(isFirebaseError(error)).toBe(false);
  });

  it('문자열은 false', () => {
    expect(isFirebaseError('error string')).toBe(false);
  });
});

// ============================================================================
// mapFirebaseAuthError Tests
// ============================================================================

describe('mapFirebaseAuthError', () => {
  describe('인증 에러 매핑', () => {
    const authErrorCases = [
      { firebaseCode: 'auth/invalid-email', expectedCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS },
      { firebaseCode: 'auth/user-disabled', expectedCode: ERROR_CODES.AUTH_ACCOUNT_DISABLED },
      { firebaseCode: 'auth/user-not-found', expectedCode: ERROR_CODES.AUTH_USER_NOT_FOUND },
      { firebaseCode: 'auth/wrong-password', expectedCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS },
      {
        firebaseCode: 'auth/invalid-credential',
        expectedCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      },
      {
        firebaseCode: 'auth/email-already-in-use',
        expectedCode: ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS,
      },
      { firebaseCode: 'auth/weak-password', expectedCode: ERROR_CODES.AUTH_WEAK_PASSWORD },
      {
        firebaseCode: 'auth/requires-recent-login',
        expectedCode: ERROR_CODES.AUTH_REQUIRES_RECENT_LOGIN,
      },
      { firebaseCode: 'auth/too-many-requests', expectedCode: ERROR_CODES.AUTH_TOO_MANY_REQUESTS },
      { firebaseCode: 'auth/id-token-expired', expectedCode: ERROR_CODES.AUTH_TOKEN_EXPIRED },
      {
        firebaseCode: 'auth/session-cookie-expired',
        expectedCode: ERROR_CODES.AUTH_SESSION_EXPIRED,
      },
    ];

    it.each(authErrorCases)(
      'Firebase $firebaseCode → AppError $expectedCode',
      ({ firebaseCode, expectedCode }) => {
        const firebaseError = { code: firebaseCode, message: 'Firebase error' };
        const result = mapFirebaseAuthError(firebaseError);

        expect(isAppError(result)).toBe(true);
        expect(result.code).toBe(expectedCode);
        expect(result.metadata?.firebaseCode).toBe(firebaseCode);
      }
    );
  });

  describe('인증 코드 검증 에러', () => {
    it('invalid-verification-code는 VALIDATION_FORMAT', () => {
      const error = { code: 'auth/invalid-verification-code', message: 'Invalid code' };
      const result = mapFirebaseAuthError(error);

      expect(result.code).toBe(ERROR_CODES.VALIDATION_FORMAT);
      expect(result.userMessage).toContain('인증 코드');
    });

    it('invalid-verification-id는 VALIDATION_FORMAT', () => {
      const error = { code: 'auth/invalid-verification-id', message: 'Invalid id' };
      const result = mapFirebaseAuthError(error);

      expect(result.code).toBe(ERROR_CODES.VALIDATION_FORMAT);
    });

    it('credential-already-in-use는 EMAIL_ALREADY_EXISTS', () => {
      const error = { code: 'auth/credential-already-in-use', message: 'In use' };
      const result = mapFirebaseAuthError(error);

      expect(result.code).toBe(ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS);
    });
  });

  describe('네트워크 에러 매핑', () => {
    it('network-request-failed는 AuthError with NETWORK_OFFLINE code', () => {
      // Note: FIREBASE_AUTH_ERROR_MAP에 정의되어 AuthError로 매핑됨
      const error = { code: 'auth/network-request-failed', message: 'Network failed' };
      const result = mapFirebaseAuthError(error);

      expect(isAuthError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.NETWORK_OFFLINE);
    });

    it('timeout은 AuthError with NETWORK_TIMEOUT code', () => {
      const error = { code: 'auth/timeout', message: 'Timeout' };
      const result = mapFirebaseAuthError(error);

      expect(isAuthError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.NETWORK_TIMEOUT);
    });

    it('매핑에 없는 네트워크 관련 코드는 NetworkError로 변환', () => {
      // 매핑에 없지만 'network' 패턴을 포함하는 경우
      const error = { code: 'auth/network-something-new', message: 'Network issue' };
      const result = mapFirebaseAuthError(error);

      expect(isNetworkError(result)).toBe(true);
    });
  });

  describe('매핑되지 않은 auth 에러', () => {
    it('알 수 없는 auth 코드는 AUTH_INVALID_CREDENTIALS로 폴백', () => {
      const error = { code: 'auth/unknown-error-code', message: 'Unknown' };
      const result = mapFirebaseAuthError(error);

      expect(isAuthError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    });
  });

  describe('비 Firebase 에러 처리', () => {
    it('일반 Error 객체 처리', () => {
      const error = new Error('Not firebase error');
      const result = mapFirebaseAuthError(error);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
      expect(result.category).toBe('auth');
    });

    it('문자열 에러 처리', () => {
      const result = mapFirebaseAuthError('string error');

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
    });
  });
});

// ============================================================================
// mapFirebaseFirestoreError Tests
// ============================================================================

describe('mapFirebaseFirestoreError', () => {
  describe('기본 Firestore 에러 매핑', () => {
    const firestoreErrorCases = [
      { firebaseCode: 'permission-denied', expectedCode: ERROR_CODES.FIREBASE_PERMISSION_DENIED },
      { firebaseCode: 'not-found', expectedCode: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND },
      { firebaseCode: 'already-exists', expectedCode: ERROR_CODES.VALIDATION_SCHEMA },
      { firebaseCode: 'resource-exhausted', expectedCode: ERROR_CODES.FIREBASE_QUOTA_EXCEEDED },
      { firebaseCode: 'aborted', expectedCode: ERROR_CODES.FIREBASE_ABORTED },
      { firebaseCode: 'unavailable', expectedCode: ERROR_CODES.FIREBASE_UNAVAILABLE },
      { firebaseCode: 'unauthenticated', expectedCode: ERROR_CODES.AUTH_SESSION_EXPIRED },
      { firebaseCode: 'cancelled', expectedCode: ERROR_CODES.FIREBASE_ABORTED },
      { firebaseCode: 'deadline-exceeded', expectedCode: ERROR_CODES.NETWORK_TIMEOUT },
    ];

    it.each(firestoreErrorCases)(
      'Firestore $firebaseCode → AppError $expectedCode',
      ({ firebaseCode, expectedCode }) => {
        const firebaseError = { code: firebaseCode, message: 'Firestore error' };
        const result = mapFirebaseFirestoreError(firebaseError);

        expect(isAppError(result)).toBe(true);
        expect(result.code).toBe(expectedCode);
      }
    );
  });

  describe('firestore/ 접두사 처리', () => {
    it('firestore/permission-denied 접두사 제거', () => {
      const error = { code: 'firestore/permission-denied', message: 'Denied' };
      const result = mapFirebaseFirestoreError(error);

      expect(result.code).toBe(ERROR_CODES.FIREBASE_PERMISSION_DENIED);
    });
  });

  describe('권한 에러는 PermissionError로 변환', () => {
    it('permission-denied는 PermissionError', () => {
      const error = { code: 'permission-denied', message: 'Permission denied' };
      const result = mapFirebaseFirestoreError(error);

      expect(isPermissionError(result)).toBe(true);
    });

    it('unauthenticated는 PermissionError', () => {
      const error = { code: 'unauthenticated', message: 'Unauthenticated' };
      const result = mapFirebaseFirestoreError(error);

      expect(isPermissionError(result)).toBe(true);
    });
  });

  describe('네트워크 에러 변환', () => {
    it('unavailable은 NetworkError', () => {
      const error = { code: 'unavailable', message: 'Service unavailable' };
      const result = mapFirebaseFirestoreError(error);

      expect(isNetworkError(result)).toBe(true);
    });

    it('deadline-exceeded는 NetworkError', () => {
      const error = { code: 'deadline-exceeded', message: 'Deadline exceeded' };
      const result = mapFirebaseFirestoreError(error);

      expect(isNetworkError(result)).toBe(true);
    });
  });

  describe('기타 에러 처리', () => {
    it('failed-precondition은 VALIDATION_SCHEMA', () => {
      const error = { code: 'failed-precondition', message: 'Precondition failed' };
      const result = mapFirebaseFirestoreError(error);

      expect(result.code).toBe(ERROR_CODES.VALIDATION_SCHEMA);
      expect(result.userMessage).toContain('조건');
    });

    it('out-of-range은 VALIDATION_SCHEMA', () => {
      const error = { code: 'out-of-range', message: 'Out of range' };
      const result = mapFirebaseFirestoreError(error);

      expect(result.code).toBe(ERROR_CODES.VALIDATION_SCHEMA);
    });

    it('data-loss는 커스텀 메시지', () => {
      const error = { code: 'data-loss', message: 'Data lost' };
      const result = mapFirebaseFirestoreError(error);

      expect(result.userMessage).toContain('데이터 손실');
    });
  });

  describe('매핑되지 않은 Firestore 에러', () => {
    it('알 수 없는 코드는 UNKNOWN으로 폴백', () => {
      const error = { code: 'unknown-firestore-error', message: 'Unknown' };
      const result = mapFirebaseFirestoreError(error);

      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
      expect(result.category).toBe('firebase');
    });
  });

  describe('비 Firebase 에러 처리', () => {
    it('일반 Error 객체 처리', () => {
      const error = new Error('Normal error');
      const result = mapFirebaseFirestoreError(error);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
      expect(result.category).toBe('firebase');
    });
  });
});

// ============================================================================
// mapFirebaseStorageError Tests
// ============================================================================

describe('mapFirebaseStorageError', () => {
  describe('기본 Storage 에러 매핑', () => {
    const storageErrorCases = [
      { firebaseCode: 'storage/unknown', expectedCode: ERROR_CODES.UNKNOWN },
      {
        firebaseCode: 'storage/object-not-found',
        expectedCode: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND,
      },
      {
        firebaseCode: 'storage/bucket-not-found',
        expectedCode: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND,
      },
      {
        firebaseCode: 'storage/project-not-found',
        expectedCode: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND,
      },
      { firebaseCode: 'storage/quota-exceeded', expectedCode: ERROR_CODES.FIREBASE_QUOTA_EXCEEDED },
      { firebaseCode: 'storage/unauthenticated', expectedCode: ERROR_CODES.AUTH_SESSION_EXPIRED },
      {
        firebaseCode: 'storage/unauthorized',
        expectedCode: ERROR_CODES.FIREBASE_PERMISSION_DENIED,
      },
      {
        firebaseCode: 'storage/retry-limit-exceeded',
        expectedCode: ERROR_CODES.NETWORK_REQUEST_FAILED,
      },
      { firebaseCode: 'storage/canceled', expectedCode: ERROR_CODES.FIREBASE_ABORTED },
      { firebaseCode: 'storage/invalid-url', expectedCode: ERROR_CODES.VALIDATION_FORMAT },
    ];

    it.each(storageErrorCases)(
      'Storage $firebaseCode → AppError $expectedCode',
      ({ firebaseCode, expectedCode }) => {
        const firebaseError = { code: firebaseCode, message: 'Storage error' };
        const result = mapFirebaseStorageError(firebaseError);

        expect(isAppError(result)).toBe(true);
        expect(result.code).toBe(expectedCode);
      }
    );
  });

  describe('권한 에러는 PermissionError로 변환', () => {
    it('storage/unauthorized는 PermissionError', () => {
      const error = { code: 'storage/unauthorized', message: 'Unauthorized' };
      const result = mapFirebaseStorageError(error);

      expect(isPermissionError(result)).toBe(true);
    });

    it('storage/unauthenticated는 PermissionError', () => {
      const error = { code: 'storage/unauthenticated', message: 'Unauthenticated' };
      const result = mapFirebaseStorageError(error);

      expect(isPermissionError(result)).toBe(true);
    });
  });

  describe('네트워크 에러 변환', () => {
    it('storage/retry-limit-exceeded는 NetworkError', () => {
      const error = { code: 'storage/retry-limit-exceeded', message: 'Retry limit' };
      const result = mapFirebaseStorageError(error);

      expect(isNetworkError(result)).toBe(true);
    });
  });

  describe('파일 관련 에러', () => {
    it('object-not-found는 파일 찾을 수 없음 메시지', () => {
      const error = { code: 'storage/object-not-found', message: 'Not found' };
      const result = mapFirebaseStorageError(error);

      expect(result.userMessage).toContain('파일');
    });

    it('invalid-checksum은 파일 손상 메시지', () => {
      const error = { code: 'storage/invalid-checksum', message: 'Invalid checksum' };
      const result = mapFirebaseStorageError(error);

      expect(result.userMessage).toContain('손상');
    });

    it('server-file-wrong-size는 파일 크기 메시지', () => {
      const error = { code: 'storage/server-file-wrong-size', message: 'Wrong size' };
      const result = mapFirebaseStorageError(error);

      expect(result.userMessage).toContain('크기');
    });
  });

  describe('매핑되지 않은 Storage 에러', () => {
    it('알 수 없는 코드는 UNKNOWN으로 폴백', () => {
      const error = { code: 'storage/new-unknown-error', message: 'Unknown' };
      const result = mapFirebaseStorageError(error);

      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
      expect(result.category).toBe('firebase');
    });
  });

  describe('비 Firebase 에러 처리', () => {
    it('일반 Error 객체 처리', () => {
      const error = new Error('Normal error');
      const result = mapFirebaseStorageError(error);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
    });
  });
});

// ============================================================================
// mapFirebaseError (통합 매퍼) Tests
// ============================================================================

describe('mapFirebaseError', () => {
  describe('접두사 기반 자동 분류', () => {
    it('auth/ 접두사는 mapFirebaseAuthError 호출', () => {
      const error = { code: 'auth/invalid-email', message: 'Invalid' };
      const result = mapFirebaseError(error);

      expect(result.code).toBe(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    });

    it('storage/ 접두사는 mapFirebaseStorageError 호출', () => {
      const error = { code: 'storage/object-not-found', message: 'Not found' };
      const result = mapFirebaseError(error);

      expect(result.code).toBe(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND);
    });

    it('접두사 없는 코드는 mapFirebaseFirestoreError 호출', () => {
      const error = { code: 'permission-denied', message: 'Denied' };
      const result = mapFirebaseError(error);

      expect(result.code).toBe(ERROR_CODES.FIREBASE_PERMISSION_DENIED);
    });
  });

  describe('비 Firebase 에러 처리', () => {
    it('Firebase 에러가 아니면 UNKNOWN AppError', () => {
      const error = new Error('Not firebase');
      const result = mapFirebaseError(error);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
      expect(result.category).toBe('unknown');
    });

    it('null/undefined 처리', () => {
      expect(mapFirebaseError(null).code).toBe(ERROR_CODES.UNKNOWN);
      expect(mapFirebaseError(undefined).code).toBe(ERROR_CODES.UNKNOWN);
    });

    it('문자열 처리', () => {
      const result = mapFirebaseError('string error');

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
    });
  });

  describe('에러 메타데이터 보존', () => {
    it('firebaseCode 메타데이터 포함', () => {
      const error = { code: 'auth/invalid-email', message: 'Test' };
      const result = mapFirebaseError(error);

      expect(result.metadata?.firebaseCode).toBe('auth/invalid-email');
    });

    it('원본 에러 메시지 보존', () => {
      const error = { code: 'auth/user-not-found', message: 'User not found in database' };
      const result = mapFirebaseError(error);

      expect(result.message).toBe('User not found in database');
    });
  });

  describe('복합 시나리오', () => {
    it('연속적인 에러 매핑이 일관성 유지', () => {
      const errors = [
        { code: 'auth/invalid-email', message: 'Auth error' },
        { code: 'permission-denied', message: 'Firestore error' },
        { code: 'storage/unauthorized', message: 'Storage error' },
      ];

      const results = errors.map(mapFirebaseError);

      expect(results.every(isAppError)).toBe(true);
      expect(results[0].code).toBe(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
      expect(results[1].code).toBe(ERROR_CODES.FIREBASE_PERMISSION_DENIED);
      expect(results[2].code).toBe(ERROR_CODES.FIREBASE_PERMISSION_DENIED);
    });

    it('Error 인스턴스를 originalError로 보존', () => {
      const originalError = new Error('Original');
      // Firebase 에러 형태로 만들기
      const firebaseError = Object.assign(originalError, {
        code: 'auth/invalid-email',
      });

      const result = mapFirebaseError(firebaseError);

      expect(result.originalError).toBe(originalError);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('빈 코드 문자열 처리', () => {
    const error = { code: '', message: 'Empty code' };
    const result = mapFirebaseError(error);

    expect(isAppError(result)).toBe(true);
  });

  it('특수 문자가 포함된 코드 처리', () => {
    const error = { code: 'auth/special-$-code', message: 'Special' };
    const result = mapFirebaseAuthError(error);

    expect(isAppError(result)).toBe(true);
  });

  it('매우 긴 에러 메시지 처리', () => {
    const longMessage = 'A'.repeat(10000);
    const error = { code: 'auth/invalid-email', message: longMessage };
    const result = mapFirebaseError(error);

    expect(result.message).toBe(longMessage);
  });

  it('메시지가 없는 에러 처리', () => {
    // message 속성 없이 테스트 (isFirebaseError는 code만 요구)
    const error = { code: 'auth/invalid-email' };
    const result = mapFirebaseError(error);

    expect(isAppError(result)).toBe(true);
  });
});
