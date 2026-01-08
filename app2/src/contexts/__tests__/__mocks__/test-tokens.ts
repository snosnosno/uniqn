/**
 * Test Token Presets for AuthContext Testing
 *
 * Purpose: 역할별 ID 토큰 프리셋
 * Feature: 001-authcontext-tests
 * Created: 2025-11-06
 */

import type { IdTokenResult } from 'firebase/auth';

/**
 * MockIdTokenResult 인터페이스
 * Firebase IdTokenResult와 호환되는 테스트 토큰 데이터
 */
export interface MockIdTokenResult extends Partial<IdTokenResult> {
  token: string;
  expirationTime: string;
  authTime: string;
  issuedAtTime: string;
  signInProvider: string | null;
  claims: {
    role?: string;
    [key: string]: unknown;
  };
}

/**
 * Admin Token
 *
 * 역할: admin
 * 권한 클레임: { role: 'admin' }
 */
export const mockAdminToken: MockIdTokenResult = {
  token: 'mock-admin-token',
  expirationTime: '2025-11-07T00:00:00.000Z',
  authTime: '2025-11-06T00:00:00.000Z',
  issuedAtTime: '2025-11-06T00:00:00.000Z',
  signInProvider: 'password',
  claims: {
    role: 'admin',
    aud: 'test-project',
    sub: 'test-admin-uid',
  },
};

/**
 * Employer Token
 *
 * 역할: employer
 * 권한 클레임: { role: 'employer' }
 */
export const mockEmployerToken: MockIdTokenResult = {
  token: 'mock-employer-token',
  expirationTime: '2025-11-07T00:00:00.000Z',
  authTime: '2025-11-06T00:00:00.000Z',
  issuedAtTime: '2025-11-06T00:00:00.000Z',
  signInProvider: 'password',
  claims: {
    role: 'employer',
    aud: 'test-project',
    sub: 'test-employer-uid',
  },
};

/**
 * No Role Token (역할 없음)
 *
 * 역할: 없음
 * 권한 클레임: role 필드 없음
 */
export const mockNoRoleToken: MockIdTokenResult = {
  token: 'mock-no-role-token',
  expirationTime: '2025-11-07T00:00:00.000Z',
  authTime: '2025-11-06T00:00:00.000Z',
  issuedAtTime: '2025-11-06T00:00:00.000Z',
  signInProvider: 'password',
  claims: {
    // role 없음
    aud: 'test-project',
    sub: 'test-user-uid',
  },
};

/**
 * 모든 테스트 토큰 목록
 */
export const ALL_TEST_TOKENS = {
  admin: mockAdminToken,
  employer: mockEmployerToken,
  noRole: mockNoRoleToken,
} as const;
