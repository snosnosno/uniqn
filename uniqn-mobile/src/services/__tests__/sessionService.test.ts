/**
 * UNIQN Mobile - Session Service 테스트
 *
 * @description sessionService.ts의 전체 기능 테스트
 */

import { AppState } from 'react-native';
import { router } from 'expo-router';
import { sessionService } from '../sessionService';
import type { AuthError } from '@/errors';

// ============================================================================
// Mocks
// ============================================================================

// Firebase Auth 모킹
const mockSignOut = jest.fn();
const mockGetIdToken = jest.fn();
const mockGetIdTokenResult = jest.fn();
const mockOnAuthStateChanged = jest.fn();

const mockCurrentUser = {
  getIdToken: mockGetIdToken,
  getIdTokenResult: mockGetIdTokenResult,
  uid: 'test-user-id',
};

const mockAuth = {
  currentUser: mockCurrentUser,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
};

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => mockAuth),
}));

// authStorage 모킹
const mockSetAuthToken = jest.fn();
const mockDeleteAuthToken = jest.fn();

jest.mock('@/lib/secureStorage', () => ({
  authStorage: {
    setAuthToken: mockSetAuthToken,
    deleteAuthToken: mockDeleteAuthToken,
  },
  userSessionStorage: {},
}));

// secureStorage (동적 import) 모킹
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockDeleteItem = jest.fn();

jest.mock('@/lib/secureStorage', () => ({
  authStorage: {
    setAuthToken: mockSetAuthToken,
    deleteAuthToken: mockDeleteAuthToken,
  },
  userSessionStorage: {},
  getItem: mockGetItem,
  setItem: mockSetItem,
  deleteItem: mockDeleteItem,
}));

// router 모킹
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: mockRouterReplace,
  },
}));

// authStore 모킹
const mockAuthStoreReset = jest.fn();
const mockAuthStoreGetState = jest.fn(() => ({ reset: mockAuthStoreReset }));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: mockAuthStoreGetState,
  },
}));

// toastStore 모킹
const mockAddToast = jest.fn();
const mockToastStoreGetState = jest.fn(() => ({ addToast: mockAddToast }));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: mockToastStoreGetState,
  },
}));

// logger 모킹
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerDebug = jest.fn();

jest.mock('@/utils/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  },
}));

// crashlyticsService 모킹
const mockRecordError = jest.fn();

jest.mock('../crashlyticsService', () => ({
  crashlyticsService: {
    recordError: mockRecordError,
  },
}));

