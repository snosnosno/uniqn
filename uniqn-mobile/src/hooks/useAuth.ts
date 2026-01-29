/**
 * UNIQN Mobile - useAuth 훅
 *
 * @description 인증 상태 관련 편의 훅 (useAuthStore 래퍼)
 * @version 1.1.0
 *
 * 변경사항 (Phase 8):
 * - 역할 플래그 중복 계산 제거
 * - authStore의 계산된 값을 직접 사용 (RoleResolver 단일 소스)
 */

import {
  useAuthStore,
  type AuthUser,
  type UserProfile,
  type AuthStatus,
} from '@/stores/authStore';

// ============================================================================
// Types
// ============================================================================

interface UseAuthReturn {
  // 사용자 정보
  user: AuthUser | null;
  profile: UserProfile | null;

  // 상태
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // 권한
  role: UserProfile['role'] | null;
  isAdmin: boolean;
  isEmployer: boolean;
  isStaff: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 인증 상태 통합 훅
 *
 * @description useAuthStore의 주요 상태를 편리하게 사용할 수 있도록 래핑
 *
 * Phase 8 개선: 역할 플래그 이원화 해결
 * - 이전: useAuth에서 중복 계산 → MMKV rehydration 시 불일치 가능
 * - 이후: authStore에서 RoleResolver로 계산 → useAuth는 값만 전달
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, isEmployer } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <LoginPrompt />;
 *   }
 *
 *   return <div>Welcome, {user?.displayName}</div>;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const store = useAuthStore();

  // Phase 8: 역할 플래그는 authStore에서 RoleResolver로 계산됨
  // 여기서는 store 값을 그대로 전달 (중복 계산 제거)
  return {
    // 사용자 정보
    user: store.user,
    profile: store.profile,

    // 상태
    status: store.status,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    isInitialized: store.isInitialized,
    error: store.error,

    // 권한 (authStore에서 RoleResolver로 계산된 값 사용)
    role: store.profile?.role ?? null,
    isAdmin: store.isAdmin,
    isEmployer: store.isEmployer,
    isStaff: store.isStaff,
  };
}

export default useAuth;
