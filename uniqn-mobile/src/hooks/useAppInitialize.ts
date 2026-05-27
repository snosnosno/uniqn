import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useAppStartupStore, type StartupPhase } from '@/stores/appStartupStore';
import { logger } from '@/utils/logger';
import {
  isForceUpdateError,
  isMaintenanceError,
  type VersionCheckResult,
} from '@/services/versionService';
import { useNetworkStatus } from './useNetworkStatus';
import { getCurrentAuthUserAsync, waitForAuthUser } from './internal/appInitializeAuthSession';
import { describeError, importWithFallback } from './internal/appInitializeImports';
import {
  bootstrapCore,
  resolveSession,
  reconcileSessionFromServer,
  runPostLoginTasks,
  type DeferredInitContext,
} from './internal/appInitializeSession';

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

interface InitializationTrace {
  putAttribute: (key: string, value: string) => void;
  stop: () => void;
}

const FOREGROUND_AUTH_SETTLE_TIMEOUT_MS = 2000;

const noopPutAttribute = (_key: string, _value: string): void => undefined;
const noopStopTrace = (): void => undefined;

const NOOP_INITIALIZATION_TRACE: InitializationTrace = {
  putAttribute: noopPutAttribute,
  stop: noopStopTrace,
};

export { waitForInitialAuthUser } from './internal/appInitializeAuthSession';
export {
  resolveSession,
  reconcileSessionFromServer,
  type OfflineBootstrapState,
} from './internal/appInitializeSession';

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

    const supabaseUser = await getCurrentAuthUserAsync();
    if (!supabaseUser || supabaseUser.id !== authUser.uid) {
      return;
    }

    isReconciling.current = true;
    try {
      await reconcileSessionFromServer(supabaseUser);
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
      const errorMessage = describeError(error);

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
          error: describeError(error),
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
    // Supabase RN: 백그라운드에서 JS 타이머가 멈추므로 autoRefreshToken도 함께
    // 일시정지/재개해야 한다. Supabase 공식 RN 가이드 권고.
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (Platform.OS !== 'web') {
          supabase.auth.startAutoRefresh();
        }
        if (state.isInitialized) {
          void syncAuthStateOnForeground();
        }
      } else {
        if (Platform.OS !== 'web') {
          supabase.auth.stopAutoRefresh();
        }
      }
    });

    // 초기 mount 시 AppState 이벤트가 fire되지 않으므로 currentState 기반 1회 호출
    if (Platform.OS !== 'web' && AppState.currentState === 'active') {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      subscription.remove();
      if (Platform.OS !== 'web') {
        supabase.auth.stopAutoRefresh();
      }
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
