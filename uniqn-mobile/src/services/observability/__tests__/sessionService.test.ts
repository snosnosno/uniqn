import { AppState, Platform } from 'react-native';
import {
  checkLoginAttempts,
  getRemainingLoginAttempts,
  getValidToken,
  incrementLoginAttempts,
  refreshToken,
  resetLoginAttempts,
  sessionService,
} from '../sessionService';

const mockAuth: {
  currentUser: {
    getIdToken: jest.Mock;
    getIdTokenResult: jest.Mock;
    uid: string;
  } | null;
  authStateReady?: jest.Mock;
  onAuthStateChanged: jest.Mock;
} = {
  currentUser: {
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    uid: 'test-user-id',
  },
  authStateReady: jest.fn(),
  onAuthStateChanged: jest.fn(),
};

const mockAuthStoreSubscribers = new Set<() => void>();
const mockToastAddToast = jest.fn();
const mockAuthStoreState = {
  status: 'authenticated',
  bootstrapSource: 'server' as 'none' | 'cache' | 'server',
  suppressedSessionUserId: null as string | null,
  user: { uid: 'test-user-id', email: 'test@example.com' } as Record<string, unknown> | null,
  reset: jest.fn(),
  checkAuthState: jest.fn().mockResolvedValue(undefined),
};

const mockRefreshSession = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
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

