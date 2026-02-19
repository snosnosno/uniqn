/**
 * UNIQN Mobile - Auth Store
 *
 * @description 인증 상태 관리 (Zustand + MMKV)
 * @version 1.2.0
 *
 * 변경사항:
 * - AsyncStorage → MMKV로 마이그레이션 (30배 빠름)
 * - ✅ 토큰 저장: sessionService + secureStorage (expo-secure-store)
 * - ✅ 토큰 갱신: sessionService.refreshToken()
 * - ✅ 세션 만료: sessionService.expireSession()
 *
 * 참고:
 * - 이 스토어는 user/profile 정보만 저장 (민감하지 않음)
 * - 인증 토큰은 Firebase Auth가 내부 관리 + sessionService가 SecureStore에 백업
 * - 로그인 시도 횟수 등 보안 데이터는 secureStorage 사용
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';
import { User as FirebaseUser } from 'firebase/auth';
import type { UserRole, UserProfile } from '@/types';
import { RoleResolver } from '@/shared/role';

export type { UserRole, UserProfile };

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  // 상태
  user: AuthUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  isInitialized: boolean;
  error: string | null;
  _hasHydrated: boolean; // AsyncStorage에서 복원 완료 여부

  // 계산된 값 (getter 역할)
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isEmployer: boolean; // 구인자 이상 권한
  isStaff: boolean;

  // 액션
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  initialize: () => Promise<void>;
  checkAuthState: () => Promise<void>;
  reset: () => void;
  /** 자동 로그인 비활성화 시 사용 - Firebase 로그아웃 없이 UI 상태만 초기화 */
  clearAuthState: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  user: null,
  profile: null,
  status: 'idle' as AuthStatus,
  isInitialized: false,
  error: null,
  _hasHydrated: false,
  isAuthenticated: false,
  isLoading: false,
  isAdmin: false,
  isEmployer: false,
  isStaff: false,
};

// ============================================================================
// Store
// ============================================================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Firebase User -> AuthUser 변환 및 저장
      setUser: (firebaseUser: FirebaseUser | null) => {
        if (!firebaseUser) {
          set({
            user: null,
            status: 'unauthenticated',
            isAuthenticated: false,
            isAdmin: false,
            isEmployer: false,
            isStaff: false,
          });
          return;
        }

        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          phoneNumber: firebaseUser.phoneNumber,
        };

        set({
          user: authUser,
          status: 'authenticated',
          isAuthenticated: true,
          error: null,
        });
      },

      // 사용자 프로필 설정 (Firestore에서 가져온 추가 정보)
      setProfile: (profile: UserProfile | null) => {
        if (!profile) {
          set({
            profile: null,
            isAdmin: false,
            isEmployer: false,
            isStaff: false,
          });
          return;
        }

        // Phase 8: RoleResolver로 역할 플래그 계산 통합 (이원화 해결)
        const roleFlags = RoleResolver.computeRoleFlags(profile.role);

        set({
          profile,
          ...roleFlags,
        });
      },

      setStatus: (status: AuthStatus) => {
        set({
          status,
          isLoading: status === 'loading',
        });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      setInitialized: (initialized: boolean) => {
        set({ isInitialized: initialized });
      },

      setHasHydrated: (hasHydrated: boolean) => {
        set({ _hasHydrated: hasHydrated });
      },

      // 앱 초기화 시 저장된 인증 상태 복원
      initialize: async () => {
        const state = get();
        // persist 미들웨어가 자동으로 복원하므로 여기서는 초기화 완료만 표시
        if (state.user) {
          set({
            status: 'authenticated',
            isAuthenticated: true,
            isInitialized: true,
          });
        } else {
          set({
            status: 'unauthenticated',
            isAuthenticated: false,
            isInitialized: true,
          });
        }
      },

      // Firebase Auth 상태 확인 (앱 재개 시)
      checkAuthState: async () => {
        // Firebase Auth 리스너가 처리하므로 여기서는 상태만 확인
        // 실제 구현은 useAuth 훅이나 AuthService에서 담당
        const state = get();
        if (!state.isInitialized) {
          await get().initialize();
        }
      },

      // 로그아웃 시 상태 초기화
      reset: () => {
        set(initialState);
      },

      // 자동 로그인 비활성화 시 사용 - Firebase 로그아웃 없이 UI 상태만 초기화
      // Firebase Auth 세션은 유지되므로 다음 로그인 시 빠르게 복원 가능
      clearAuthState: () => {
        set({
          user: null,
          profile: null,
          status: 'unauthenticated',
          isAuthenticated: false,
          isAdmin: false,
          isEmployer: false,
          isStaff: false,
          isInitialized: true, // 초기화는 완료된 상태
          error: null,
        });
        logger.info('자동 로그인 비활성화 - 인증 상태 초기화', { component: 'authStore' });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      // 민감한 정보는 저장하지 않음
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        isInitialized: state.isInitialized,
      }),
      // MMKV에서 데이터 복원 완료 시 호출
      onRehydrateStorage: () => (state) => {
        // ⚠️ 중요: partialize에서 isAdmin/isEmployer/isStaff는 저장하지 않으므로
        // 복원된 profile을 기반으로 역할 플래그 재계산 필요
        // Phase 8: RoleResolver.computeRoleFlags로 통합 (이원화 해결)
        //
        // NOTE: 동기적으로 setState 호출 (queueMicrotask 제거)
        // - queueMicrotask 사용 시 useAppInitialize의 setProfile()과 레이스 컨디션 발생
        // - microtask가 setProfile() 이후에 실행되면 최신 roleFlags를 덮어쓰는 버그
        // - Zustand setState는 React 외부 호출이므로 동기 호출 안전
        if (state?.profile) {
          const roleFlags = RoleResolver.computeRoleFlags(state.profile.role);
          // 단일 setState로 원자적 업데이트 (중간 상태 노출 방지)
          useAuthStore.setState({
            ...roleFlags,
            isAuthenticated: !!state.user,
            _hasHydrated: true,
          });
          logger.debug('AuthStore Rehydration - 역할 플래그 재계산', {
            component: 'AuthStore',
            role: state.profile?.role,
            ...roleFlags,
          });
        } else {
          // profile이 없어도 hydration 완료 표시
          useAuthStore.setState({ _hasHydrated: true });
        }
      },
    }
  )
);

