import { AppState } from 'react-native';
import {
  checkLoginAttempts,
  getRemainingLoginAttempts,
  getValidToken,
  incrementLoginAttempts,
  refreshToken,
  resetLoginAttempts,
  sessionService,
} from '../sessionService';

const mockAuth = {
  currentUser: {
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    uid: 'test-user-id',
  } as {
    getIdToken: jest.Mock;
    getIdTokenResult: jest.Mock;
    uid: string;
  } | null,
  onAuthStateChanged: jest.fn(),
};

const mockAuthStoreSubscribers = new Set<() => void>();
const mockToastAddToast = jest.fn();
const mockAuthStoreState = {
  status: 'authenticated',
  suppressedSessionUserId: null as string | null,
  reset: jest.fn(),
  checkAuthState: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => mockAuth),
}));

jest.mock('@/lib/authBridge', () => ({
  syncSignOut: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/secureStorage', () => ({
  authStorage: {
    setAuthToken: jest.fn(),
  },
  userSessionStorage: {},
  getItem: jest.fn(),
  setItem: jest.fn(),
  deleteItem: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => mockAuthStoreState),
    subscribe: jest.fn((listener: () => void) => {
      mockAuthStoreSubscribers.add(listener);
      return () => {
        mockAuthStoreSubscribers.delete(listener);
      };
    }),
  },
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: jest.fn(() => ({ addToast: mockToastAddToast })),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../crashlyticsService', () => ({
  crashlyticsService: {
    recordError: jest.fn(),
  },
}));

jest.mock('@/shared/realtime', () => ({
  RealtimeManager: {
    unsubscribeAll: jest.fn(),
  },
}));

jest.mock('@/shared/cache/counterSyncCache', () => ({
  clearCounterSyncCache: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  AuthError: class MockAuthError extends Error {
    code: string;

    constructor(
      code: string,
      options?: { userMessage?: string; metadata?: Record<string, unknown> }
    ) {
      super(options?.userMessage || code);
      this.code = code;
      this.name = 'AuthError';
    }
  },
  ERROR_CODES: {
    AUTH_RATE_LIMITED: 'E2006',
  },
  isAppError: (error: unknown) => error instanceof Error && 'code' in error,
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
}));

const { authStorage, deleteItem, getItem, setItem } = jest.requireMock('@/lib/secureStorage') as {
  authStorage: { setAuthToken: jest.Mock };
  deleteItem: jest.Mock;
  getItem: jest.Mock;
  setItem: jest.Mock;
};
const { syncSignOut } = jest.requireMock('@/lib/authBridge') as {
  syncSignOut: jest.Mock;
};
const { router } = jest.requireMock('expo-router') as {
  router: { replace: jest.Mock };
};
const { useToastStore } = jest.requireMock('@/stores/toastStore') as {
  useToastStore: { getState: jest.Mock };
};
const mockAddToast = (useToastStore.getState() as { addToast: jest.Mock }).addToast;
const { RealtimeManager } = jest.requireMock('@/shared/realtime') as {
  RealtimeManager: { unsubscribeAll: jest.Mock };
};
const { clearCounterSyncCache } = jest.requireMock('@/shared/cache/counterSyncCache') as {
  clearCounterSyncCache: jest.Mock;
};

function setAuthStoreState(partial: Partial<typeof mockAuthStoreState>) {
  Object.assign(mockAuthStoreState, partial);
  mockAuthStoreSubscribers.forEach((listener) => listener());
}

function mockTokenExpiry(minutesFromNow: number) {
  const expirationTime = new Date(Date.now() + minutesFromNow * 60 * 1000);
  mockAuth.currentUser?.getIdTokenResult.mockResolvedValue({
    token: 'test-token',
    expirationTime: expirationTime.toISOString(),
  });
}