// errors 모킹
jest.mock('@/errors', () => ({
  AuthError: class MockAuthError extends Error {
    code: string;
    constructor(code: string, options?: { userMessage?: string; metadata?: Record<string, unknown> }) {
      super(options?.userMessage || code);
      this.code = code;
      this.name = 'AuthError';
    }
  },
  ERROR_CODES: {
    AUTH_RATE_LIMITED: 'E2006',
  },
  toError: (error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  },
  isAppError: (error: unknown) => {
    return error instanceof Error && 'code' in error;
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

function mockTokenExpiry(minutesFromNow: number): void {
  const expirationTime = new Date(Date.now() + minutesFromNow * 60 * 1000);
  mockGetIdTokenResult.mockResolvedValue({
    token: 'test-token',
    expirationTime: expirationTime.toISOString(),
  });
}

// ============================================================================
// Test Suites
// ============================================================================

describe('sessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuth.currentUser = mockCurrentUser;
    mockGetIdToken.mockResolvedValue('test-token');
    mockTokenExpiry(30); // 기본값: 30분 후 만료
  });

  afterEach(() => {
    sessionService.cleanup();
    jest.useRealTimers();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('initialize', () => {
    it('AppState 리스너를 등록해야 함', () => {
      const mockAddEventListener = jest.spyOn(AppState, 'addEventListener');

      sessionService.initialize();

      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockLoggerInfo).toHaveBeenCalledWith('세션 매니저 초기화 완료');
    });

    it('Firebase Auth 상태 변경 리스너를 등록해야 함', () => {
      sessionService.initialize();

      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(expect.any(Function));
    });

    it('중복 초기화 시 무시해야 함', () => {
      sessionService.initialize();
      jest.clearAllMocks();

      sessionService.initialize();

      expect(mockOnAuthStateChanged).not.toHaveBeenCalled();
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('모든 리스너와 타이머를 정리해야 함', () => {
      const mockRemove = jest.fn();
      const mockUnsubscribe = jest.fn();
      jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: mockRemove });
      mockOnAuthStateChanged.mockReturnValue(mockUnsubscribe);

      sessionService.initialize();
      sessionService.cleanup();

      expect(mockRemove).toHaveBeenCalled();
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockLoggerInfo).toHaveBeenCalledWith('세션 매니저 정리 완료');
    });
  });

  // ==========================================================================
  // Session Management Tests
  // ==========================================================================

  describe('recordActivity', () => {
    it('활동 시간을 기록하고 타이머를 리셋해야 함', () => {
      sessionService.initialize();

      sessionService.recordActivity();

      const state = sessionService.getSessionState();
      expect(state.lastActivity).toBeGreaterThan(Date.now() - 100);
    });
  });

  describe('isSessionActive', () => {
    it('로그인되지 않았으면 false를 반환해야 함', () => {
      mockAuth.currentUser = null;

      const result = sessionService.isSessionActive();

      expect(result).toBe(false);
    });

    it('최근 활동이 있으면 true를 반환해야 함', () => {
      sessionService.initialize();
      sessionService.recordActivity();

      const result = sessionService.isSessionActive();

      expect(result).toBe(true);
    });

    it('30분 이상 비활성이면 false를 반환해야 함', () => {
      sessionService.initialize();

      // 31분 경과
      jest.advanceTimersByTime(31 * 60 * 1000);

      const result = sessionService.isSessionActive();

      expect(result).toBe(false);
    });
  });

  describe('getSessionState', () => {
    it('현재 세션 상태를 반환해야 함', () => {
      sessionService.initialize();
      sessionService.recordActivity();

      const state = sessionService.getSessionState();

      expect(state).toEqual({
        isActive: true,
        lastActivity: expect.any(Number),
        tokenExpiresAt: null,
      });
    });

    it('로그아웃 상태면 isActive가 false여야 함', () => {
      mockAuth.currentUser = null;

      const state = sessionService.getSessionState();

      expect(state.isActive).toBe(false);
    });
  });

  describe('앱 상태 변경 처리', () => {
    it('포그라운드 복귀 시 세션을 체크해야 함', async () => {
      let appStateCallback: ((state: string) => void) | undefined;
      jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
        if (event === 'change') {
          appStateCallback = callback as (state: string) => void;
        }
        return { remove: jest.fn() };
      });

      sessionService.initialize();

      // 백그라운드 → 포그라운드
      appStateCallback?.('active');

      expect(mockLoggerDebug).toHaveBeenCalledWith('앱 포그라운드 복귀 - 세션 체크');
    });

    it('백그라운드 전환 시 타이머를 중지해야 함', () => {
      let appStateCallback: ((state: string) => void) | undefined;
      jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
        if (event === 'change') {
          appStateCallback = callback as (state: string) => void;
        }
        return { remove: jest.fn() };
      });

      sessionService.initialize();

      // 포그라운드 → 백그라운드
      appStateCallback?.('background');

      expect(mockLoggerDebug).toHaveBeenCalledWith('앱 백그라운드 전환 - 세션 타이머 중지');
    });
  });

  describe('세션 타임아웃', () => {
    it('30분 비활성 후 세션을 만료시켜야 함', async () => {
      let authCallback: ((user: unknown) => void) | undefined;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return jest.fn();
      });

      sessionService.initialize();

      // 로그인 시뮬레이션
      authCallback?.(mockCurrentUser);

      // 타이머가 설정되었는지 확인하기 위해 30분 경과
      jest.advanceTimersByTime(30 * 60 * 1000 + 1000);

      // Promise 처리를 위해 대기
      await jest.runAllTimersAsync();

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'warning',
        message: expect.stringContaining('비활성으로 인해 세션이 만료'),
      });
      expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  // ==========================================================================
  // Token Management Tests
  // ==========================================================================

  describe('refreshToken', () => {
    it('토큰을 성공적으로 갱신해야 함', async () => {
      const newToken = 'new-test-token';
      mockGetIdToken.mockResolvedValue(newToken);
      mockSetAuthToken.mockResolvedValue(undefined);

      const result = await sessionService.refreshToken();

      expect(result).toBe(newToken);
      expect(mockGetIdToken).toHaveBeenCalledWith(true); // force refresh
      expect(mockSetAuthToken).toHaveBeenCalledWith(newToken);
      expect(mockLoggerInfo).toHaveBeenCalledWith('토큰 갱신 성공');
    });

    it('로그인되지 않았으면 null을 반환해야 함', async () => {
      mockAuth.currentUser = null;

      const result = await sessionService.refreshToken();

      expect(result).toBeNull();
      expect(mockLoggerWarn).toHaveBeenCalledWith('토큰 갱신 실패 - 로그인 필요');
    });

    it('토큰 갱신 실패 시 세션을 만료시켜야 함', async () => {
      mockGetIdToken.mockRejectedValue(new Error('토큰 갱신 실패'));

      const result = await sessionService.refreshToken();

      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockRecordError).toHaveBeenCalled();

      // Promise 처리를 위해 대기
      await jest.runAllTimersAsync();

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'warning',
        message: expect.stringContaining('인증 토큰 갱신에 실패'),
      });
    });
  });

  describe('getValidToken', () => {
    it('유효한 토큰을 그대로 반환해야 함', async () => {
      mockTokenExpiry(30); // 30분 후 만료

      const result = await sessionService.getValidToken();

      expect(result).toBe('test-token');
      expect(mockGetIdToken).not.toHaveBeenCalledWith(true); // force refresh 안 함
    });

    it('만료 임박 시 토큰을 갱신해야 함', async () => {
      mockTokenExpiry(3); // 3분 후 만료 (5분 미만)
      const newToken = 'refreshed-token';
      mockGetIdToken.mockResolvedValue(newToken);

      const result = await sessionService.getValidToken();

      expect(result).toBe(newToken);
      expect(mockGetIdToken).toHaveBeenCalledWith(true); // force refresh
    });

    it('로그인되지 않았으면 null을 반환해야 함', async () => {
      mockAuth.currentUser = null;

      const result = await sessionService.getValidToken();

      expect(result).toBeNull();
    });

    it('토큰 가져오기 실패 시 null을 반환해야 함', async () => {
      mockGetIdTokenResult.mockRejectedValue(new Error('토큰 가져오기 실패'));

      const result = await sessionService.getValidToken();

      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  describe('토큰 자동 갱신', () => {
    it('Firebase Auth 상태 변경 시 토큰 강제 갱신을 시도해야 함', async () => {
      let authCallback: ((user: unknown) => void) | undefined;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return jest.fn();
      });

      sessionService.initialize();

      // 로그인 시뮬레이션
      authCallback?.(mockCurrentUser);

      // Promise 처리를 위해 대기
      await jest.runAllTimersAsync();

      expect(mockGetIdToken).toHaveBeenCalledWith(true);
      expect(mockLoggerDebug).toHaveBeenCalledWith('토큰 강제 갱신 완료 (Custom Claims 로드)');
    });

    it('50분마다 토큰을 갱신해야 함', async () => {
      let authCallback: ((user: unknown) => void) | undefined;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return jest.fn();
      });

      sessionService.initialize();

      // 로그인 시뮬레이션
      authCallback?.(mockCurrentUser);

      jest.clearAllMocks();

      // 50분 경과
      jest.advanceTimersByTime(50 * 60 * 1000);

      // Promise 처리
      await jest.runAllTimersAsync();

      expect(mockGetIdTokenResult).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Login Attempts Management Tests
  // ==========================================================================

  describe('checkLoginAttempts', () => {
    const testEmail = 'test@example.com';

    it('시도 횟수가 없으면 정상 통과해야 함', async () => {
      mockGetItem.mockResolvedValue(null);

      await expect(sessionService.checkLoginAttempts(testEmail)).resolves.toBeUndefined();
    });

    it('잠금 상태면 AuthError를 던져야 함', async () => {
      mockGetItem.mockResolvedValue({
        count: 5,
        lockUntil: Date.now() + 10 * 60 * 1000, // 10분 후
        lastAttempt: Date.now(),
      });

      await expect(sessionService.checkLoginAttempts(testEmail)).rejects.toMatchObject({
        name: 'AuthError',
        code: 'E2006',
        message: expect.stringContaining('로그인 시도 횟수를 초과'),
      });
    });

    it('잠금 해제 시간이 지났으면 초기화해야 함', async () => {
      mockGetItem.mockResolvedValue({
        count: 5,
        lockUntil: Date.now() - 1000, // 이미 지남
        lastAttempt: Date.now() - 20 * 60 * 1000,
      });
      mockDeleteItem.mockResolvedValue(undefined);

      await expect(sessionService.checkLoginAttempts(testEmail)).resolves.toBeUndefined();
      expect(mockDeleteItem).toHaveBeenCalledWith(`login_attempts_${testEmail}`);
    });

    it('에러 발생 시 조용히 통과해야 함 (AppError 제외)', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      await expect(sessionService.checkLoginAttempts(testEmail)).resolves.toBeUndefined();
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  describe('incrementLoginAttempts', () => {
    const testEmail = 'test@example.com';

    it('시도 횟수를 1 증가시켜야 함', async () => {
      mockGetItem.mockResolvedValue(null);
      mockSetItem.mockResolvedValue(undefined);

      await sessionService.incrementLoginAttempts(testEmail);

      expect(mockSetItem).toHaveBeenCalledWith(
        `login_attempts_${testEmail}`,
        expect.objectContaining({
          count: 1,
          lockUntil: null,
          lastAttempt: expect.any(Number),
        })
      );
    });

    it('기존 시도 횟수에서 증가시켜야 함', async () => {
      mockGetItem.mockResolvedValue({
        count: 3,
        lockUntil: null,
        lastAttempt: Date.now() - 1000,
      });
      mockSetItem.mockResolvedValue(undefined);

      await sessionService.incrementLoginAttempts(testEmail);

      expect(mockSetItem).toHaveBeenCalledWith(
        `login_attempts_${testEmail}`,
        expect.objectContaining({
          count: 4,
          lockUntil: null,
        })
      );
    });

    it('5회 이상 시도 시 계정을 잠가야 함', async () => {
      mockGetItem.mockResolvedValue({
        count: 4,
        lockUntil: null,
        lastAttempt: Date.now() - 1000,
      });
      mockSetItem.mockResolvedValue(undefined);

      await sessionService.incrementLoginAttempts(testEmail);

      expect(mockSetItem).toHaveBeenCalledWith(
        `login_attempts_${testEmail}`,
        expect.objectContaining({
          count: 5,
          lockUntil: expect.any(Number),
        })
      );
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '로그인 시도 횟수 초과 - 계정 잠금',
        expect.objectContaining({ email: expect.stringContaining('***') })
      );
    });

    it('에러 발생 시 조용히 실패해야 함', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      await expect(sessionService.incrementLoginAttempts(testEmail)).resolves.toBeUndefined();
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  describe('resetLoginAttempts', () => {
    const testEmail = 'test@example.com';

    it('시도 횟수를 초기화해야 함', async () => {
      mockDeleteItem.mockResolvedValue(undefined);

      await sessionService.resetLoginAttempts(testEmail);

      expect(mockDeleteItem).toHaveBeenCalledWith(`login_attempts_${testEmail}`);
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        '로그인 시도 횟수 초기화',
        expect.objectContaining({ email: expect.stringContaining('***') })
      );
    });

    it('에러 발생 시 조용히 실패해야 함', async () => {
      mockDeleteItem.mockRejectedValue(new Error('Storage error'));

      await expect(sessionService.resetLoginAttempts(testEmail)).resolves.toBeUndefined();
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  describe('getRemainingLoginAttempts', () => {
    const testEmail = 'test@example.com';

    it('시도 횟수가 없으면 최대값을 반환해야 함', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await sessionService.getRemainingLoginAttempts(testEmail);

      expect(result).toBe(5);
    });

    it('남은 시도 횟수를 계산해야 함', async () => {
      mockGetItem.mockResolvedValue({
        count: 3,
        lockUntil: null,
        lastAttempt: Date.now(),
      });

      const result = await sessionService.getRemainingLoginAttempts(testEmail);

      expect(result).toBe(2); // 5 - 3 = 2
    });

    it('최소 0을 반환해야 함', async () => {
      mockGetItem.mockResolvedValue({
        count: 10,
        lockUntil: Date.now() + 10000,
        lastAttempt: Date.now(),
      });

      const result = await sessionService.getRemainingLoginAttempts(testEmail);

      expect(result).toBe(0);
    });

    it('에러 발생 시 최대값을 반환해야 함', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      const result = await sessionService.getRemainingLoginAttempts(testEmail);

      expect(result).toBe(5);
    });
  });
});
