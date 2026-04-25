import { act, renderHook, waitFor } from '@testing-library/react-native';
import useAppInitializeHook, {
  resolveSession,
  waitForInitialAuthUser,
} from '@/hooks/useAppInitialize';

const mockClearAuthState = jest.fn();
const mockClearAuthUiState = jest.fn();
const mockSetBootstrapSource = jest.fn();
const mockSetNeedsServerReconcile = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockTrackLogout = jest.fn();
const mockSetUserId = jest.fn().mockResolvedValue(undefined);
const mockInitializeAuthStore = jest.fn().mockResolvedValue(undefined);
const mockCheckAuthState = jest.fn().mockResolvedValue(undefined);
let mockStartupPhase = 'idle';
const mockSetStartupPhase = jest.fn((phase: string) => {
  mockStartupPhase = phase;
});
const mockAuthStoreState = {
  user: null as { uid: string } | null,
  profile: null as { uid: string } | null,
  status: 'unauthenticated',
  needsServerReconcile: false,
  initialize: mockInitializeAuthStore,
  checkAuthState: mockCheckAuthState,
  clearAuthState: mockClearAuthState,
  clearAuthUiState: mockClearAuthUiState,
  setBootstrapSource: mockSetBootstrapSource,
  setNeedsServerReconcile: mockSetNeedsServerReconcile,
  setUser: jest.fn(),
  setProfile: jest.fn(),
};

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: { OS: 'ios' },
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('@/stores/authStore', () => {
  const useAuthStore = Object.assign(
    jest.fn((selector?: (state: typeof mockAuthStoreState) => unknown) =>
      typeof selector === 'function' ? selector(mockAuthStoreState) : mockAuthStoreState
    ),
    {
      getState: jest.fn(() => mockAuthStoreState),
    }
  );

  return {
    useAuthStore,
    waitForHydration: jest.fn().mockResolvedValue(true),
  };
});

jest.mock('@/stores/appStartupStore', () => ({
  useAppStartupStore: jest.fn(
    (
      selector: (state: {
        startupPhase: string;
        setStartupPhase: (phase: string) => void;
      }) => unknown
    ) =>
      selector({
        startupPhase: mockStartupPhase,
        setStartupPhase: mockSetStartupPhase,
      })
  ),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: {
    getState: jest.fn(() => ({ setUnreadCount: jest.fn() })),
  },
}));