jest.mock('../sentryService', () => ({
  sentryService: {
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
const { supabase: mockSupabase } = jest.requireMock('@/lib/supabase') as {
  supabase: {
    auth: { signOut: jest.Mock; onAuthStateChange: jest.Mock; getUser: jest.Mock };
  };
};
const syncSignOut = mockSupabase.auth.signOut;
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
    mockAuth.authStateReady = jest.fn();
    mockAuth.onAuthStateChanged.mockImplementation(() => jest.fn());
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.bootstrapSource = 'server';
    mockAuthStoreState.suppressedSessionUserId = null;
    mockAuthStoreState.user = { uid: 'test-user-id', email: 'test@example.com' };
    mockAuthStoreState.reset.mockReset();
    mockAuthStoreState.checkAuthState.mockResolvedValue(undefined);
    mockToastAddToast.mockReset();
    mockTokenExpiry(30);
    // clearAllMocks는 구현을 지우므로 기본값 명시적 복원
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSupabase.auth.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    }));
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'new-token' } },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });
  });

  afterEach(() => {
    sessionService.cleanup();
    jest.useRealTimers();
  });

  it('registers listeners on initialize and cleans them up', () => {
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });

    sessionService.initialize();

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledWith(expect.any(Function));

    sessionService.cleanup();

    expect(remove).toHaveBeenCalled();
  });

  it('keeps suppressed auto-login sessions inactive', async () => {
    const supabaseUser = { id: 'test-user-id', email: 'test@example.com' };
    let supabaseAuthCallback:
      | ((event: string, session: { user: typeof supabaseUser } | null) => void)
      | undefined;
    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: { user: typeof supabaseUser } | null) => void) => {
        supabaseAuthCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );
    setAuthStoreState({
      status: 'unauthenticated',
      suppressedSessionUserId: 'test-user-id',
    });

    sessionService.initialize();
    supabaseAuthCallback?.('SIGNED_IN', { user: supabaseUser });
    await jest.runOnlyPendingTimersAsync();

    expect(mockAuthStoreState.checkAuthState).toHaveBeenCalledWith(supabaseUser);
    expect(sessionService.getSessionState().isActive).toBe(false);
    expect(sessionService.isSessionActive()).toBe(false);
  });

  it('ignores a transient null auth event while Supabase restores the session', async () => {
    // Arrange: guard가 활성화되는 조건 — cache 부트스트랩 + 인증 상태 + user 없음
    setAuthStoreState({
      status: 'authenticated',
      bootstrapSource: 'cache',
      user: null,
    });

    // getUser()는 null 반환 (아직 복원 중)
    const restoredUser = { id: 'test-user-id', email: 'test@example.com' };
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    // waitForRestoredAuthUser 내 임시 onAuthStateChange가 복원된 user 전달
    let restoreCallback:
      | ((event: string, session: { user: typeof restoredUser } | null) => void)
      | undefined;
    let mainAuthCallback:
      | ((event: string, session: { user: typeof restoredUser } | null) => void)
      | undefined;
    const restoreUnsubscribe = jest.fn();

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: { user: typeof restoredUser } | null) => void) => {
        if (!mainAuthCallback) {
          // 첫 번째 호출 = initialize()의 메인 구독
          mainAuthCallback = callback;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }
        // 두 번째 호출 = waitForRestoredAuthUser 내 임시 구독
        restoreCallback = callback;
        return { data: { subscription: { unsubscribe: restoreUnsubscribe } } };
      }
    );

    sessionService.initialize();

    // Act: 메인 콜백에 null 이벤트 전달 (transient null)
    const handlePromise = mainAuthCallback?.('INITIAL_SESSION', null);

    // 임시 구독이 복원된 user를 전달
    await Promise.resolve();
    restoreCallback?.('SIGNED_IN', { user: restoredUser });

    await handlePromise;
    await jest.runOnlyPendingTimersAsync();

    // Assert: null이 아닌 복원된 user로 checkAuthState가 호출됨
    expect(mockAuthStoreState.checkAuthState).toHaveBeenCalledWith(restoredUser);
    expect(mockAuthStoreState.checkAuthState).not.toHaveBeenCalledWith(null);
  });

  it('ignores a synchronous initial null auth snapshot while Supabase restores the session', async () => {
    // Arrange: guard 활성화 조건 — cache 부트스트랩 + 인증 상태 + user 없음
    setAuthStoreState({
      status: 'authenticated',
      bootstrapSource: 'cache',
      user: null,
    });

    const restoredUser = { id: 'test-user-id', email: 'test@example.com' };

    // getUser()가 즉시 복원된 user를 반환 (동기 초기 null 처리)
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: restoredUser }, error: null });

    let mainAuthCallback:
      | ((event: string, session: { user: typeof restoredUser } | null) => void)
      | undefined;
    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: { user: typeof restoredUser } | null) => void) => {
        mainAuthCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );

    sessionService.initialize();

    // Act: null 이벤트 전달 (초기 null 스냅샷)
    const handlePromise = mainAuthCallback?.('INITIAL_SESSION', null);
    await handlePromise;
    await jest.runOnlyPendingTimersAsync();

    // Assert: getUser()가 반환한 복원된 user로 checkAuthState 호출
    expect(mockAuthStoreState.checkAuthState).toHaveBeenCalledWith(restoredUser);
    expect(mockAuthStoreState.checkAuthState).not.toHaveBeenCalledWith(null);
  });

  it('does not delay a real null auth event after startup restore guard is absent', async () => {
    let supabaseAuthCallback: ((event: string, session: null) => void | Promise<void>) | undefined;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: null) => void | Promise<void>) => {
        supabaseAuthCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );

    sessionService.initialize();
    jest.clearAllMocks();

    const nullEventPromise = supabaseAuthCallback?.('SIGNED_OUT', null);
    await Promise.resolve();

    expect(mockAuthStoreState.checkAuthState).toHaveBeenCalledWith(null);
    await nullEventPromise;
  });

  it('cleans up the temporary restore listener after waitForRestoredAuthUser resolves', async () => {
    // Arrange: guard 활성화 조건 — cache 부트스트랩 + 인증 상태 + user 없음
    setAuthStoreState({
      status: 'authenticated',
      bootstrapSource: 'cache',
      user: null,
    });

    const restoredUser = { id: 'test-user-id', email: 'test@example.com' };

    // getUser()는 null 반환 — waitForRestoredAuthUser가 임시 onAuthStateChange 구독으로 진입
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    let mainAuthCallback:
      | ((event: string, session: { user: typeof restoredUser } | null) => void)
      | undefined;
    let restoreCallback:
      | ((event: string, session: { user: typeof restoredUser } | null) => void)
      | undefined;
    const restoreUnsubscribe = jest.fn();

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: { user: typeof restoredUser } | null) => void) => {
        if (!mainAuthCallback) {
          mainAuthCallback = callback;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }
        restoreCallback = callback;
        return { data: { subscription: { unsubscribe: restoreUnsubscribe } } };
      }
    );

    sessionService.initialize();

    // Act: null 이벤트 → waitForRestoredAuthUser 진입 → 임시 구독 생성
    const handlePromise = mainAuthCallback?.('INITIAL_SESSION', null);

    await Promise.resolve();
    // 임시 구독이 복원된 user 전달 → Promise resolve
    restoreCallback?.('SIGNED_IN', { user: restoredUser });

    await handlePromise;
    await jest.runOnlyPendingTimersAsync();

    // Assert: 임시 restore 구독이 settled 후 해제됨
    expect(restoreUnsubscribe).toHaveBeenCalled();
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

    // Supabase handles token refresh via getSession, not getIdTokenResult
    expect(mockGetSession).toHaveBeenCalled();
    expect(sessionService.getSessionState().isActive).toBe(true);
  });

  it('does not force-refresh the token on web auth changes', async () => {
    const originalPlatform = Platform.OS;
    const supabaseUser = { id: 'test-user-id', email: 'test@example.com' };
    let supabaseAuthCallback:
      | ((event: string, session: { user: typeof supabaseUser } | null) => void)
      | undefined;

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: { user: typeof supabaseUser } | null) => void) => {
        supabaseAuthCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );

    try {
      sessionService.initialize();
      supabaseAuthCallback?.('SIGNED_IN', { user: supabaseUser });
      await jest.runOnlyPendingTimersAsync();

      // Supabase handles tokens automatically - just verify getSession was called for token check
      expect(mockGetSession).toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('expires managed sessions after inactivity', async () => {
    const supabaseUser = { id: 'test-user-id', email: 'test@example.com' };
    let supabaseAuthCallback:
      | ((event: string, session: { user: typeof supabaseUser } | null) => void)
      | undefined;
    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (callback: (event: string, session: { user: typeof supabaseUser } | null) => void) => {
        supabaseAuthCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );

    sessionService.initialize();
    supabaseAuthCallback?.('SIGNED_IN', { user: supabaseUser });
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

    expect(token).toBe('new-token');
    expect(mockRefreshSession).toHaveBeenCalled();
    expect(authStorage.setAuthToken).toHaveBeenCalledWith('new-token');
  });

  it('expires the session when token refresh fails', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'refresh failed' },
    });

    const token = await refreshToken();

    expect(token).toBeNull();
    expect(syncSignOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('returns the current session token when available', async () => {
    const token = await getValidToken();

    expect(token).toBe('test-token');
    expect(mockGetSession).toHaveBeenCalled();
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
