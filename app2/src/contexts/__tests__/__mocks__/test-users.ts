/**
 * Test User Presets for AuthContext Testing
 *
 * Purpose: 테스트에서 사용되는 가상 사용자 데이터 프리셋
 * Feature: 001-authcontext-tests
 * Created: 2025-11-06
 */

import type { User } from 'firebase/auth';

/**
 * TestUser 인터페이스
 * Firebase User 타입과 호환되는 테스트 사용자 데이터
 */
export interface TestUser extends Partial<User> {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  phoneNumber: string | null;
  providerId: string;
  metadata: {
    creationTime?: string;
    lastSignInTime?: string;
  };
}

/**
 * Admin User (관리자)
 *
 * 역할: admin
 * 권한: 전체 시스템 접근 가능
 */
export const mockAdminUser: TestUser = {
  uid: 'test-admin-uid',
  email: 'admin@test.com',
  displayName: 'Test Admin',
  emailVerified: true,
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-11-06T00:00:00.000Z',
  },
};

/**
 * Manager User (매니저)
 *
 * 역할: manager
 * 권한: 제한적 관리자 권한 (isAdmin=true)
 */
export const mockManagerUser: TestUser = {
  uid: 'test-manager-uid',
  email: 'manager@test.com',
  displayName: 'Test Manager',
  emailVerified: true,
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-11-06T00:00:00.000Z',
  },
};

/**
 * Regular User (일반 사용자)
 *
 * 역할: 없음
 * 권한: 기본 사용자 권한만
 */
export const mockRegularUser: TestUser = {
  uid: 'test-user-uid',
  email: 'user@test.com',
  displayName: 'Test User',
  emailVerified: true,
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-11-06T00:00:00.000Z',
  },
};

/**
 * Unverified User (미인증 사용자)
 *
 * 역할: 없음
 * 상태: 이메일 미인증 (emailVerified=false)
 */
export const mockUnverifiedUser: TestUser = {
  uid: 'test-unverified-uid',
  email: 'unverified@test.com',
  displayName: 'Unverified User',
  emailVerified: false, // ⚠️ 이메일 미인증
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-11-06T00:00:00.000Z',
  },
};

/**
 * 모든 테스트 사용자 목록
 */
export const ALL_TEST_USERS = {
  admin: mockAdminUser,
  manager: mockManagerUser,
  regular: mockRegularUser,
  unverified: mockUnverifiedUser,
} as const;
