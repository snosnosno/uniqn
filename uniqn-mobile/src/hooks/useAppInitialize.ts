import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import type { User as FirebaseUser } from 'firebase/auth';
import { useAuthStore, waitForHydration } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { validateEnv } from '@/lib/env';
import { tryInitializeFirebase, getFirebaseAuth } from '@/lib/firebase';
import { ensureDualSdkSync } from '@/lib/authBridge';
import { migrateFromAsyncStorage } from '@/lib/mmkvStorage';
import { getUnreadCounterFromCache } from '@/services/notifications/notificationService';
import { logger } from '@/utils/logger';
import { startTrace, sessionService } from '@/services/observability';
import { getUserProfile, signOut as authSignOut } from '@/services/auth';
import { toStoreProfile } from '@/utils/profileConverter';
import {
  checkForceUpdate,
  ForceUpdateError,
  MaintenanceError,
  isForceUpdateError,
  isMaintenanceError,
  type VersionCheckResult,
} from '@/services/versionService';
import { checkAutoLoginEnabled } from './useAutoLogin';
import { retryWithBackoff } from '@/utils/retry';

interface AppInitState {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  requiresUpdate: boolean;
  isMaintenanceMode: boolean;
  versionCheckResult: VersionCheckResult | null;
}

interface UseAppInitializeReturn extends AppInitState {
  retry: () => Promise<void>;
}

interface DeferredInitContext {
  authUser: FirebaseUser;
  profile: NonNullable<Awaited<ReturnType<typeof getUserProfile>>>;
}

const AUTH_STORE_HYDRATION_TIMEOUT_MS = Platform.OS === 'web' ? 1500 : 5000;

async function waitForAuthUser(timeoutMs = 3000): Promise<FirebaseUser | null> {
  const auth = getFirebaseAuth();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise<FirebaseUser | null>((resolve) => {
    let unsubscribe: (() => void) | null = null;

    const timeoutId = setTimeout(() => {
      unsubscribe?.();
      resolve(null);
    }, timeoutMs);

    unsubscribe = auth.onAuthStateChanged((user) => {
      clearTimeout(timeoutId);
      unsubscribe?.();
      resolve(user);
    });
  });
}

function isFatalAuthError(error: unknown): boolean {
  const errorCode = (error as { code?: string } | undefined)?.code;
  return ['auth/user-token-expired', 'auth/user-disabled', 'auth/user-not-found'].includes(
    errorCode ?? ''
  );
}

function getRoleClaim(claims: Record<string, unknown>): string | null {
  return typeof claims.role === 'string' ? claims.role : null;
}

function shouldSynchronizeClaims(profileRole: string | null | undefined, tokenRole: string | null) {
  return typeof profileRole === 'string' && profileRole.length > 0 && tokenRole !== profileRole;
}

async function refreshRoleClaims(authUser: FirebaseUser, expectedRole: string) {
  return retryWithBackoff(
    async () => {
      await authUser.getIdToken(true);
      const result = await authUser.getIdTokenResult();
      const role = getRoleClaim(result.claims as Record<string, unknown>);

      if (!role) {
        throw new Error('Custom claims role is missing');
      }

      if (role !== expectedRole) {
        throw new Error(`Custom claims role mismatch: expected ${expectedRole}, received ${role}`);
      }

      return result;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      component: 'useAppInitialize',
      operationName: 'refreshCustomClaims',
    }
  );
}

async function loadLatestProfile(uid: string) {
  const result = await retryWithBackoff(
    async () => {
      const profile = await getUserProfile(uid);
      if (!profile) {
        throw new Error('Profile not found');
      }
      return profile;
    },
    {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      component: 'useAppInitialize',
      operationName: 'loadUserProfile',
    }
  );

  return result.data;
}