// ============================================================================
// Selectors (성능 최적화를 위한 선택자)
// ============================================================================

export const selectUser = (state: AuthState) => state.user;
export const selectProfile = (state: AuthState) => state.profile;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectIsAdmin = (state: AuthState) => state.isAdmin;
export const selectIsEmployer = (state: AuthState) => state.isEmployer;
export const selectIsStaff = (state: AuthState) => state.isStaff;
export const selectAuthStatus = (state: AuthState) => state.status;
export const selectAuthError = (state: AuthState) => state.error;
export const selectHasHydrated = (state: AuthState) => state._hasHydrated;

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * 인증 상태만 가져오기 (자주 사용)
 */
export const useIsAuthenticated = () => useAuthStore(selectIsAuthenticated);

/**
 * 사용자 정보만 가져오기
 */
export const useUser = () => useAuthStore(selectUser);

/**
 * 프로필 정보만 가져오기
 */
export const useProfile = () => useAuthStore(selectProfile);

/**
 * 역할 기반 권한 체크
 *
 * Phase 8: RoleResolver.hasPermission 사용 (이원화 해결)
 */
export const useHasRole = (requiredRole: UserRole) => {
  const profile = useAuthStore(selectProfile);
  if (!profile) return false;

  return RoleResolver.hasPermission(profile.role, requiredRole);
};

// ============================================================================
// Hydration Utilities
// ============================================================================

/**
 * Hydration 완료 상태 훅
 */
export const useHasHydrated = () => useAuthStore(selectHasHydrated);

/**
 * Hydration 완료 대기 유틸리티
 * AsyncStorage에서 데이터 복원이 완료될 때까지 대기
 *
 * @param timeout - 최대 대기 시간 (ms), 기본값 5000ms
 * @returns Promise<boolean> - 복원 완료 여부
 *
 * @example
 * ```ts
 * // 앱 초기화 시
 * const hydrated = await waitForHydration();
 * if (hydrated) {
 *   // 복원된 상태로 작업 수행
 * }
 * ```
 */
export async function waitForHydration(timeout = 5000): Promise<boolean> {
  // 이미 hydrated인 경우 즉시 반환
  if (useAuthStore.getState()._hasHydrated) {
    return true;
  }

  // hydration 완료 대기
  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeout);

    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state._hasHydrated) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

export default useAuthStore;
