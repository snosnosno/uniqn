import { User as FirebaseUser } from 'firebase/auth';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { syncSignOut } from '@/lib/authBridge';
import { clearCurrentAutoLoginSession } from '@/lib/autoLoginSession';
import { getFirebaseAuth } from '@/lib/firebase';
import { authStateStorage } from '@/lib/mmkvStorage';
import { settingsStorage } from '@/lib/secureStorage';
import { getUserProfile } from '@/services/auth/userProfileService';
import { isPhoneOnlySignupFirebaseUser } from '@/shared/auth/sessionState';
import { clearCriticalOfflineCacheForUser } from '@/services/offline/criticalOfflineCache';
import { clearCounterSyncCache } from '@/shared/cache/counterSyncCache';
import { RoleResolver } from '@/shared/role';
import { RealtimeManager } from '@/shared/realtime';
import type { UserRole, UserProfile } from '@/types';
import type { AuthStatus, AuthUser } from '@/types/auth';
import { setUserId, trackLogout } from '@/services/observability/analyticsService';
import { toStoreProfile } from '@/utils/profileConverter';
import { logger } from '@/utils/logger';

export type { UserRole, UserProfile };
export type { AuthUser, AuthStatus } from '@/types/auth';

type BootstrapSource = 'none' | 'cache' | 'server';

interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  isInitialized: boolean;
  error: string | null;
  _hasHydrated: boolean;
  needsServerReconcile: boolean;
  bootstrapSource: BootstrapSource;
  lastScopedUserId: string | null;
  suppressedSessionUserId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isEmployer: boolean;
  isStaff: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setNeedsServerReconcile: (needsServerReconcile: boolean) => void;
  setBootstrapSource: (source: BootstrapSource) => void;
  initialize: () => Promise<void>;
  checkAuthState: (firebaseUser?: FirebaseUser | null) => Promise<void>;
  reset: () => void;
  clearAuthUiState: (preserveUserId?: string | null) => void;
  clearAuthState: () => void;
}

const initialState = {
  user: null,
  profile: null,
  status: 'idle' as AuthStatus,
  isInitialized: false,
  error: null,
  _hasHydrated: false,
  needsServerReconcile: false,
  bootstrapSource: 'none' as BootstrapSource,
  lastScopedUserId: null,
  suppressedSessionUserId: null,
  isAuthenticated: false,
  isLoading: false,
  isAdmin: false,
  isEmployer: false,
  isStaff: false,
};

let authStoreSet:
  | ((
      partial:
        | AuthState
        | Partial<AuthState>
        | ((state: AuthState) => AuthState | Partial<AuthState>),
      replace?: false
    ) => void)
  | null = null;

function buildPersistedRoleFlags(profile: UserProfile | null) {
  if (!profile) {
    return {
      isAdmin: false,
      isEmployer: false,
      isStaff: false,
    };
  }

  return RoleResolver.computeRoleFlags(profile.role);
}

