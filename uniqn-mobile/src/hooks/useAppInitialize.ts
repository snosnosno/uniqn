import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import type { User as FirebaseUser } from 'firebase/auth';
import { useAuthStore, waitForHydration } from '@/stores/authStore';
import { useAppStartupStore, type StartupPhase } from '@/stores/appStartupStore';
import { validateEnv } from '@/lib/env';
import { tryInitializeFirebase, getFirebaseAuth } from '@/lib/firebase';
import { ensureDualSdkSync } from '@/lib/authBridge';
import { isCurrentAutoLoginSession } from '@/lib/autoLoginSession';
import { migrateFromAsyncStorage } from '@/lib/mmkvStorage';
import { getUserProfile, signOut as authSignOut } from '@/services/auth';
import { logger } from '@/utils/logger';
import { trackLogout, setUserId } from '@/services/observability/analyticsService';
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
import { isNetworkError, toError } from '@/errors';
import { useNetworkStatus } from './useNetworkStatus';

interface AppInitState {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  requiresUpdate: boolean;
  isMaintenanceMode: boolean;
  versionCheckResult: VersionCheckResult | null;
}

interface UseAppInitializeReturn extends AppInitState {
  startupPhase: StartupPhase;
  retry: () => Promise<void>;
}

interface DeferredInitContext {
  authUser: FirebaseUser;
  profile: Awaited<ReturnType<typeof loadLatestProfile>>;
}

interface BootstrapResult {
  authUser: FirebaseUser | null;
  authResolutionSource: InitialAuthResolution['source'];
  autoLoginEnabled: boolean;
  versionCheckResult: VersionCheckResult;
}

export interface OfflineBootstrapState {
  source: 'none' | 'cache' | 'server';
  needsServerReconcile: boolean;
}

interface ResolveSessionResult {
  deferredInitContext: DeferredInitContext | null;
  offlineBootstrap: OfflineBootstrapState;
}

interface InitializationTrace {
  putAttribute: (key: string, value: string) => void;
  stop: () => void;
}

const AUTH_STORE_HYDRATION_TIMEOUT_MS = Platform.OS === 'web' ? 5000 : 5000;
const INITIAL_AUTH_READY_TIMEOUT_MS = Platform.OS === 'web' ? 5000 : 10000;
const FOREGROUND_AUTH_SETTLE_TIMEOUT_MS = 2000;

type AuthUserResolution =
  | { user: FirebaseUser; source: 'current' | 'event' }
  | { user: null; source: 'event' | 'timeout' };

type InitialAuthResolution =
  | { user: FirebaseUser; source: 'current' | 'ready' }
  | { user: null; source: 'ready' | 'timeout' };

const noopPutAttribute = (_key: string, _value: string): void => undefined;
const noopStopTrace = (): void => undefined;

const NOOP_INITIALIZATION_TRACE: InitializationTrace = {
  putAttribute: noopPutAttribute,
  stop: noopStopTrace,
};

function isDynamicImportUnsupported(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    error.message.includes('dynamic import callback was invoked without --experimental-vm-modules')
  );
}

async function importWithFallback<T>(loader: () => Promise<T>, moduleId: string): Promise<T> {
  const isJestRuntime =
    (typeof process !== 'undefined' &&
      typeof process.env === 'object' &&
      (process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID))) ||
    typeof (globalThis as { jest?: unknown }).jest !== 'undefined';

  if (isJestRuntime) {
    const jestGlobal = (
      globalThis as {
        jest?: {
          requireActual?: (id: string) => T;
          requireMock?: (id: string) => T;
        };
      }
    ).jest;

    if (jestGlobal?.requireMock) {
      try {
        return jestGlobal.requireMock(moduleId);
      } catch {
        if (jestGlobal.requireActual) {
          return jestGlobal.requireActual(moduleId);
        }
      }
    }
  }

  try {
    return await loader();
  } catch (error) {
    if (!isDynamicImportUnsupported(error)) {
      throw error;
    }

    const nodeRequire = Function('return require')() as (id: string) => T;
    return nodeRequire(moduleId);
  }
}

