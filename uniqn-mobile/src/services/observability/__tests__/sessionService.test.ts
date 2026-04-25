import type { Session, User } from '@supabase/supabase-js';
import { sessionService, getSessionState } from '../sessionService';

const mockAuthStoreState = {
  status: 'authenticated' as 'authenticated' | 'unauthenticated' | 'loading',
  isInitialized: true,
  bootstrapSource: 'server' as 'none' | 'cache' | 'server',
  user: { uid: 'test-user-id', email: 'test@example.com' } as Record<string, unknown> | null,
  profile: { uid: 'test-user-id' } as Record<string, unknown> | null,
  reset: jest.fn(),
  checkAuthState: jest.fn().mockResolvedValue(undefined),
};

let supabaseAuthCallback: ((event: string, session: Session | null) => void) | null = null;
const mockUnsubscribe = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn((callback) => {
        supabaseAuthCallback = callback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }),
      refreshSession: jest.fn(),
      getSession: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => mockAuthStoreState),
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

// 실제 timer + 마이크로태스크 flush 패턴 (fake timers와 setImmediate 충돌 회피)
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const mockUser: User = {
  id: 'test-user-id',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

const mockSupabase = jest.requireMock('@/lib/supabase').supabase as {
  auth: {
    getUser: jest.Mock;
    signOut: jest.Mock;
    onAuthStateChange: jest.Mock;
    refreshSession: jest.Mock;
    getSession: jest.Mock;
    startAutoRefresh: jest.Mock;
    stopAutoRefresh: jest.Mock;
  };
};

describe('sessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseAuthCallback = null;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.isInitialized = true;
    mockAuthStoreState.bootstrapSource = 'server';
    mockAuthStoreState.user = { uid: 'test-user-id', email: 'test@example.com' };
    mockAuthStoreState.profile = { uid: 'test-user-id' };
    sessionService.cleanup();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('onAuthStateChange를 1회 구독한다', () => {
      sessionService.initialize();

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });

    it('중복 호출은 idempotent (구독 1회만)', () => {
      sessionService.initialize();
      sessionService.initialize();

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('초기화되지 않은 상태에서 호출 시 no-op', () => {
      expect(() => sessionService.cleanup()).not.toThrow();
      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('initialize 후 cleanup 시 구독 해제', () => {
      sessionService.initialize();
      sessionService.cleanup();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('[REGRESSION] cleanup 중복 호출해도 crash 없음', () => {
      sessionService.initialize();
      sessionService.cleanup();
      expect(() => sessionService.cleanup()).not.toThrow();
    });
  });

  describe('handleAuthStateChange (Supabase deadlock 회피)', () => {
    it('[REGRESSION] callback이 다음 tick으로 defer되어 deadlock 회피', async () => {
      // 다른 user로 호출되어 동기화가 발생하도록 store user를 다르게 설정
      mockAuthStoreState.user = { uid: 'different-user', email: 'other@example.com' };
      mockAuthStoreState.profile = null;

      sessionService.initialize();
      supabaseAuthCallback?.('SIGNED_IN', { user: mockUser } as Session);

      // 같은 tick에서는 미실행 (deferral 검증)
      expect(mockAuthStoreState.checkAuthState).not.toHaveBeenCalled();

      await tick();

      // 다음 tick에서 실행
      expect(mockAuthStoreState.checkAuthState).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('shouldSkipAuthStoreSync 분기', () => {
    it('동일 user의 TOKEN_REFRESHED 이벤트 시 authStore 재동기화 skip', async () => {
      sessionService.initialize();

      supabaseAuthCallback?.('TOKEN_REFRESHED', { user: mockUser } as Session);
      await tick();

      expect(mockAuthStoreState.checkAuthState).not.toHaveBeenCalled();
    });

    it('다른 user 이벤트 시 authStore 동기화', async () => {
      mockAuthStoreState.user = { uid: 'old-user', email: 'old@example.com' };
      mockAuthStoreState.profile = { uid: 'old-user' };

      sessionService.initialize();
      supabaseAuthCallback?.('SIGNED_IN', { user: mockUser } as Session);
      await tick();

      expect(mockAuthStoreState.checkAuthState).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('SIGNED_OUT 전파', () => {
    it('[REGRESSION] SDK가 SIGNED_OUT emit 시 authStore 초기화 호출', async () => {
      mockAuthStoreState.bootstrapSource = 'server';
      sessionService.initialize();

      supabaseAuthCallback?.('SIGNED_OUT', null);
      await tick();

      expect(mockAuthStoreState.checkAuthState).toHaveBeenCalledWith(null);
    });
  });

  describe('세션 유지 정책', () => {
    it('[REGRESSION] initialize 후 자동 signOut 타이머가 등록되지 않음', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      sessionService.initialize();

      // 30분 timeout / 50분 refresh interval 등 일체의 setInterval 등록 없음
      expect(setIntervalSpy).not.toHaveBeenCalled();
      expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });

    it('[REGRESSION] auth 이벤트 처리 시 수동 refreshSession 호출 안함 (SDK autoRefreshToken에 위임)', async () => {
      sessionService.initialize();

      supabaseAuthCallback?.('TOKEN_REFRESHED', { user: mockUser } as Session);
      await tick();

      expect(mockSupabase.auth.refreshSession).not.toHaveBeenCalled();
    });
  });

  describe('getSessionState', () => {
    it('인증된 상태에서 isActive=true', () => {
      mockAuthStoreState.status = 'authenticated';
      expect(getSessionState().isActive).toBe(true);
    });

    it('미인증 상태에서 isActive=false', () => {
      mockAuthStoreState.status = 'unauthenticated';
      expect(getSessionState().isActive).toBe(false);
    });
  });
});
