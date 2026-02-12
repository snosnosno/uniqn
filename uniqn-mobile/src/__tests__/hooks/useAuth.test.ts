/**
 * UNIQN Mobile - useAuth Hook Tests
 *
 * @description Unit tests for authentication hook
 * @version 1.0.0
 */

import { renderHook } from '@testing-library/react-native';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser, UserProfile, AuthStatus } from '@/stores/authStore';
import type { UserRole } from '@/types';

// ============================================================================
// Mock Zustand Store
// ============================================================================

interface MockAuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  isAdmin: boolean;
  isEmployer: boolean;
  isStaff: boolean;
}

const mockAuthState: MockAuthState = {
  user: null,
  profile: null,
  status: 'idle',
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  isAdmin: false,
  isEmployer: false,
  isStaff: false,
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: MockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

// ============================================================================
// Test Utilities
// ============================================================================

function setMockAuthState(updates: Partial<MockAuthState>): void {
  Object.assign(mockAuthState, updates);
}

function resetMockAuthState(): void {
  Object.assign(mockAuthState, {
    user: null,
    profile: null,
    status: 'idle',
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    error: null,
    isAdmin: false,
    isEmployer: false,
    isStaff: false,
  });
}

function createMockUser(uid: string = 'test-uid'): AuthUser {
  return {
    uid,
    email: 'test@example.com',
    displayName: '테스트 유저',
    photoURL: null,
    emailVerified: true,
    phoneNumber: '+821012345678',
  };
}

function createMockProfile(role: UserRole): UserProfile {
  return {
    uid: 'test-uid',
    email: 'test@example.com',
    name: '테스트 유저',
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useAuth Hook', () => {
  beforeEach(() => {
    resetMockAuthState();
  });

  // ==========================================================================
  // 기본 상태 반환
  // ==========================================================================

  describe('기본 상태 반환', () => {
    it('초기 상태를 올바르게 반환해야 함', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.role).toBeNull();
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEmployer).toBe(false);
      expect(result.current.isStaff).toBe(false);
    });

    it('로딩 상태를 올바르게 반환해야 함', () => {
      setMockAuthState({
        status: 'loading',
        isLoading: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.status).toBe('loading');
      expect(result.current.isLoading).toBe(true);
    });

    it('인증 완료 상태를 올바르게 반환해야 함', () => {
      const mockUser = createMockUser();
      const mockProfile = createMockProfile('staff');

      setMockAuthState({
        user: mockUser,
        profile: mockProfile,
        status: 'authenticated',
        isAuthenticated: true,
        isInitialized: true,
        isStaff: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.status).toBe('authenticated');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.role).toBe('staff');
    });

    it('미인증 상태를 올바르게 반환해야 함', () => {
      setMockAuthState({
        status: 'unauthenticated',
        isAuthenticated: false,
        isInitialized: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isInitialized).toBe(true);
    });
  });

  // ==========================================================================
  // 사용자 정보 반환
  // ==========================================================================

  describe('사용자 정보 반환', () => {
    it('사용자 정보를 올바르게 반환해야 함', () => {
      const mockUser = createMockUser('user-123');

      setMockAuthState({
        user: mockUser,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.user?.uid).toBe('user-123');
      expect(result.current.user?.email).toBe('test@example.com');
    });

    it('프로필 정보를 올바르게 반환해야 함', () => {
      const mockProfile = createMockProfile('employer');

      setMockAuthState({
        user: createMockUser(),
        profile: mockProfile,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.profile?.role).toBe('employer');
    });

    it('role을 profile에서 추출해야 함', () => {
      const mockProfile = createMockProfile('admin');

      setMockAuthState({
        user: createMockUser(),
        profile: mockProfile,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.role).toBe('admin');
    });

    it('profile이 null이면 role도 null이어야 함', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: null,
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.role).toBeNull();
    });
  });

  // ==========================================================================
  // 역할 플래그 (isAdmin, isEmployer, isStaff)
  // ==========================================================================

  describe('역할 플래그', () => {
    it('admin 역할 플래그를 올바르게 반환해야 함', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: createMockProfile('admin'),
        isAuthenticated: true,
        isAdmin: true,
        isEmployer: true,
        isStaff: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isEmployer).toBe(true);
      expect(result.current.isStaff).toBe(true);
    });

    it('employer 역할 플래그를 올바르게 반환해야 함', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: createMockProfile('employer'),
        isAuthenticated: true,
        isAdmin: false,
        isEmployer: true,
        isStaff: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEmployer).toBe(true);
      expect(result.current.isStaff).toBe(true);
    });

    it('staff 역할 플래그를 올바르게 반환해야 함', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: createMockProfile('staff'),
        isAuthenticated: true,
        isAdmin: false,
        isEmployer: false,
        isStaff: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEmployer).toBe(false);
      expect(result.current.isStaff).toBe(true);
    });

    it('user 역할은 모든 플래그가 false여야 함', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: createMockProfile('user'),
        isAuthenticated: true,
        isAdmin: false,
        isEmployer: false,
        isStaff: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEmployer).toBe(false);
      expect(result.current.isStaff).toBe(false);
    });

    it('로그인하지 않았을 때 모든 플래그가 false여야 함', () => {
      setMockAuthState({
        user: null,
        profile: null,
        isAuthenticated: false,
        isAdmin: false,
        isEmployer: false,
        isStaff: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEmployer).toBe(false);
      expect(result.current.isStaff).toBe(false);
    });
  });

  // ==========================================================================
  // 에러 상태
  // ==========================================================================

  describe('에러 상태', () => {
    it('에러 메시지를 올바르게 반환해야 함', () => {
      setMockAuthState({
        error: '인증에 실패했습니다',
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.error).toBe('인증에 실패했습니다');
    });

    it('에러가 없을 때 null을 반환해야 함', () => {
      setMockAuthState({
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // 초기화 상태
  // ==========================================================================

  describe('초기화 상태', () => {
    it('초기화 전에는 isInitialized가 false여야 함', () => {
      setMockAuthState({
        isInitialized: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isInitialized).toBe(false);
    });

    it('초기화 후에는 isInitialized가 true여야 함', () => {
      setMockAuthState({
        isInitialized: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isInitialized).toBe(true);
    });
  });

  // ==========================================================================
  // 상태 조합 시나리오
  // ==========================================================================

  describe('상태 조합 시나리오', () => {
    it('로그인 중 상태: loading, 미인증', () => {
      setMockAuthState({
        status: 'loading',
        isLoading: true,
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.status).toBe('loading');
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('로그인 성공 상태: authenticated, user/profile 존재', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: createMockProfile('employer'),
        status: 'authenticated',
        isAuthenticated: true,
        isInitialized: true,
        isEmployer: true,
        isStaff: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.status).toBe('authenticated');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).not.toBeNull();
      expect(result.current.profile).not.toBeNull();
      expect(result.current.isEmployer).toBe(true);
    });

    it('로그아웃 상태: unauthenticated, user/profile null', () => {
      setMockAuthState({
        user: null,
        profile: null,
        status: 'unauthenticated',
        isAuthenticated: false,
        isInitialized: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.role).toBeNull();
    });

    it('에러 발생 상태: error 메시지 존재, 미인증', () => {
      setMockAuthState({
        status: 'unauthenticated',
        isAuthenticated: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다',
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다');
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  // ==========================================================================
  // 권한 계층 검증
  // ==========================================================================

  describe('권한 계층 검증', () => {
    it('admin은 모든 권한 플래그가 true여야 함', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: createMockProfile('admin'),
        isAuthenticated: true,
        isAdmin: true,
        isEmployer: true,
        isStaff: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.role).toBe('admin');
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isEmployer).toBe(true);
      expect(result.current.isStaff).toBe(true);
    });

    it('employer는 isEmployer, isStaff만 true여야 함', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: createMockProfile('employer'),
        isAuthenticated: true,
        isAdmin: false,
        isEmployer: true,
        isStaff: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.role).toBe('employer');
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEmployer).toBe(true);
      expect(result.current.isStaff).toBe(true);
    });

    it('staff는 isStaff만 true여야 함', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: createMockProfile('staff'),
        isAuthenticated: true,
        isAdmin: false,
        isEmployer: false,
        isStaff: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.role).toBe('staff');
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEmployer).toBe(false);
      expect(result.current.isStaff).toBe(true);
    });
  });

  // ==========================================================================
  // 엣지 케이스
  // ==========================================================================

  describe('엣지 케이스', () => {
    it('user는 있지만 profile이 없는 경우', () => {
      setMockAuthState({
        user: createMockUser(),
        profile: null,
        status: 'authenticated',
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).not.toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.role).toBeNull();
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEmployer).toBe(false);
      expect(result.current.isStaff).toBe(false);
    });

    it('profile은 있지만 user가 없는 경우 (비정상 상태)', () => {
      setMockAuthState({
        user: null,
        profile: createMockProfile('staff'),
        status: 'unauthenticated',
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.profile).not.toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('emailVerified가 false인 경우에도 인증 상태 유지', () => {
      const mockUser = createMockUser();
      mockUser.emailVerified = false;

      setMockAuthState({
        user: mockUser,
        profile: createMockProfile('staff'),
        status: 'authenticated',
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.emailVerified).toBe(false);
    });

    it('photoURL이 null인 경우', () => {
      const mockUser = createMockUser();
      mockUser.photoURL = null;

      setMockAuthState({
        user: mockUser,
        profile: createMockProfile('staff'),
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user?.photoURL).toBeNull();
    });

    it('displayName이 null인 경우', () => {
      const mockUser = createMockUser();
      mockUser.displayName = null;

      setMockAuthState({
        user: mockUser,
        profile: createMockProfile('staff'),
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user?.displayName).toBeNull();
    });
  });
});
