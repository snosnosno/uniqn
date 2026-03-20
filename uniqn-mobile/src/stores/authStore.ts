/**
 * UNIQN Mobile - Auth Store
 *
 * @description ?몄쬆 ?곹깭 愿由?(Zustand + MMKV)
 * @version 1.2.0
 *
 * 蹂寃쎌궗??
 * - AsyncStorage ??MMKV濡?留덉씠洹몃젅?댁뀡 (30諛?鍮좊쫫)
 * - ???좏겙 ??? sessionService + secureStorage (expo-secure-store)
 * - ???좏겙 媛깆떊: sessionService.refreshToken()
 * - ???몄뀡 留뚮즺: sessionService.expireSession()
 *
 * 李멸퀬:
 * - ???ㅽ넗?대뒗 user/profile ?뺣낫留????(誘쇨컧?섏? ?딆쓬)
 * - ?몄쬆 ?좏겙? Firebase Auth媛 ?대? 愿由?+ sessionService媛 SecureStore??諛깆뾽
 * - 濡쒓렇???쒕룄 ?잛닔 ??蹂댁븞 ?곗씠?곕뒗 secureStorage ?ъ슜
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authStateStorage } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';
import { User as FirebaseUser } from 'firebase/auth';
import type { UserRole, UserProfile } from '@/types';
import type { AuthUser, AuthStatus } from '@/types/auth';
import { RoleResolver } from '@/shared/role';
import { RealtimeManager } from '@/shared/realtime';
import { clearCounterSyncCache } from '@/shared/cache/counterSyncCache';

export type { UserRole, UserProfile };
// AuthUser, AuthStatus???뺣낯(SSOT)? types/auth.ts
export type { AuthUser, AuthStatus } from '@/types/auth';

// ============================================================================
// Types
// ============================================================================

interface AuthState {
  // ?곹깭
  user: AuthUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  isInitialized: boolean;
  error: string | null;
  _hasHydrated: boolean; // AsyncStorage?먯꽌 蹂듭썝 ?꾨즺 ?щ?

  // 怨꾩궛??媛?(getter ??븷)
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isEmployer: boolean; // 援ъ씤???댁긽 沅뚰븳
  isStaff: boolean;

  // ?≪뀡
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  initialize: () => Promise<void>;
  checkAuthState: () => Promise<void>;
  reset: () => void;
  /** ?먮룞 濡쒓렇??鍮꾪솢?깊솕 ???ъ슜 - Firebase 濡쒓렇?꾩썐 ?놁씠 UI ?곹깭留?珥덇린??*/
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

      // Firebase User -> AuthUser 蹂??諛????
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

      // ?ъ슜???꾨줈???ㅼ젙 (Firestore?먯꽌 媛?몄삩 異붽? ?뺣낫)
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

        // Phase 8: RoleResolver濡???븷 ?뚮옒洹?怨꾩궛 ?듯빀 (?댁썝???닿껐)
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

      // ??珥덇린??????λ맂 ?몄쬆 ?곹깭 蹂듭썝
      initialize: async () => {
        const state = get();
        // persist 誘몃뱾?⑥뼱媛 ?먮룞?쇰줈 蹂듭썝?섎?濡??ш린?쒕뒗 珥덇린???꾨즺留??쒖떆
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

      // Firebase Auth ?곹깭 ?뺤씤 (???ш컻 ??
      checkAuthState: async () => {
        // Firebase Auth 由ъ뒪?덇? 泥섎━?섎?濡??ш린?쒕뒗 ?곹깭留??뺤씤
        // ?ㅼ젣 援ы쁽? useAuth ?낆씠??AuthService?먯꽌 ?대떦
        const state = get();
        if (!state.isInitialized) {
          await get().initialize();
        }
      },

      // 濡쒓렇?꾩썐 ???곹깭 珥덇린??
      reset: () => {
        set(initialState);
      },

      // ?먮룞 濡쒓렇??鍮꾪솢?깊솕 ???ъ슜 - Firebase 濡쒓렇?꾩썐 ?놁씠 UI ?곹깭留?珥덇린??
      // Firebase Auth ?몄뀡? ?좎??섎?濡??ㅼ쓬 濡쒓렇????鍮좊Ⅴ寃?蹂듭썝 媛??
      clearAuthState: () => {
        // Firestore ?ㅼ떆媛?由ъ뒪???댁젣 (?곗씠???섏떊 李⑤떒)
        RealtimeManager.unsubscribeAll();
        // ?꾩뿭 罹먯떆 ?뺣━
        clearCounterSyncCache();

        set({
          user: null,
          profile: null,
          status: 'unauthenticated',
          isAuthenticated: false,
          isAdmin: false,
          isEmployer: false,
          isStaff: false,
          isInitialized: true, // 珥덇린?붾뒗 ?꾨즺???곹깭
          error: null,
        });
        logger.info('?먮룞 濡쒓렇??鍮꾪솢?깊솕 - ?몄쬆 ?곹깭 珥덇린??(由ъ뒪??罹먯떆 ?뺣━ ?꾨즺)', {
          component: 'authStore',
        });
      },
    }),
    {
      name: 'auth-storage',
      // Web keeps auth shell state in sessionStorage, while native keeps MMKV-backed persistence.
      storage: createJSONStorage(() => authStateStorage),
      // 誘쇨컧???뺣낫????ν븯吏 ?딆쓬
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        isInitialized: state.isInitialized,
      }),
      // MMKV?먯꽌 ?곗씠??蹂듭썝 ?꾨즺 ???몄텧
      onRehydrateStorage: () => (state) => {
        // ?좑툘 以묒슂: partialize?먯꽌 isAdmin/isEmployer/isStaff????ν븯吏 ?딆쑝誘濡?        // 蹂듭썝??profile??湲곕컲?쇰줈 ??븷 ?뚮옒洹??ш퀎???꾩슂
        // Phase 8: RoleResolver.computeRoleFlags濡??듯빀 (?댁썝???닿껐)
        //
        // NOTE: ?숆린?곸쑝濡?setState ?몄텧 (queueMicrotask ?쒓굅)
        // - queueMicrotask ?ъ슜 ??useAppInitialize??setProfile()怨??덉씠??而⑤뵒??諛쒖깮
        // - microtask媛 setProfile() ?댄썑???ㅽ뻾?섎㈃ 理쒖떊 roleFlags瑜???뼱?곕뒗 踰꾧렇
        // - Zustand setState??React ?몃? ?몄텧?대?濡??숆린 ?몄텧 ?덉쟾
        if (state?.profile) {
          const roleFlags = RoleResolver.computeRoleFlags(state.profile.role);
          // ?⑥씪 setState濡??먯옄???낅뜲?댄듃 (以묎컙 ?곹깭 ?몄텧 諛⑹?)
          useAuthStore.setState({
            ...roleFlags,
            isAuthenticated: !!state.user,
            _hasHydrated: true,
          });
          logger.debug('AuthStore rehydration role flags recalculated', {
            component: 'AuthStore',
            role: state.profile?.role,
            ...roleFlags,
          });
        } else {
          // profile???놁뼱??hydration ?꾨즺 ?쒖떆
          useAuthStore.setState({ _hasHydrated: true });
        }
      },
    }
  )
);