async function initializeUnreadCount(uid: string): Promise<number> {
  const cachedCount = await getUnreadCounterFromCache(uid);

  if (cachedCount !== null) {
    logger.info('Loaded unread count from cache', {
      component: 'useAppInitialize',
      uid,
      unreadCount: cachedCount,
      source: 'counter_document',
    });
    return cachedCount;
  }

  const { getMMKVInstance } = await import('@/lib/mmkvStorage');
  const storage = getMMKVInstance();
  const debounceKey = `counter_init_${uid}`;
  const lastInitTime = parseInt(storage.getString(debounceKey) ?? '0', 10) || 0;
  const now = Date.now();
  const debounceMs = 10_000;

  if (now - lastInitTime < debounceMs) {
    logger.info('Skipped unread counter initialization due to debounce window', {
      component: 'useAppInitialize',
      uid,
      elapsedMs: now - lastInitTime,
    });
    return 0;
  }

  const { httpsCallable } = await import('firebase/functions');
  const { getFirebaseFunctions } = await import('@/lib/firebase');
  const functions = getFirebaseFunctions();
  const initializeCounter = httpsCallable<void, { unreadCount: number }>(
    functions,
    'initializeUnreadCounter'
  );

  storage.set(debounceKey, String(now));

  try {
    const result = await initializeCounter();
    logger.info('Initialized unread count from server', {
      component: 'useAppInitialize',
      uid,
      unreadCount: result.data.unreadCount,
      source: 'calculated',
    });
    return result.data.unreadCount;
  } catch (error) {
    storage.delete(debounceKey);
    logger.warn('Failed to initialize unread count, falling back to zero', {
      component: 'useAppInitialize',
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

export function useAppInitialize(): UseAppInitializeReturn {
  const [state, setState] = useState<AppInitState>({
    isInitialized: false,
    isLoading: true,
    error: null,
    requiresUpdate: false,
    isMaintenanceMode: false,
    versionCheckResult: null,
  });

  const isInitializing = useRef(false);
  const deferredInitContext = useRef<DeferredInitContext | null>(null);
  const didRunDeferredInit = useRef(false);

  const runDeferredInitialization = useCallback(async () => {
    if (didRunDeferredInit.current) {
      return;
    }

    const context = deferredInitContext.current;
    if (!context) {
      return;
    }

    didRunDeferredInit.current = true;

    const auth = getFirebaseAuth();
    const activeUser = auth.currentUser;
    if (!activeUser || activeUser.uid !== context.authUser.uid) {
      deferredInitContext.current = null;
      return;
    }

    try {
      try {
        const claimsResult = await retryWithBackoff(
          async () => {
            await activeUser.getIdToken(true);
            const result = await activeUser.getIdTokenResult();
            if (!result.claims.role) {
              throw new Error('Custom claims role is missing');
            }
            return result;
          },
          {
            maxRetries: 3,
            initialDelayMs: 1000,
            backoffMultiplier: 2,
            component: 'useAppInitialize',
            operationName: 'refreshCustomClaims',
          }
        );

        logger.info('Deferred custom claims refresh completed', {
          component: 'useAppInitialize',
          uid: activeUser.uid,
          role: claimsResult.data.claims.role,
          attempts: claimsResult.attempts,
        });
      } catch (error) {
        logger.warn('Deferred custom claims refresh failed', {
          component: 'useAppInitialize',
          uid: activeUser.uid,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const needsReconciliation =
        (context.profile.nickname ?? null) !== (activeUser.displayName ?? null) ||
        (context.profile.photoURL ?? null) !== (activeUser.photoURL ?? null);

      if (needsReconciliation) {
        try {
          const { updateProfile } = await import('firebase/auth');
          await updateProfile(activeUser, {
            displayName: context.profile.nickname || activeUser.displayName,
            photoURL: context.profile.photoURL ?? undefined,
          });
          logger.info('Deferred auth profile reconciliation completed', {
            component: 'useAppInitialize',
            uid: activeUser.uid,
          });
        } catch (error) {
          logger.warn('Deferred auth profile reconciliation failed', {
            component: 'useAppInitialize',
            uid: activeUser.uid,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (context.profile.phoneVerified) {
        const unreadCount = await initializeUnreadCount(activeUser.uid);
        useNotificationStore.getState().setUnreadCount(unreadCount);
      }
    } catch (error) {
      logger.warn('Deferred initialization failed', {
        component: 'useAppInitialize',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      deferredInitContext.current = null;
    }
  }, []);

  const initialize = useCallback(async () => {
    if (isInitializing.current) {
      return;
    }

    isInitializing.current = true;
    didRunDeferredInit.current = false;
    deferredInitContext.current = null;

    const trace = startTrace('app_initialization');
    trace.putAttribute('platform', 'react-native');

    setState((previous) => ({
      ...previous,
      isLoading: true,
      error: null,
    }));

    try {
      await SplashScreen.preventAutoHideAsync();

      const envResult = validateEnv();
      if (!envResult.success) {
        throw new Error(envResult.error);
      }

      await migrateFromAsyncStorage();

      const hydrated = await waitForHydration(AUTH_STORE_HYDRATION_TIMEOUT_MS);
      if (!hydrated) {
        logger.warn('Auth store hydration timed out, continuing with default state', {
          component: 'useAppInitialize',
          timeoutMs: AUTH_STORE_HYDRATION_TIMEOUT_MS,
          platform: Platform.OS,
        });
      }

      const firebaseResult = tryInitializeFirebase();
      if (!firebaseResult.success) {
        throw new Error(firebaseResult.error);
      }

      const versionResult = await checkForceUpdate();
      if (versionResult.isMaintenanceMode) {
        throw new MaintenanceError(
          versionResult.maintenanceMessage ?? '서버 점검 중입니다. 잠시 후 다시 시도해주세요.'
        );
      }

      if (versionResult.mustUpdate) {
        throw new ForceUpdateError(
          '앱을 최신 버전으로 업데이트해주세요.',
          versionResult.latestVersion,
          versionResult.releaseNotes
        );
      }

      await ensureDualSdkSync();
      sessionService.initialize();

      await useAuthStore.getState().initialize();
      await useAuthStore.getState().checkAuthState();

      const autoLoginEnabled = await checkAutoLoginEnabled();
      const authUser = await waitForAuthUser();

      if (authUser && !autoLoginEnabled) {
        useAuthStore.getState().clearAuthState();
      } else if (authUser) {
        let shouldLoadProfile = true;
        let tokenRole: string | null = null;

        try {
          await authUser.getIdToken(true);
          const tokenResult = await authUser.getIdTokenResult();
          tokenRole = getRoleClaim(tokenResult.claims as Record<string, unknown>);

          logger.info('Token refresh completed during app initialization', {
            component: 'useAppInitialize',
            uid: authUser.uid,
            hasRole: Boolean(tokenRole),
          });
        } catch (error) {
          if (isFatalAuthError(error)) {
            logger.warn('Fatal auth error during initialization, signing user out', {
              component: 'useAppInitialize',
              error: error instanceof Error ? error.message : String(error),
            });
            await authSignOut();
            useAuthStore.getState().reset();
            shouldLoadProfile = false;
          } else {
            logger.warn('Non-fatal token refresh error during initialization', {
              component: 'useAppInitialize',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (shouldLoadProfile) {
          const freshProfile = await loadLatestProfile(authUser.uid).catch((error) => {
            logger.warn('Failed to load latest profile during initialization', {
              component: 'useAppInitialize',
              uid: authUser.uid,
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          });

          if (freshProfile) {
            if (shouldSynchronizeClaims(freshProfile.role, tokenRole)) {
              try {
                const claimsResult = await refreshRoleClaims(authUser, freshProfile.role);
                tokenRole = getRoleClaim(claimsResult.data.claims as Record<string, unknown>);

                logger.info('Custom claims synchronized before auth state commit', {
                  component: 'useAppInitialize',
                  uid: authUser.uid,
                  expectedRole: freshProfile.role,
                  role: tokenRole,
                  attempts: claimsResult.attempts,
                });
              } catch (error) {
                logger.warn(
                  'Custom claims synchronization failed during initialization, signing user out',
                  {
                    component: 'useAppInitialize',
                    uid: authUser.uid,
                    expectedRole: freshProfile.role,
                    initialTokenRole: tokenRole,
                    error: error instanceof Error ? error.message : String(error),
                  }
                );
                await authSignOut();
                useAuthStore.getState().reset();
                shouldLoadProfile = false;
              }
            }

            if (shouldLoadProfile) {
              useAuthStore.getState().setProfile(toStoreProfile(freshProfile));
              useAuthStore.getState().setUser(authUser);
              deferredInitContext.current = {
                authUser,
                profile: freshProfile,
              };
            }
          } else {
            logger.warn('Profile document missing during initialization, signing user out', {
              component: 'useAppInitialize',
              uid: authUser.uid,
            });
            await authSignOut();
            useAuthStore.getState().reset();
          }
        }
      } else if (useAuthStore.getState().status === 'authenticated') {
        useAuthStore.getState().clearAuthState();
      }

      setState({
        isInitialized: true,
        isLoading: false,
        error: null,
        requiresUpdate: versionResult.shouldUpdate,
        isMaintenanceMode: false,
        versionCheckResult: versionResult,
      });

      trace.putAttribute('status', 'success');
      trace.stop();
    } catch (error) {
      const appError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (isForceUpdateError(appError)) {
        trace.putAttribute('status', 'force_update');
        trace.stop();

        setState({
          isInitialized: false,
          isLoading: false,
          error: appError,
          requiresUpdate: true,
          isMaintenanceMode: false,
          versionCheckResult: null,
        });
      } else if (isMaintenanceError(appError)) {
        trace.putAttribute('status', 'maintenance');
        trace.stop();

        setState({
          isInitialized: false,
          isLoading: false,
          error: appError,
          requiresUpdate: false,
          isMaintenanceMode: true,
          versionCheckResult: null,
        });
      } else {
        logger.error('App initialization failed', appError, {
          component: 'useAppInitialize',
        });

        trace.putAttribute('status', 'error');
        trace.putAttribute('error_message', errorMessage);
        trace.stop();

        setState({
          isInitialized: false,
          isLoading: false,
          error: appError,
          requiresUpdate: false,
          isMaintenanceMode: false,
          versionCheckResult: null,
        });
      }
    } finally {
      await SplashScreen.hideAsync();
      isInitializing.current = false;
    }
  }, []);

  const retry = useCallback(async () => {
    await initialize();
  }, [initialize]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!state.isInitialized) {
      return;
    }

    void runDeferredInitialization();
  }, [runDeferredInitialization, state.isInitialized]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && state.isInitialized) {
        void useAuthStore.getState().checkAuthState();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [state.isInitialized]);

  useEffect(() => {
    return () => {
      sessionService.cleanup();
    };
  }, []);

  return {
    ...state,
    retry,
  };
}

export default useAppInitialize;
