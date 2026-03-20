import { resolveSession, waitForInitialAuthUser } from '@/hooks/useAppInitialize';

const mockClearAuthState = jest.fn();
const mockClearAuthUiState = jest.fn();
const mockSetBootstrapSource = jest.fn();
const mockSetNeedsServerReconcile = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockTrackLogout = jest.fn();
const mockSetUserId = jest.fn().mockResolvedValue(undefined);
const mockFirebaseAuth = {
  currentUser: null as unknown,
  authStateReady: jest.fn(),
  onAuthStateChanged: jest.fn(),
};

const mockAuthStoreState = {
  user: null as { uid: string } | null,
  profile: null as { uid: string } | null,
  status: 'unauthenticated',
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

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => mockAuthStoreState),
  },
  waitForHydration: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/stores/appStartupStore', () => ({
  useAppStartupStore: jest.fn(),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: {
    getState: jest.fn(() => ({ setUnreadCount: jest.fn() })),
  },
}));

jest.mock('@/lib/env', () => ({
  validateEnv: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  tryInitializeFirebase: jest.fn(),
  getFirebaseAuth: jest.fn(() => mockFirebaseAuth),
}));

jest.mock('@/lib/authBridge', () => ({
  ensureDualSdkSync: jest.fn(),
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
    mockAuthStoreState.user = null;
    mockAuthStoreState.profile = null;
    mockAuthStoreState.status = 'unauthenticated';
    mockFirebaseAuth.currentUser = null;
    mockFirebaseAuth.authStateReady.mockResolvedValue(undefined);
    mockFirebaseAuth.onAuthStateChanged.mockReset();
  });

  it('signs out restored Firebase session when auto login is disabled', async () => {
    const result = await resolveSession({
      authUser: {
        uid: 'user-1',
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
        uid: 'user-1',
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

describe('waitForInitialAuthUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirebaseAuth.currentUser = null;
    mockFirebaseAuth.onAuthStateChanged.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for authStateReady before resolving a restored user', async () => {
    jest.useFakeTimers();

    const restoredUser = {
      uid: 'restored-user',
    };

    mockFirebaseAuth.authStateReady.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            mockFirebaseAuth.currentUser = restoredUser;
            resolve();
          }, 4000);
        })
    );

    const resolutionPromise = waitForInitialAuthUser(5000);

    await jest.advanceTimersByTimeAsync(4000);

    await expect(resolutionPromise).resolves.toEqual({
      user: restoredUser,
      source: 'ready',
    });
  });
});