// ============================================================================
// Selectors (?깅뒫 理쒖쟻?붾? ?꾪븳 ?좏깮??
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
 * ?몄쬆 ?곹깭留?媛?몄삤湲?(?먯＜ ?ъ슜)
 */
export const useIsAuthenticated = () => useAuthStore(selectIsAuthenticated);

/**
 * ?ъ슜???뺣낫留?媛?몄삤湲? */
export const useUser = () => useAuthStore(selectUser);

/**
 * ?꾨줈???뺣낫留?媛?몄삤湲? */
export const useProfile = () => useAuthStore(selectProfile);

/**
 * ??븷 湲곕컲 沅뚰븳 泥댄겕
 *
 * Phase 8: RoleResolver.hasPermission ?ъ슜 (?댁썝???닿껐)
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
 * Hydration ?꾨즺 ?곹깭 ?? */
export const useHasHydrated = () => useAuthStore(selectHasHydrated);

/**
 * Hydration ?꾨즺 ?湲??좏떥由ы떚
 * AsyncStorage?먯꽌 ?곗씠??蹂듭썝???꾨즺???뚭퉴吏 ?湲? *
 * @param timeout - 理쒕? ?湲??쒓컙 (ms), 湲곕낯媛?5000ms
 * @returns Promise<boolean> - 蹂듭썝 ?꾨즺 ?щ?
 *
 * @example
 * ```ts
 * // ??珥덇린???? * const hydrated = await waitForHydration();
 * if (hydrated) {
 *   // 蹂듭썝???곹깭濡??묒뾽 ?섑뻾
 * }
 * ```
 */
export async function waitForHydration(timeout = 5000): Promise<boolean> {
  // ?대? hydrated??寃쎌슦 利됱떆 諛섑솚
  if (useAuthStore.getState()._hasHydrated) {
    return true;
  }

  // hydration ?꾨즺 ?湲?
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