jest.mock('@/lib/env', () => ({
  validateEnv: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn((callback: (event: string, session: null) => void) => {
        // Fire immediately with null session so waitForInitialAuthUser resolves quickly
        setTimeout(() => callback('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

const mockIsCurrentAutoLoginSession = jest.fn((_: string) => false);

jest.mock('@/lib/autoLoginSession', () => ({
  isCurrentAutoLoginSession: (uid: string) => mockIsCurrentAutoLoginSession(uid),
}));

jest.mock('@/lib/mmkvStorage', () => ({
  migrateFromAsyncStorage: jest.fn(),
}));

jest.mock('@/services/notifications/notificationService', () => ({
  getUnreadCounterFromCache: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/services/observability', () => ({
  startTrace: jest.fn(() => ({
    putAttribute: jest.fn(),
    stop: jest.fn(),
  })),
  sessionService: {
    initialize: jest.fn(),
    cleanup: jest.fn(),
  },
}));

jest.mock('@/services/observability/analyticsService', () => ({
  trackLogout: () => mockTrackLogout(),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
}));

jest.mock('@/services/auth', () => ({
  getUserProfile: jest.fn(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock('@/utils/profileConverter', () => ({
  toStoreProfile: jest.fn((profile) => profile),
}));

jest.mock('@/services/versionService', () => ({
  checkForceUpdate: jest.fn(),
  ForceUpdateError: class ForceUpdateError extends Error {},
  MaintenanceError: class MaintenanceError extends Error {},
  isForceUpdateError: jest.fn(() => false),
  isMaintenanceError: jest.fn(() => false),
}));

const mockGetProtectedAuthFlowKind = jest.fn().mockReturnValue(null);

jest.mock('@/shared/auth/protectedAuthFlow', () => ({
  protectAuthFlow: jest.fn(),
  clearProtectedAuthFlow: jest.fn(),
  getProtectedAuthFlowKind: (...args: unknown[]) => mockGetProtectedAuthFlowKind(...args),
}));

jest.mock('@/hooks/useAutoLogin', () => ({
  checkAutoLoginEnabled: jest.fn(),
}));

jest.mock('@/utils/retry', () => ({
  retryWithBackoff: jest.fn(),
}));

jest.mock('@/errors', () => ({
  isNetworkError: jest.fn(() => false),
  toError: jest.fn((error) => {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(() => ({ isOnline: true })),
}));

describe('resolveSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsCurrentAutoLoginSession.mockReturnValue(false);
    mockAuthStoreState.user = null;
    mockAuthStoreState.profile = null;
    mockAuthStoreState.status = 'unauthenticated';
  });

  it('signs out restored Firebase session when auto login is disabled', async () => {
    const result = await resolveSession({
      authUser: {
        id: 'user-1',
      } as never,
      authResolutionSource: 'current',
      autoLoginEnabled: false,
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearAuthUiState).not.toHaveBeenCalled();
    expect(mockClearAuthState).toHaveBeenCalledTimes(1);
    expect(mockSetBootstrapSource).toHaveBeenCalledWith('none');
    expect(mockSetNeedsServerReconcile).toHaveBeenCalledWith(false);
    expect(result).toEqual({
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    });
  });

  it('preserves the current tab session when auto login is disabled but the session is already active', async () => {
    mockIsCurrentAutoLoginSession.mockReturnValue(true);

    const authUser = {
      id: 'user-1',
      app_metadata: { role: 'staff' },
    };

    const profile = {
      uid: 'user-1',
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    const { retryWithBackoff } = jest.requireMock('@/utils/retry') as {
      retryWithBackoff: jest.Mock;
    };
    const { getUserProfile } = jest.requireMock('@/services/auth') as {
      getUserProfile: jest.Mock;
    };

    retryWithBackoff.mockResolvedValueOnce({ data: profile });
    getUserProfile.mockResolvedValue(profile);

    const result = await resolveSession({
      authUser: authUser as never,
      authResolutionSource: 'current',
      autoLoginEnabled: false,
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearAuthState).not.toHaveBeenCalled();
    expect(mockSetBootstrapSource).toHaveBeenCalledWith('server');
    expect(result.offlineBootstrap).toEqual({
      source: 'server',
      needsServerReconcile: false,
    });
  });

  it('preserves a phone-only signup session when the profile document is not ready yet', async () => {
    const authUser = {
      id: 'phone-only-user',
      email: null,
      phone: '+821012345678',
      app_metadata: { providers: ['phone'] },
    };

    mockGetProtectedAuthFlowKind.mockReturnValueOnce('phone_signup');

    const { retryWithBackoff } = jest.requireMock('@/utils/retry') as {
      retryWithBackoff: jest.Mock;
    };

    retryWithBackoff.mockRejectedValueOnce(new Error('Profile not found'));

    const result = await resolveSession({
      authUser: authUser as never,
      authResolutionSource: 'current',
      autoLoginEnabled: true,
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockAuthStoreState.setUser).toHaveBeenCalledWith(authUser);
    expect(mockAuthStoreState.setProfile).toHaveBeenCalledWith(null);
    expect(mockSetBootstrapSource).toHaveBeenCalledWith('none');
    expect(result).toEqual({
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    });
  });

  it('preserves cached session while Firebase auth restoration is still settling for the current tab', async () => {
    mockIsCurrentAutoLoginSession.mockReturnValue(true);
    mockAuthStoreState.user = { uid: 'cached-user' };
    mockAuthStoreState.profile = { uid: 'cached-user' };
    mockAuthStoreState.status = 'authenticated';

    const result = await resolveSession({
      authUser: null,
      authResolutionSource: 'timeout',
      autoLoginEnabled: false,
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearAuthState).not.toHaveBeenCalled();
    expect(mockSetBootstrapSource).toHaveBeenCalledWith('cache');
    expect(result).toEqual({
      deferredInitContext: null,
      offlineBootstrap: { source: 'cache', needsServerReconcile: true },
    });
  });

  it('clears persisted auth state when auto login is disabled before Firebase restore completes', async () => {
    mockAuthStoreState.user = { uid: 'cached-user' };
    mockAuthStoreState.profile = { uid: 'cached-user' };
    mockAuthStoreState.status = 'authenticated';

    const result = await resolveSession({
      authUser: null,
      authResolutionSource: 'timeout',
      autoLoginEnabled: false,
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearAuthUiState).not.toHaveBeenCalled();
    expect(mockClearAuthState).toHaveBeenCalledTimes(1);
    expect(mockSetBootstrapSource).toHaveBeenCalledWith('none');
    expect(mockSetNeedsServerReconcile).toHaveBeenCalledWith(false);
    expect(result).toEqual({
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    });
  });

  it('falls back to local auth UI cleanup when startup sign-out fails', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('sign-out failed'));

    const result = await resolveSession({
      authUser: {
        id: 'user-1',
      } as never,
      authResolutionSource: 'current',
      autoLoginEnabled: false,
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockTrackLogout).toHaveBeenCalledTimes(1);
    expect(mockSetUserId).toHaveBeenCalledWith(null);
    expect(mockClearAuthUiState).toHaveBeenCalledWith('user-1');
    expect(mockClearAuthState).not.toHaveBeenCalled();
    expect(result).toEqual({
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    });
  });

  it('preserves cached session when initial auth resolution times out', async () => {
    mockAuthStoreState.user = { uid: 'cached-user' };
    mockAuthStoreState.profile = { uid: 'cached-user' };
    mockAuthStoreState.status = 'authenticated';

    const result = await resolveSession({
      authUser: null,
      authResolutionSource: 'timeout',
      autoLoginEnabled: true,
    });

    expect(mockClearAuthState).not.toHaveBeenCalled();
    expect(mockClearAuthUiState).not.toHaveBeenCalled();
    expect(mockSetBootstrapSource).toHaveBeenCalledWith('cache');
    expect(mockSetNeedsServerReconcile).toHaveBeenCalledWith(true);
    expect(result).toEqual({
      deferredInitContext: null,
      offlineBootstrap: { source: 'cache', needsServerReconcile: true },
    });
  });

  it('clears stale persisted auth state when auth is ready with no user', async () => {
    mockAuthStoreState.user = { uid: 'stale-user' };
    mockAuthStoreState.profile = { uid: 'stale-user' };
    mockAuthStoreState.status = 'authenticated';

    const result = await resolveSession({
      authUser: null,
      authResolutionSource: 'ready',
      autoLoginEnabled: true,
    });

    expect(mockClearAuthState).toHaveBeenCalledTimes(1);
    expect(mockSetBootstrapSource).toHaveBeenCalledWith('none');
    expect(mockSetNeedsServerReconcile).toHaveBeenCalledWith(false);
    expect(result).toEqual({
      deferredInitContext: null,
      offlineBootstrap: { source: 'none', needsServerReconcile: false },
    });
  });
});

describe('useAppInitialize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartupPhase = 'idle';
    mockAuthStoreState.user = null;
    mockAuthStoreState.profile = null;
    mockAuthStoreState.status = 'unauthenticated';
    mockAuthStoreState.needsServerReconcile = false;

    const { validateEnv } = jest.requireMock('@/lib/env') as {
      validateEnv: jest.Mock;
    };
    const { checkForceUpdate } = jest.requireMock('@/services/versionService') as {
      checkForceUpdate: jest.Mock;
    };
    const { checkAutoLoginEnabled } = jest.requireMock('@/hooks/useAutoLogin') as {
      checkAutoLoginEnabled: jest.Mock;
    };
    const splashScreen = jest.requireMock('expo-splash-screen') as {
      preventAutoHideAsync: jest.Mock;
      hideAsync: jest.Mock;
    };

    validateEnv.mockReturnValue({ success: true });
    checkForceUpdate.mockResolvedValue({
      isMaintenanceMode: false,
      mustUpdate: false,
      shouldUpdate: false,
      latestVersion: '1.0.0',
      releaseNotes: '',
    });
    checkAutoLoginEnabled.mockResolvedValue(true);
    splashScreen.preventAutoHideAsync.mockResolvedValue(undefined);
    splashScreen.hideAsync.mockResolvedValue(undefined);
    mockInitializeAuthStore.mockResolvedValue(undefined);
    mockCheckAuthState.mockResolvedValue(undefined);
  });

  it('surfaces observability chunk load failures and allows retry to continue', async () => {
    const originalGlobalJest = (globalThis as typeof globalThis & { jest?: typeof jest }).jest;
    (globalThis as typeof globalThis & { jest?: typeof jest }).jest = {
      ...jest,
      requireMock: (moduleName: string) => {
        if (moduleName === '@/services/observability') {
          throw new Error('chunk load failed');
        }

        return jest.requireMock(moduleName);
      },
      requireActual: (moduleName: string) => {
        if (moduleName === '@/services/observability') {
          throw new Error('chunk load failed');
        }

        return jest.requireActual(moduleName);
      },
    } as typeof jest;
    const splashScreen = jest.requireMock('expo-splash-screen') as {
      hideAsync: jest.Mock;
    };

    try {
      const { result } = renderHook(() => useAppInitializeHook());

      await waitFor(() => {
        expect(result.current.error?.message).toBe('chunk load failed');
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      expect(mockSetStartupPhase).toHaveBeenCalledWith('error');
      expect(splashScreen.hideAsync).toHaveBeenCalledTimes(1);

      (globalThis as typeof globalThis & { jest?: typeof jest }).jest = jest as typeof jest;

      await act(async () => {
        await result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
    } finally {
      (globalThis as typeof globalThis & { jest?: typeof jest }).jest = originalGlobalJest;
    }
  });
});

describe('waitForInitialAuthUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for onAuthStateChange before resolving a restored user', async () => {
    jest.useFakeTimers();

    const restoredUser = {
      id: 'restored-user',
    };

    const { supabase } = jest.requireMock('@/lib/supabase') as {
      supabase: {
        auth: {
          getSession: jest.Mock;
          onAuthStateChange: jest.Mock;
        };
      };
    };

    // getSession returns no session initially
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    // onAuthStateChange fires with a session after a delay
    supabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: { user: typeof restoredUser } | null) => void) => {
        setTimeout(() => {
          callback('SIGNED_IN', { user: restoredUser });
        }, 4000);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );

    const resolutionPromise = waitForInitialAuthUser(5000);

    await jest.advanceTimersByTimeAsync(4000);

    await expect(resolutionPromise).resolves.toEqual({
      user: restoredUser,
      source: 'ready',
    });
  });
});
