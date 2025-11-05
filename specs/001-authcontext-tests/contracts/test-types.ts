/**
 * Test Types for AuthContext Testing
 *
 * Purpose: TypeScript 타입 정의 for AuthContext 테스트
 * Feature: 001-authcontext-tests
 * Created: 2025-11-06
 */

import type { User as FirebaseUser, UserCredential, IdTokenResult } from 'firebase/auth';

// ============================================================================
// User Types
// ============================================================================

/**
 * 테스트 사용자 인터페이스
 * Firebase User를 시뮬레이션하는 테스트용 데이터 구조
 */
export interface TestUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  phoneNumber: string | null;
  providerId: string;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}

/**
 * 역할(Role) 타입
 * UNIQN 시스템에서 사용되는 사용자 역할
 */
export type UserRole = 'admin' | 'manager' | null;

/**
 * 확장된 User 인터페이스 (AuthContext와 동일)
 */
export interface ExtendedUser extends FirebaseUser {
  region?: string;
}

// ============================================================================
// Token & Claims Types
// ============================================================================

/**
 * Mock ID Token Result
 * Firebase Auth의 getIdTokenResult() 반환값을 시뮬레이션
 */
export interface MockIdTokenResult {
  token: string;
  expirationTime: string;
  authTime: string;
  issuedAtTime: string;
  signInProvider: string;
  claims: {
    role?: UserRole;
    [key: string]: unknown;
  };
}

/**
 * 실제 Firebase IdTokenResult 타입 (참조용)
 */
export type FirebaseIdTokenResult = IdTokenResult;

// ============================================================================
// Error Types
// ============================================================================

/**
 * Firebase Auth Error 인터페이스
 * Firebase Auth에서 발생하는 에러 구조
 */
export interface FirebaseAuthError {
  code: string;
  message: string;
  name?: string;
  stack?: string;
}

/**
 * Firebase Auth Error Codes
 * 테스트에서 시뮬레이션할 에러 코드 목록
 */
export type FirebaseAuthErrorCode =
  | 'auth/wrong-password'
  | 'auth/user-not-found'
  | 'auth/invalid-email'
  | 'auth/user-disabled'
  | 'auth/network-request-failed'
  | 'auth/too-many-requests'
  | 'auth/popup-closed-by-user'
  | 'auth/expired-action-code'
  | 'auth/invalid-action-code'
  | 'auth/id-token-expired'
  | 'auth/claims-too-large'
  | 'auth/app-not-initialized';

// ============================================================================
// Auth Context Types
// ============================================================================

/**
 * AuthContext 타입 (프로덕션 코드와 동일)
 */
export interface AuthContextType {
  currentUser: ExtendedUser | null;
  loading: boolean;
  isAdmin: boolean;
  role: UserRole;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<UserCredential>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<UserCredential>;
  signInWithKakao: (kakaoToken: string, userInfo: unknown) => Promise<UserCredential>;
  sendEmailVerification: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

// ============================================================================
// Test Scenario Types
// ============================================================================

/**
 * 로그인 시나리오 데이터
 */
export interface LoginScenario {
  email: string;
  password: string;
  expectedUser?: TestUser;
  expectedRole?: UserRole;
  expectedIsAdmin?: boolean;
  expectedError?: FirebaseAuthError;
}

/**
 * 로그아웃 시나리오 데이터
 */
export interface LogoutScenario {
  initialUser: TestUser;
  expectedUserAfterLogout: null;
  expectedRoleAfterLogout: null;
  expectedIsAdminAfterLogout: false;
}

/**
 * 역할 검증 시나리오 데이터
 */
export interface RoleVerificationScenario {
  user: TestUser;
  token: MockIdTokenResult;
  expectedRole: UserRole;
  expectedIsAdmin: boolean;
}

/**
 * 세션 지속성 시나리오 데이터
 */
export interface SessionPersistenceScenario {
  rememberMe: boolean;
  expectedPersistence: 'local' | 'session';
  expectedStorageKey: string;
  expectedStorageValue: string;
}

// ============================================================================
// Test Helper Types
// ============================================================================

/**
 * 테스트 래퍼 Props
 */
export interface TestWrapperProps {
  children: React.ReactNode;
}

/**
 * Render Hook 옵션
 */
export interface RenderHookOptions<Props> {
  wrapper?: React.ComponentType<Props>;
  initialProps?: Props;
}

/**
 * Mock Function 타입
 */
export type MockFunction<T = any> = jest.Mock<T>;

// ============================================================================
// Export All Types
// ============================================================================

export type {
  FirebaseUser,
  UserCredential,
  IdTokenResult,
};