async function waitForAuthUser(timeoutMs = 3000): Promise<AuthUserResolution> {
  const auth = getFirebaseAuth();

  if (auth.currentUser) {
    return { user: auth.currentUser, source: 'current' };
  }

  return new Promise<AuthUserResolution>((resolve) => {
    let unsubscribe: (() => void) | null = null;

    const timeoutId = setTimeout(() => {
      unsubscribe?.();
      resolve({ user: null, source: 'timeout' });
    }, timeoutMs);

    unsubscribe = auth.onAuthStateChanged((user) => {
      clearTimeout(timeoutId);
      unsubscribe?.();
      resolve({
        user,
        source: 'event',
      });
    });
  });
}

export async function waitForInitialAuthUser(
  timeoutMs = INITIAL_AUTH_READY_TIMEOUT_MS
): Promise<InitialAuthResolution> {
  const auth = getFirebaseAuth();

  if (auth.currentUser) {
    return { user: auth.currentUser, source: 'current' };
  }

  if (typeof auth.authStateReady !== 'function') {
    const fallbackResolution = await waitForAuthUser(timeoutMs);

    if (fallbackResolution.user) {
      return {
        user: fallbackResolution.user,
        source: fallbackResolution.source === 'current' ? 'current' : 'ready',
      };
    }

    return {
      user: null,
      source: fallbackResolution.source === 'timeout' ? 'timeout' : 'ready',
    };
  }

  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    await Promise.race([
      auth.authStateReady(),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          resolve();
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    logger.warn('authStateReady failed during initialization, falling back to auth observer', {
      component: 'useAppInitialize',
      error: error instanceof Error ? error.message : String(error),
    });

    const fallbackResolution = await waitForAuthUser(timeoutMs);

    if (fallbackResolution.user) {
      return {
        user: fallbackResolution.user,
        source: fallbackResolution.source === 'current' ? 'current' : 'ready',
      };
    }

    return {
      user: null,
      source: fallbackResolution.source === 'timeout' ? 'timeout' : 'ready',
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  if (auth.currentUser) {
    return { user: auth.currentUser, source: 'ready' };
  }

  if (timedOut) {
    logger.warn('Timed out waiting for initial auth state', {
      component: 'useAppInitialize',
      timeoutMs,
      platform: Platform.OS,
    });
    return { user: null, source: 'timeout' };
  }

  return { user: null, source: 'ready' };
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
  const { getUnreadCounterFromCache } = await importWithFallback(
    () => import('@/services/notifications/notificationService'),
    '@/services/notifications/notificationService'
  );
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

  const { getMMKVInstance } = await importWithFallback(
    () => import('@/lib/mmkvStorage'),
    '@/lib/mmkvStorage'
  );
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

  const [{ httpsCallable }, { getFirebaseFunctions }] = await Promise.all([
    importWithFallback(() => import('firebase/functions'), 'firebase/functions'),
    importWithFallback(() => import('@/lib/firebase'), '@/lib/firebase'),
  ]);
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

async function bootstrapCore(): Promise<BootstrapResult> {
  const envResult = validateEnv();
  if (!envResult.success) {
    throw new Error(envResult.error);
  }

  await migrateFromAsyncStorage();

  const hydrated = await waitForHydration(AUTH_STORE_HYDRATION_TIMEOUT_MS);
  if (!hydrated) {
    const log = Platform.OS === 'web' ? logger.info : logger.warn;
    log('Auth store hydration timed out, continuing with diagnostic-only fallback', {
      component: 'useAppInitialize',
      timeoutMs: AUTH_STORE_HYDRATION_TIMEOUT_MS,
      platform: Platform.OS,
    });
  }

  const firebaseResult = tryInitializeFirebase();
  if (!firebaseResult.success) {
    throw new Error(firebaseResult.error);
  }

  const versionCheckResult = await checkForceUpdate();
  if (versionCheckResult.isMaintenanceMode) {
    throw new MaintenanceError(
      versionCheckResult.maintenanceMessage ?? '서버 점검 중입니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  if (versionCheckResult.mustUpdate) {
    throw new ForceUpdateError(
      '앱을 최신 버전으로 업데이트해 주세요.',
      versionCheckResult.latestVersion,
      versionCheckResult.releaseNotes
    );
  }

  await ensureDualSdkSync();
  await useAuthStore.getState().initialize();

  const autoLoginEnabled = await checkAutoLoginEnabled();
  const authResolution = await waitForInitialAuthUser();
  const authUser = authResolution.user;

  return {
    authUser,
    authResolutionSource: authResolution.source,
    autoLoginEnabled,
    versionCheckResult,
  };
}

async function applyLogoutObservabilityFallback() {
  trackLogout();
  await setUserId(null);
}

async function signOutAndResetSession(options?: {
  preserveOnFailure?: boolean;
  preservedUserId?: string | null;
}) {
  const authStore = useAuthStore.getState();

  try {
    await authSignOut();
    authStore.clearAuthState();
  } catch (error) {
    logger.warn(
      'Failed to sign out during app initialization, falling back to local auth cleanup',
      {
        component: 'useAppInitialize',
        preservedUserId: options?.preservedUserId ?? null,
        error: error instanceof Error ? error.message : String(error),
      }
    );

    await applyLogoutObservabilityFallback();

    if (options?.preserveOnFailure) {
      authStore.clearAuthUiState(options.preservedUserId ?? null);
      return;
    }

    authStore.clearAuthState();
  }
}

function commitBootstrapSource(
  source: OfflineBootstrapState['source'],
  needsServerReconcile: boolean
) {
  useAuthStore.getState().setBootstrapSource(source);
  useAuthStore.getState().setNeedsServerReconcile(needsServerReconcile);

  logger.info('bootstrap_source', {
    component: 'useAppInitialize',
    source,
    needsServerReconcile,
  });
}

export async function resolveSession({
  authUser,
  authResolutionSource,
  autoLoginEnabled,
}: Pick<
  BootstrapResult,
  'authUser' | 'authResolutionSource' | 'autoLoginEnabled'
>): Promise<ResolveSessionResult> {
  const authStore = useAuthStore.getState();
  const persistedUser = authStore.user;
  const persistedProfile = authStore.profile;
  const preservedUserId = authUser?.uid ?? persistedUser?.uid ?? persistedProfile?.uid ?? null;
  const currentSessionUserId = authUser?.uid ?? persistedUser?.uid ?? persistedProfile?.uid ?? null;
  const allowCurrentSessionContinuation =
    !!currentSessionUserId && isCurrentAutoLoginSession(currentSessionUserId);

  if (!autoLoginEnabled && !allowCurrentSessionContinuation) {
    if (
      authUser ||
      authResolutionSource === 'timeout' ||
      authStore.status === 'authenticated' ||
      persistedUser ||
      persistedProfile
    ) {
      await signOutAndResetSession({
        preserveOnFailure: true,
        preservedUserId,
      });
    }

    commitBootstrapSource('none', false);
    return {
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    };
  }

  if (
    !autoLoginEnabled &&
    allowCurrentSessionContinuation &&
    !authUser &&
    persistedUser?.uid &&
    persistedProfile?.uid === persistedUser.uid
  ) {
    commitBootstrapSource('cache', true);
    return {
      deferredInitContext: null,
      offlineBootstrap: { source: 'cache', needsServerReconcile: true },
    };
  }

  if (!authUser) {
    if (
      authResolutionSource === 'timeout' &&
      persistedUser?.uid &&
      persistedProfile?.uid === persistedUser.uid
    ) {
      logger.info('Preserved cached session while waiting for Firebase auth restoration', {
        component: 'useAppInitialize',
        uid: persistedUser.uid,
      });
      commitBootstrapSource('cache', true);
      return {
        deferredInitContext: null,
        offlineBootstrap: { source: 'cache', needsServerReconcile: true },
      };
    }

    if (authStore.status === 'authenticated' || persistedUser || persistedProfile) {
      authStore.clearAuthState();
    }

    commitBootstrapSource('none', false);
    return {
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    };
  }

  let tokenRole: string | null = null;
  let tokenNeedsReconcile = false;

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
      await signOutAndResetSession();
      commitBootstrapSource('none', false);
      return {
        deferredInitContext: null,
        offlineBootstrap: { source: 'none', needsServerReconcile: false },
      };
    }

    tokenNeedsReconcile = true;
    logger.warn('Token refresh will be retried after initialization', {
      component: 'useAppInitialize',
      uid: authUser.uid,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const freshProfile = await loadLatestProfile(authUser.uid);
    const storeProfile = toStoreProfile(freshProfile);

    authStore.setUser(authUser);
    authStore.setProfile(storeProfile);

    const needsServerReconcile =
      tokenNeedsReconcile || shouldSynchronizeClaims(freshProfile.role, tokenRole);

    commitBootstrapSource('server', needsServerReconcile);

    if (shouldSynchronizeClaims(freshProfile.role, tokenRole)) {
      logger.info('Deferred claims reconciliation scheduled', {
        component: 'useAppInitialize',
        uid: authUser.uid,
        expectedRole: freshProfile.role,
        tokenRole,
      });
    }

    return {
      deferredInitContext: {
        authUser,
        profile: freshProfile,
      },
      offlineBootstrap: {
        source: 'server',
        needsServerReconcile,
      },
    };
  } catch (error) {
    const resolvedError = toError(error);

    logger.warn('Failed to load latest profile during initialization', {
      component: 'useAppInitialize',
      uid: authUser.uid,
      error: resolvedError.message,
    });

    if (isNetworkError(resolvedError) && persistedProfile?.uid === authUser.uid) {
      authStore.setUser(authUser);
      authStore.setProfile(persistedProfile);
      commitBootstrapSource('cache', true);

      return {
        deferredInitContext: null,
        offlineBootstrap: {
          source: 'cache',
          needsServerReconcile: true,
        },
      };
    }

    if (isNetworkError(resolvedError)) {
      throw resolvedError;
    }

    logger.warn('Profile document missing or invalid during initialization, signing user out', {
      component: 'useAppInitialize',
      uid: authUser.uid,
      error: resolvedError.message,
    });
    await signOutAndResetSession();
    commitBootstrapSource('none', false);

    return {
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    };
  }
}

async function runPostLoginTasks(context: DeferredInitContext): Promise<{ needsRetry: boolean }> {
  const auth = getFirebaseAuth();
  const activeUser = auth.currentUser;

  if (!activeUser || activeUser.uid !== context.authUser.uid) {
    return { needsRetry: false };
  }

  let needsRetry = false;

  try {
    if (
      typeof (context.profile as { role?: string | null }).role === 'string' &&
      (context.profile as { role?: string }).role
    ) {
      try {
        const claimsResult = await refreshRoleClaims(
          activeUser,
          (context.profile as { role: string }).role
        );

        logger.info('Deferred custom claims refresh completed', {
          component: 'useAppInitialize',
          uid: activeUser.uid,
          role: claimsResult.data.claims.role,
          attempts: claimsResult.attempts,
        });
      } catch (error) {
        needsRetry = true;
        logger.warn('Deferred custom claims refresh failed', {
          component: 'useAppInitialize',
          uid: activeUser.uid,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const profileNickname =
      (context.profile as { nickname?: string | null }).nickname ?? activeUser.displayName;
    const profilePhotoURL = (context.profile as { photoURL?: string | null }).photoURL ?? null;
    const needsProfileReconciliation =
      profileNickname !== (activeUser.displayName ?? null) ||
      profilePhotoURL !== (activeUser.photoURL ?? null);

    if (needsProfileReconciliation) {
      try {
        const { updateProfile } = await importWithFallback(
          () => import('firebase/auth'),
          'firebase/auth'
        );
        await updateProfile(activeUser, {
          displayName: profileNickname || activeUser.displayName,
          photoURL: profilePhotoURL ?? undefined,
        });
        logger.info('Deferred auth profile reconciliation completed', {
          component: 'useAppInitialize',
          uid: activeUser.uid,
        });
      } catch (error) {
        needsRetry = true;
        logger.warn('Deferred auth profile reconciliation failed', {
          component: 'useAppInitialize',
          uid: activeUser.uid,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if ((context.profile as { phoneVerified?: boolean }).phoneVerified) {
      const unreadCount = await initializeUnreadCount(activeUser.uid);
      const { useNotificationStore } = await importWithFallback(
        () => import('@/stores/notificationStore'),
        '@/stores/notificationStore'
      );
      useNotificationStore.getState().setUnreadCount(unreadCount);
    }
  } catch (error) {
    needsRetry = true;
    logger.warn('Deferred initialization failed', {
      component: 'useAppInitialize',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { needsRetry };
}

export async function reconcileSessionFromServer(authUser: FirebaseUser): Promise<void> {
  const authStore = useAuthStore.getState();

  try {
    const latestProfile = await loadLatestProfile(authUser.uid);
    const storeProfile = toStoreProfile(latestProfile);

    authStore.setUser(authUser);
    authStore.setProfile(storeProfile);

    const result = await runPostLoginTasks({
      authUser,
      profile: latestProfile,
    });

    authStore.setNeedsServerReconcile(result.needsRetry);
    authStore.setBootstrapSource('server');

    logger.info('reconcile_success', {
      component: 'useAppInitialize',
      uid: authUser.uid,
      needsRetry: result.needsRetry,
    });
  } catch (error) {
    const resolvedError = toError(error);

    if (!isNetworkError(resolvedError)) {
      logger.warn('Server rejected reconciled session, signing out', {
        component: 'useAppInitialize',
        uid: authUser.uid,
        error: resolvedError.message,
      });
      await signOutAndResetSession();
      return;
    }

    logger.warn('reconcile_failure', {
      component: 'useAppInitialize',
      uid: authUser.uid,
      error: resolvedError.message,
    });
  }
}

export function useAppInitialize(): UseAppInitializeReturn {
  const startupPhase = useAppStartupStore((store) => store.startupPhase);
  const setStartupPhase = useAppStartupStore((store) => store.setStartupPhase);
  const needsServerReconcile = useAuthStore((store) => store.needsServerReconcile);
  const authUser = useAuthStore((store) => store.user);
  const { isOnline } = useNetworkStatus();
  const [state, setState] = useState<AppInitState>({
    isInitialized: false,
    isLoading: true,
    error: null,
    requiresUpdate: false,
    isMaintenanceMode: false,
    versionCheckResult: null,
  });

  const isInitializing = useRef(false);
  const isReconciling = useRef(false);
  const deferredInitContext = useRef<DeferredInitContext | null>(null);
  const didRunDeferredInit = useRef(false);

  const runDeferredPostLoginTasks = useCallback(async () => {
    if (didRunDeferredInit.current || !isOnline) {
      return;
    }

    const context = deferredInitContext.current;
    if (!context) {
      return;
    }

    didRunDeferredInit.current = true;

    try {
      const result = await runPostLoginTasks(context);
      useAuthStore.getState().setNeedsServerReconcile(result.needsRetry);
    } finally {
      deferredInitContext.current = null;
    }
  }, [isOnline]);

  const reconcileIfNeeded = useCallback(async () => {
    if (!isOnline || !needsServerReconcile || !authUser?.uid || isReconciling.current) {
      return;
    }

    const firebaseUser = getFirebaseAuth().currentUser;
    if (!firebaseUser || firebaseUser.uid !== authUser.uid) {
      return;
    }

    isReconciling.current = true;
    try {
      await reconcileSessionFromServer(firebaseUser);
    } finally {
      isReconciling.current = false;
    }
  }, [authUser?.uid, isOnline, needsServerReconcile]);

  const syncAuthStateOnForeground = useCallback(async () => {
    const authResolution = await waitForAuthUser(FOREGROUND_AUTH_SETTLE_TIMEOUT_MS);

    if (authResolution.user) {
      await useAuthStore.getState().checkAuthState(authResolution.user);
      await reconcileIfNeeded();
      return;
    }

    if (authResolution.source === 'event') {
      await useAuthStore.getState().checkAuthState(null);
      return;
    }

    logger.debug('Skipped destructive auth sync until Firebase auth settles', {
      component: 'useAppInitialize',
      timeoutMs: FOREGROUND_AUTH_SETTLE_TIMEOUT_MS,
    });

    await useAuthStore.getState().checkAuthState();
    await reconcileIfNeeded();
  }, [reconcileIfNeeded]);

  const initialize = useCallback(async () => {
    if (isInitializing.current) {
      return;
    }

    isInitializing.current = true;
    isReconciling.current = false;
    didRunDeferredInit.current = false;
    deferredInitContext.current = null;

    setState((previous) => ({
      ...previous,
      isLoading: true,
      error: null,
    }));

    let trace: InitializationTrace = NOOP_INITIALIZATION_TRACE;
    let sessionService: { initialize: () => void } | null = null;

    try {
      const observability = await importWithFallback(
        () => import('@/services/observability'),
        '@/services/observability'
      );

      trace = observability.startTrace('app_initialization');
      trace.putAttribute('platform', 'react-native');
      sessionService = observability.sessionService;

      await SplashScreen.preventAutoHideAsync();
      setStartupPhase('bootstrapping');

      const bootstrapResult = await bootstrapCore();

      setStartupPhase('resolving_session');
      const sessionResolution = await resolveSession(bootstrapResult);
      deferredInitContext.current = sessionResolution.deferredInitContext;
      sessionService.initialize();

      setState({
        isInitialized: true,
        isLoading: false,
        error: null,
        requiresUpdate: bootstrapResult.versionCheckResult.shouldUpdate,
        isMaintenanceMode: false,
        versionCheckResult: bootstrapResult.versionCheckResult,
      });

      setStartupPhase('resolved');
      trace.putAttribute('status', 'success');
      trace.stop();
    } catch (error) {
      const appError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = error instanceof Error ? error.message : String(error);

      setStartupPhase('error');

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
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        logger.warn('Failed to hide splash screen after initialization', {
          component: 'useAppInitialize',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      isInitializing.current = false;
    }
  }, [setStartupPhase]);

  const retry = useCallback(async () => {
    await initialize();
  }, [initialize]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (startupPhase !== 'resolved' || !state.isInitialized) {
      return;
    }

    void runDeferredPostLoginTasks();
  }, [runDeferredPostLoginTasks, startupPhase, state.isInitialized]);

  useEffect(() => {
    void reconcileIfNeeded();
  }, [reconcileIfNeeded]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && state.isInitialized) {
        void syncAuthStateOnForeground();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [state.isInitialized, syncAuthStateOnForeground]);

  useEffect(() => {
    return () => {
      void importWithFallback(() => import('@/services/observability'), '@/services/observability')
        .then(({ sessionService }) => {
          sessionService.cleanup();
        })
        .catch(() => {
          // Best-effort cleanup only.
        });
    };
  }, []);

  return {
    ...state,
    startupPhase,
    retry,
  };
}

export default useAppInitialize;