export function applyPersistedAuthRehydration(
  state?: Pick<AuthState, 'user' | 'profile'> | null,
  error?: unknown
) {
  const roleFlags = buildPersistedRoleFlags(state?.profile ?? null);

  authStoreSet?.({
    ...roleFlags,
    isAuthenticated: Boolean(state?.user),
    _hasHydrated: true,
  });

  if (error) {
    logger.warn('AuthStore rehydration completed with fallback state', {
      component: 'AuthStore',
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (state?.profile) {
    logger.debug('AuthStore rehydration role flags recalculated', {
      component: 'AuthStore',
      role: state.profile.role,
      ...roleFlags,
    });
  } else {
    logger.debug('AuthStore rehydration completed without persisted profile', {
      component: 'AuthStore',
      hasUser: Boolean(state?.user),
    });
  }
}

function createAuthPersistOptions() {
  return {
    name: 'auth-storage',
    storage: createJSONStorage(() => authStateStorage),
    partialize: (state: AuthState) => ({
      user: state.user,
      profile: state.profile,
      isInitialized: state.isInitialized,
      needsServerReconcile: state.needsServerReconcile,
      bootstrapSource: state.bootstrapSource,
      lastScopedUserId: state.lastScopedUserId,
      suppressedSessionUserId: state.suppressedSessionUserId,
    }),
    onRehydrateStorage: () => (state?: AuthState, error?: unknown) =>
      applyPersistedAuthRehydration(state, error),
  };
}

function clearScopedRuntimeState() {
  RealtimeManager.unsubscribeAll();
  clearCounterSyncCache();
}

function clearScopedOfflineCache(userId?: string | null) {
  if (!userId) {
    return;
  }

  clearCriticalOfflineCacheForUser(userId);
}

function clearScopedOfflineState(userId?: string | null) {
  clearScopedRuntimeState();
  clearScopedOfflineCache(userId);
}

function resolveScopedUserId(
  state: Pick<AuthState, 'lastScopedUserId' | 'user' | 'profile'>
): string | null {
  return state.lastScopedUserId ?? state.user?.uid ?? state.profile?.uid ?? null;
}

function toAuthUser(firebaseUser: FirebaseUser): AuthUser {
  const providerIds =
    firebaseUser.providerData
      ?.map((provider) => provider.providerId)
      .filter((providerId): providerId is string => Boolean(providerId)) ?? [];

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    phoneNumber: firebaseUser.phoneNumber,
    providerIds,
  };
}

function isExplicitSnapshotStale(firebaseUser: FirebaseUser | null | undefined): boolean {
  if (firebaseUser === undefined) {
    return false;
  }

  const liveUser = getFirebaseAuth().currentUser;

  if (!firebaseUser) {
    return Boolean(liveUser);
  }

  return !liveUser || liveUser.uid !== firebaseUser.uid;
}

async function clearRejectedServerSession(get: () => AuthState, uid: string) {
  logger.warn('Profile document missing for authenticated user, clearing session', {
    component: 'authStore',
    uid,
  });

  try {
    await syncSignOut();
  } catch (error) {
    logger.warn('Failed to fully sign out rejected session', {
      component: 'authStore',
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    get().clearAuthState();
  }
}

async function clearAutoLoginBlockedSession(get: () => AuthState, uid: string) {
  logger.info('Signing out restored Firebase session because auto login is disabled', {
    component: 'authStore',
    uid,
  });

  try {
    await syncSignOut();
  } catch (error) {
    logger.warn('Failed to sign out restored session while auto login is disabled', {
      component: 'authStore',
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    trackLogout();
    await setUserId(null);
    get().clearAuthState();
  }
}

export const useAuthStore = create<AuthState>()(
  persist((set, get) => {
    authStoreSet = set;

    return {
      ...initialState,

      setUser: (firebaseUser) => {
        const previousUserId = resolveScopedUserId(get());

        if (!firebaseUser) {
          clearScopedOfflineState(previousUserId);
          clearCurrentAutoLoginSession();
          set({
            user: null,
            status: 'unauthenticated',
            isAuthenticated: false,
            isLoading: false,
            isAdmin: false,
            isEmployer: false,
            isStaff: false,
            needsServerReconcile: false,
            bootstrapSource: 'none',
            lastScopedUserId: null,
            suppressedSessionUserId: null,
          });
          return;
        }

        if (previousUserId && previousUserId !== firebaseUser.uid) {
          clearScopedOfflineState(previousUserId);
        }

        set({
          user: toAuthUser(firebaseUser),
          status: 'authenticated',
          isAuthenticated: true,
          isLoading: false,
          error: null,
          lastScopedUserId: firebaseUser.uid,
          suppressedSessionUserId: null,
        });
      },

      setProfile: (profile) => {
        if (!profile) {
          set({
            profile: null,
            isAdmin: false,
            isEmployer: false,
            isStaff: false,
          });
          return;
        }

        const roleFlags = RoleResolver.computeRoleFlags(profile.role);

        set({
          profile,
          ...roleFlags,
        });
      },

      setStatus: (status) => {
        set({
          status,
          isLoading: status === 'loading',
        });
      },

      setError: (error) => {
        set({ error });
      },

      setInitialized: (initialized) => {
        set({ isInitialized: initialized });
      },

      setHasHydrated: (hasHydrated) => {
        set({ _hasHydrated: hasHydrated });
      },

      setNeedsServerReconcile: (needsServerReconcile) => {
        set({ needsServerReconcile });
      },

      setBootstrapSource: (bootstrapSource) => {
        set({ bootstrapSource });
      },

      initialize: async () => {
        const state = get();

        if (state.user) {
          set({
            status: 'authenticated',
            isAuthenticated: true,
            isInitialized: true,
            lastScopedUserId: state.user.uid,
          });
        } else {
          set({
            status: 'unauthenticated',
            isAuthenticated: false,
            isInitialized: true,
            lastScopedUserId: state.lastScopedUserId ?? state.profile?.uid ?? null,
          });
        }
      },

      checkAuthState: async (firebaseUser?: FirebaseUser | null) => {
        let state = get();
        if (!state.isInitialized) {
          await get().initialize();
          state = get();
        }

        const hasExplicitAuthSnapshot = firebaseUser !== undefined;
        const currentUser = hasExplicitAuthSnapshot ? firebaseUser : getFirebaseAuth().currentUser;

        if (hasExplicitAuthSnapshot && isExplicitSnapshotStale(firebaseUser)) {
          logger.debug('Ignored stale auth snapshot', {
            component: 'authStore',
            snapshotUid: firebaseUser?.uid ?? null,
            liveUid: getFirebaseAuth().currentUser?.uid ?? null,
          });
          return;
        }

        if (!currentUser) {
          if (!hasExplicitAuthSnapshot) {
            if (!state.user && !state.profile && state.status === 'unauthenticated') {
              set({
                status: 'unauthenticated',
                isAuthenticated: false,
                isLoading: false,
                isInitialized: true,
                needsServerReconcile: false,
                bootstrapSource: 'none',
                error: null,
              });
            } else {
              logger.debug('Skipped clearing auth state while Firebase auth is still settling', {
                component: 'authStore',
                status: state.status,
                hasUser: Boolean(state.user),
                hasProfile: Boolean(state.profile),
              });

              set({
                isInitialized: true,
                isLoading: false,
                error: null,
              });
            }
            return;
          }

          if (state.user || state.profile || state.status !== 'unauthenticated') {
            get().clearAuthState();
          } else {
            set({
              status: 'unauthenticated',
              isAuthenticated: false,
              isLoading: false,
              isInitialized: true,
              needsServerReconcile: false,
              bootstrapSource: 'none',
              error: null,
            });
          }
          return;
        }

        let autoLoginEnabled = true;
        try {
          autoLoginEnabled = await settingsStorage.isAutoLoginEnabled();
        } catch (error) {
          logger.warn('Failed to read auto login preference during auth sync', {
            component: 'authStore',
            uid: currentUser.uid,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (hasExplicitAuthSnapshot && isExplicitSnapshotStale(firebaseUser)) {
          logger.debug('Ignored stale auth snapshot after auto login check', {
            component: 'authStore',
            snapshotUid: firebaseUser?.uid ?? null,
            liveUid: getFirebaseAuth().currentUser?.uid ?? null,
          });
          return;
        }

        if (
          hasExplicitAuthSnapshot &&
          !autoLoginEnabled &&
          state.suppressedSessionUserId === currentUser.uid &&
          !state.user &&
          !state.profile &&
          state.status === 'unauthenticated'
        ) {
          await clearAutoLoginBlockedSession(get, currentUser.uid);
          return;
        }

        const isDifferentUser = state.user?.uid !== currentUser.uid;
        const shouldRefreshProfile =
          isDifferentUser || !state.profile || state.profile.uid !== currentUser.uid;

        if (state.profile?.uid && state.profile.uid !== currentUser.uid) {
          get().setProfile(null);
        }

        get().setUser(currentUser);

        if (!shouldRefreshProfile) {
          set({
            isInitialized: true,
            isLoading: false,
            error: null,
          });
          return;
        }

        try {
          const profile = await getUserProfile(currentUser.uid);
          const liveUser = getFirebaseAuth().currentUser;

          if (!liveUser || liveUser.uid !== currentUser.uid) {
            logger.debug('Ignored stale auth profile response', {
              component: 'authStore',
              requestedUid: currentUser.uid,
              liveUid: liveUser?.uid ?? null,
            });
            return;
          }

          if (profile) {
            get().setProfile(toStoreProfile(profile));
            set({
              needsServerReconcile: false,
              bootstrapSource: 'server',
            });
          } else {
            if (isPhoneOnlySignupFirebaseUser(currentUser)) {
              logger.info('Preserving phone-only signup session until profile creation completes', {
                component: 'authStore',
                uid: currentUser.uid,
              });
              set({
                needsServerReconcile: false,
                bootstrapSource: 'none',
              });
              return;
            }

            await clearRejectedServerSession(get, currentUser.uid);
            return;
          }

          logger.debug('Firebase Auth 상태와 스토어를 동기화했습니다', {
            component: 'authStore',
            uid: currentUser.uid,
            hasProfile: Boolean(profile),
          });
        } catch (error) {
          logger.warn('Firebase Auth 상태 동기화 중 프로필 로드에 실패했습니다', {
            component: 'authStore',
            uid: currentUser.uid,
            error: error instanceof Error ? error.message : String(error),
          });
          set({
            needsServerReconcile: true,
            bootstrapSource: state.profile?.uid === currentUser.uid ? 'cache' : 'none',
          });
        } finally {
          set({
            isInitialized: true,
            isLoading: false,
            error: null,
          });
        }
      },

      reset: () => {
        clearScopedOfflineState(resolveScopedUserId(get()));
        set(initialState);
      },

      clearAuthUiState: (preserveUserId) => {
        const state = get();
        const scopedUserId = preserveUserId ?? resolveScopedUserId(state);

        clearScopedRuntimeState();
        clearCurrentAutoLoginSession();

        set({
          ...initialState,
          status: 'unauthenticated',
          isInitialized: true,
          _hasHydrated: state._hasHydrated,
          lastScopedUserId: scopedUserId,
          suppressedSessionUserId: scopedUserId,
        });

        logger.info('Cleared local auth UI state', {
          component: 'authStore',
          preservedUserId: scopedUserId,
        });
      },

      clearAuthState: () => {
        const state = get();
        clearScopedOfflineState(resolveScopedUserId(state));
        clearCurrentAutoLoginSession();

        set({
          ...initialState,
          status: 'unauthenticated',
          isInitialized: true,
          _hasHydrated: state._hasHydrated,
        });

        logger.info('Cleared local auth state', {
          component: 'authStore',
        });
      },
    };
  }, createAuthPersistOptions())
);

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
export const selectNeedsServerReconcile = (state: AuthState) => state.needsServerReconcile;
export const selectBootstrapSource = (state: AuthState) => state.bootstrapSource;

export const useIsAuthenticated = () => useAuthStore(selectIsAuthenticated);
export const useUser = () => useAuthStore(selectUser);
export const useProfile = () => useAuthStore(selectProfile);

export const useHasRole = (requiredRole: UserRole) => {
  const profile = useAuthStore(selectProfile);
  if (!profile) return false;

  return RoleResolver.hasPermission(profile.role, requiredRole);
};

export const useHasHydrated = () => useAuthStore(selectHasHydrated);

export async function waitForHydration(timeout = 5000): Promise<boolean> {
  if (useAuthStore.getState()._hasHydrated) {
    return true;
  }

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
