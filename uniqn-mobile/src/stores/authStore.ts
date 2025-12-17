/**
 * UNIQN Mobile - Auth Store
 *
 * @description 인증 상태 관리 (Zustand)
 * @version 1.0.0
 *
 * TODO [출시 전]: SecureStore로 민감 데이터 저장 방식 변경
 * TODO [출시 전]: 토큰 갱신 로직 구현
 * TODO [출시 전]: 세션 만료 처리 로직 추가
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User as FirebaseUser } from 'firebase/auth';
import type { UserRole } from '@/types';

// Re-export UserRole for convenience
export type { UserRole };

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

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  nickname?: string;
  phone?: string;
  role: UserRole;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

/**
 * 역할 계층 (숫자가 높을수록 상위 권한)
 * - admin: 최고 관리자
 * - manager: 매니저 (구인자 역할 포함)
 * - dealer: 딜러
 * - staff: 스태프
 * - user: 일반 사용자
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  manager: 50,
  dealer: 30,
  staff: 20,
  user: 10,
};

interface AuthState {
  // 상태
  user: AuthUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  isInitialized: boolean;
  error: string | null;

  // 계산된 값 (getter 역할)
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;

  // 액션
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  initialize: () => Promise<void>;
  checkAuthState: () => Promise<void>;
  reset: () => void;
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
  isAuthenticated: false,
  isLoading: false,
  isAdmin: false,
  isManager: false,
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
            isManager: false,
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
            isManager: false,
            isStaff: false,
          });
          return;
        }

        const roleLevel = ROLE_HIERARCHY[profile.role] ?? 0;

        set({
          profile,
          isAdmin: profile.role === 'admin',
          // manager 이상 (admin, manager)
          isManager: roleLevel >= ROLE_HIERARCHY.manager,
          // staff 이상 (admin, manager, dealer, staff)
          isStaff: roleLevel >= ROLE_HIERARCHY.staff,
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
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // 민감한 정보는 저장하지 않음
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        isInitialized: state.isInitialized,
      }),
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
export const selectIsManager = (state: AuthState) => state.isManager;
export const selectIsStaff = (state: AuthState) => state.isStaff;
export const selectAuthStatus = (state: AuthState) => state.status;
export const selectAuthError = (state: AuthState) => state.error;

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
 */
export const useHasRole = (requiredRole: UserRole) => {
  const profile = useAuthStore(selectProfile);
  if (!profile) return false;

  const userLevel = ROLE_HIERARCHY[profile.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userLevel >= requiredLevel;
};

/**
 * 권한 확인 유틸리티 함수 (훅 외부에서 사용)
 */
export function hasPermission(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

export default useAuthStore;
