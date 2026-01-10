/**
 * UNIQN Mobile - useAuth 훅
 *
 * @description 인증 상태 관련 편의 훅 (useAuthStore 래퍼)
 * @version 1.0.0
 */

import {
  useAuthStore,
  ROLE_HIERARCHY,
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

  // ⚠️ 중요: store.isAdmin 등은 MMKV rehydration 후 업데이트가 지연될 수 있으므로
  // profile.role에서 직접 계산하여 항상 정확한 값을 반환
  const role = store.profile?.role ?? null;
  const roleLevel = role ? (ROLE_HIERARCHY[role] ?? 0) : 0;

  return {
    // 사용자 정보
    user: store.user,
    profile: store.profile,

    // 상태
    status: store.status,
    isAuthenticated: store.isAuthenticated || !!store.user,
    isLoading: store.isLoading,
    isInitialized: store.isInitialized,
    error: store.error,

    // 권한 (profile.role에서 직접 계산)
    role,
    isAdmin: role === 'admin',
    isEmployer: roleLevel >= ROLE_HIERARCHY.employer,
    isStaff: roleLevel >= ROLE_HIERARCHY.staff,
  };
}

export default useAuth;