describe('sessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuthStoreSubscribers.clear();
    mockAuth.currentUser = {
      getIdToken: jest.fn().mockResolvedValue('test-token'),
      getIdTokenResult: jest.fn(),
      uid: 'test-user-id',
    };
    mockAuth.onAuthStateChanged.mockImplementation(() => jest.fn());
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.suppressedSessionUserId = null;
    mockAuthStoreState.reset.mockReset();
    mockAuthStoreState.checkAuthState.mockResolvedValue(undefined);
    mockToastAddToast.mockReset();
    mockTokenExpiry(30);
  });

  afterEach(() => {
    sessionService.cleanup();
    jest.useRealTimers();
  });

  it('registers listeners on initialize and cleans them up', () => {
    const remove = jest.fn();
    const unsubscribe = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
    mockAuth.onAuthStateChanged.mockReturnValue(unsubscribe);

    sessionService.initialize();
    sessionService.cleanup();

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mockAuth.onAuthStateChanged).toHaveBeenCalledWith(expect.any(Function));
    expect(remove).toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('keeps suppressed auto-login sessions inactive', async () => {
    let authCallback: ((user: typeof mockAuth.currentUser | null) => void) | undefined;
    mockAuth.onAuthStateChanged.mockImplementation((callback) => {
      authCallback = callback;
      return jest.fn();
    });
    setAuthStoreState({
      status: 'unauthenticated',
      suppressedSessionUserId: 'test-user-id',
    });

    sessionService.initialize();
    authCallback?.(mockAuth.currentUser);
    await jest.runOnlyPendingTimersAsync();

    expect(mockAuthStoreState.checkAuthState).toHaveBeenCalledWith(mockAuth.currentUser);
    expect(mockAuth.currentUser?.getIdToken).not.toHaveBeenCalled();
    expect(sessionService.getSessionState().isActive).toBe(false);
    expect(sessionService.isSessionActive()).toBe(false);
  });

  it('starts session timers after suppressed session becomes authenticated again', async () => {
    setAuthStoreState({
      status: 'unauthenticated',
      suppressedSessionUserId: 'test-user-id',
    });

    sessionService.initialize();
    jest.clearAllMocks();

    setAuthStoreState({
      status: 'authenticated',
      suppressedSessionUserId: null,
    });

    expect(sessionService.isSessionActive()).toBe(true);
    await jest.runOnlyPendingTimersAsync();
    await jest.advanceTimersByTimeAsync(50 * 60 * 1000);

    expect(mockAuth.currentUser?.getIdTokenResult).toHaveBeenCalled();
    expect(sessionService.getSessionState().isActive).toBe(true);
  });

  it('expires managed sessions after inactivity', async () => {
    let authCallback: ((user: typeof mockAuth.currentUser | null) => void) | undefined;
    mockAuth.onAuthStateChanged.mockImplementation((callback) => {
      authCallback = callback;
      return jest.fn();
    });

    sessionService.initialize();
    authCallback?.(mockAuth.currentUser);
    await jest.runOnlyPendingTimersAsync();
    await jest.advanceTimersByTimeAsync(30 * 60 * 1000 + 1000);

    expect(RealtimeManager.unsubscribeAll).toHaveBeenCalled();
    expect(clearCounterSyncCache).toHaveBeenCalled();
    expect(syncSignOut).toHaveBeenCalled();
    expect(mockAuthStoreState.reset).toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'warning',
      message: expect.stringContaining('다시 로그인해 주세요.'),
    });
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('refreshes tokens successfully', async () => {
    const token = await refreshToken();

    expect(token).toBe('test-token');
    expect(mockAuth.currentUser?.getIdToken).toHaveBeenCalledWith(true);
    expect(authStorage.setAuthToken).toHaveBeenCalledWith('test-token');
  });

  it('expires the session when token refresh fails', async () => {
    mockAuth.currentUser?.getIdToken.mockRejectedValue(new Error('refresh failed'));

    const token = await refreshToken();

    expect(token).toBeNull();
    expect(syncSignOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('returns a refreshed token when the current token is near expiry', async () => {
    mockTokenExpiry(3);
    mockAuth.currentUser?.getIdToken.mockResolvedValue('new-token');

    const token = await getValidToken();

    expect(token).toBe('new-token');
    expect(mockAuth.currentUser?.getIdToken).toHaveBeenCalledWith(true);
  });

  it('tracks login attempts and resets them', async () => {
    getItem.mockResolvedValue(null);
    setItem.mockResolvedValue(undefined);
    deleteItem.mockResolvedValue(undefined);

    await incrementLoginAttempts('test@example.com');
    await resetLoginAttempts('test@example.com');

    expect(setItem).toHaveBeenCalledWith(
      'login_attempts_test@example.com',
      expect.objectContaining({
        count: 1,
        lockUntil: null,
      })
    );
    expect(deleteItem).toHaveBeenCalledWith('login_attempts_test@example.com');
  });

  it('throws when login attempts are currently locked', async () => {
    getItem.mockResolvedValue({
      count: 5,
      lockUntil: Date.now() + 10 * 60 * 1000,
      lastAttempt: Date.now(),
    });

    await expect(checkLoginAttempts('test@example.com')).rejects.toMatchObject({
      name: 'AuthError',
      code: 'E2006',
    });
  });

  it('returns remaining login attempts', async () => {
    getItem.mockResolvedValue({
      count: 2,
      lockUntil: null,
      lastAttempt: Date.now(),
    });

    await expect(getRemainingLoginAttempts('test@example.com')).resolves.toBe(3);
  });
});
