/**
 * Test Error Presets for AuthContext Testing
 *
 * Purpose: Firebase Auth 에러 프리셋 (12개)
 * Feature: 001-authcontext-tests
 * Created: 2025-11-06
 */

/**
 * FirebaseAuthError 인터페이스
 * Firebase Auth 에러 구조를 시뮬레이션
 */
export interface FirebaseAuthError extends Error {
  code: string;
  message: string;
  name: string;
}

/**
 * Firebase Auth Error 생성 헬퍼 함수
 */
export const createFirebaseAuthError = (code: string, message: string): FirebaseAuthError => {
  const error = new Error(message) as FirebaseAuthError;
  error.code = code;
  error.name = 'FirebaseError';
  return error;
};

/**
 * 1. auth/wrong-password
 * 잘못된 비밀번호
 */
export const wrongPasswordError = createFirebaseAuthError(
  'auth/wrong-password',
  'The password is invalid or the user does not have a password.'
);

/**
 * 2. auth/user-not-found
 * 사용자를 찾을 수 없음
 */
export const userNotFoundError = createFirebaseAuthError(
  'auth/user-not-found',
  'There is no user record corresponding to this identifier.'
);

/**
 * 3. auth/invalid-email
 * 잘못된 이메일 형식
 */
export const invalidEmailError = createFirebaseAuthError(
  'auth/invalid-email',
  'The email address is badly formatted.'
);

/**
 * 4. auth/user-disabled
 * 비활성화된 사용자 계정
 */
export const userDisabledError = createFirebaseAuthError(
  'auth/user-disabled',
  'The user account has been disabled by an administrator.'
);

/**
 * 5. auth/network-request-failed
 * 네트워크 에러
 */
export const networkError = createFirebaseAuthError(
  'auth/network-request-failed',
  'A network error has occurred.'
);

/**
 * 6. auth/too-many-requests
 * 너무 많은 요청
 */
export const tooManyRequestsError = createFirebaseAuthError(
  'auth/too-many-requests',
  'We have blocked all requests from this device due to unusual activity.'
);

/**
 * 7. auth/popup-closed-by-user
 * 사용자가 팝업을 닫음
 */
export const popupClosedError = createFirebaseAuthError(
  'auth/popup-closed-by-user',
  'The popup has been closed by the user before finalizing the operation.'
);

/**
 * 8. auth/expired-action-code
 * 만료된 액션 코드
 */
export const expiredActionCodeError = createFirebaseAuthError(
  'auth/expired-action-code',
  'The action code has expired.'
);

/**
 * 9. auth/invalid-action-code
 * 잘못된 액션 코드
 */
export const invalidActionCodeError = createFirebaseAuthError(
  'auth/invalid-action-code',
  'The action code is invalid.'
);

/**
 * 10. auth/id-token-expired
 * 만료된 토큰
 */
export const tokenExpiredError = createFirebaseAuthError(
  'auth/id-token-expired',
  "The user's credential is no longer valid. The user must sign in again."
);

/**
 * 11. auth/claims-too-large
 * 클레임 페이로드가 너무 큼
 */
export const claimsTooLargeError = createFirebaseAuthError(
  'auth/claims-too-large',
  'The claims payload provided is too large.'
);

/**
 * 12. auth/app-not-initialized
 * Firebase 초기화 실패
 */
export const firebaseInitError = createFirebaseAuthError(
  'auth/app-not-initialized',
  'Firebase App has not been initialized.'
);

/**
 * 모든 테스트 에러 목록
 */
export const ALL_TEST_ERRORS = {
  wrongPassword: wrongPasswordError,
  userNotFound: userNotFoundError,
  invalidEmail: invalidEmailError,
  userDisabled: userDisabledError,
  network: networkError,
  tooManyRequests: tooManyRequestsError,
  popupClosed: popupClosedError,
  expiredActionCode: expiredActionCodeError,
  invalidActionCode: invalidActionCodeError,
  tokenExpired: tokenExpiredError,
  claimsTooLarge: claimsTooLargeError,
  firebaseInit: firebaseInitError,
} as const;

/**
 * 에러 코드 타입
 */
export type FirebaseAuthErrorCode = keyof typeof ALL_TEST_ERRORS;
