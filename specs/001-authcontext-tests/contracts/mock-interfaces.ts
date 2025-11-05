/**
 * Mock Interfaces for AuthContext Testing
 *
 * Purpose: Firebase Auth Mock 인터페이스 정의
 * Feature: 001-authcontext-tests
 * Created: 2025-11-06
 */

import type {
  Auth,
  User,
  UserCredential,
  Persistence,
  AuthProvider,
  Unsubscribe,
} from 'firebase/auth';
import type { TestUser, MockIdTokenResult, FirebaseAuthError } from './test-types';

// ============================================================================
// Mock Auth Instance
// ============================================================================

/**
 * Mock Firebase Auth 인스턴스
 * 실제 Firebase Auth의 필수 메서드를 Mock으로 구현
 */
export interface MockAuth extends Partial<Auth> {
  currentUser: TestUser | null;

  // 인증 메서드
  signInWithEmailAndPassword: jest.Mock<
    Promise<UserCredential>,
    [auth: Auth, email: string, password: string]
  >;
  signOut: jest.Mock<Promise<void>, [auth: Auth]>;
  signInWithPopup: jest.Mock<
    Promise<UserCredential>,
    [auth: Auth, provider: AuthProvider]
  >;
  signInWithCustomToken: jest.Mock<
    Promise<UserCredential>,
    [auth: Auth, customToken: string]
  >;

  // 이메일 관련
  sendPasswordResetEmail: jest.Mock<
    Promise<void>,
    [auth: Auth, email: string]
  >;
  sendEmailVerification: jest.Mock<Promise<void>, [user: User]>;

  // 세션 관리
  setPersistence: jest.Mock<
    Promise<void>,
    [auth: Auth, persistence: Persistence]
  >;

  // 사용자 상태
  onAuthStateChanged: jest.Mock<
    Unsubscribe,
    [auth: Auth, callback: (user: TestUser | null) => void]
  >;
  reload: jest.Mock<Promise<void>, [user: User]>;
}

// ============================================================================
// Mock User Credential
// ============================================================================

/**
 * Mock UserCredential
 * Firebase Auth의 signIn 메서드 반환값
 */
export interface MockUserCredential extends UserCredential {
  user: TestUser & {
    getIdTokenResult: jest.Mock<Promise<MockIdTokenResult>, [forceRefresh?: boolean]>;
  };
  providerId: string | null;
  operationType: 'signIn' | 'link' | 'reauthenticate';
}

// ============================================================================
// Mock Functions
// ============================================================================

/**
 * signInWithEmailAndPassword Mock 함수 타입
 */
export type MockSignInWithEmailAndPassword = jest.Mock<
  Promise<UserCredential>,
  [auth: Auth, email: string, password: string]
>;

/**
 * signOut Mock 함수 타입
 */
export type MockSignOut = jest.Mock<Promise<void>, [auth: Auth]>;

/**
 * onAuthStateChanged Mock 함수 타입
 */
export type MockOnAuthStateChanged = jest.Mock<
  Unsubscribe,
  [auth: Auth, callback: (user: TestUser | null) => void]
>;

/**
 * getIdTokenResult Mock 함수 타입
 */
export type MockGetIdTokenResult = jest.Mock<
  Promise<MockIdTokenResult>,
  [forceRefresh?: boolean]
>;

/**
 * signInWithPopup Mock 함수 타입
 */
export type MockSignInWithPopup = jest.Mock<
  Promise<UserCredential>,
  [auth: Auth, provider: AuthProvider]
>;

/**
 * signInWithCustomToken Mock 함수 타입
 */
export type MockSignInWithCustomToken = jest.Mock<
  Promise<UserCredential>,
  [auth: Auth, customToken: string]
>;

/**
 * sendPasswordResetEmail Mock 함수 타입
 */
export type MockSendPasswordResetEmail = jest.Mock<
  Promise<void>,
  [auth: Auth, email: string]
>;

/**
 * sendEmailVerification Mock 함수 타입
 */
export type MockSendEmailVerification = jest.Mock<Promise<void>, [user: User]>;

/**
 * setPersistence Mock 함수 타입
 */
export type MockSetPersistence = jest.Mock<
  Promise<void>,
  [auth: Auth, persistence: Persistence]
>;

/**
 * reload Mock 함수 타입
 */
export type MockReload = jest.Mock<Promise<void>, [user: User]>;

// ============================================================================
// Mock Persistence
// ============================================================================

/**
 * Mock Persistence 객체
 */
export interface MockPersistence extends Persistence {
  type: 'SESSION' | 'LOCAL' | 'NONE';
}

// ============================================================================
// Mock Provider
// ============================================================================

/**
 * Mock Google Auth Provider
 */
export interface MockGoogleAuthProvider extends AuthProvider {
  providerId: 'google.com';
}

// ============================================================================
// Error Mock
// ============================================================================

/**
 * Firebase Auth Error Mock 생성 함수 타입
 */
export type CreateFirebaseAuthError = (
  code: string,
  message: string
) => FirebaseAuthError;

// ============================================================================
// Test Utility Functions
// ============================================================================

/**
 * Mock 초기화 함수 타입
 */
export type ResetMocks = () => void;

/**
 * Mock 사용자 설정 함수 타입
 */
export type SetMockUser = (user: TestUser | null) => void;

/**
 * Mock 역할 설정 함수 타입
 */
export type SetMockRole = (role: string | null) => void;

/**
 * Mock 에러 설정 함수 타입
 */
export type SetMockError = (error: FirebaseAuthError) => void;

// ============================================================================
// Export All
// ============================================================================

export type {
  Auth,
  User,
  UserCredential,
  Persistence,
  AuthProvider,
  Unsubscribe,
};
