import {
  checkLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
  getRemainingLoginAttempts,
} from '../loginAttemptService';

jest.mock('@/lib/secureStorage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  deleteItem: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
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

const { getItem, setItem, deleteItem } = jest.requireMock('@/lib/secureStorage') as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  deleteItem: jest.Mock;
};

const TEST_EMAIL = 'user@example.com';
const KEY = `login_attempts_${TEST_EMAIL.toLowerCase()}`;

describe('loginAttemptService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('checkLoginAttempts', () => {
    it('기록 없으면 통과', async () => {
      getItem.mockResolvedValueOnce(null);
      await expect(checkLoginAttempts(TEST_EMAIL)).resolves.toBeUndefined();
    });

    it('잠금 만료 시간 이전이면 AuthError throw', async () => {
      getItem.mockResolvedValueOnce({
        count: 5,
        lockUntil: Date.now() + 5 * 60 * 1000,
        lastAttempt: Date.now(),
      });

      await expect(checkLoginAttempts(TEST_EMAIL)).rejects.toThrow();
    });

    it('잠금 만료 시간 지나면 기록 삭제 후 통과', async () => {
      getItem.mockResolvedValueOnce({
        count: 5,
        lockUntil: Date.now() - 1000,
        lastAttempt: Date.now() - 60000,
      });

      await expect(checkLoginAttempts(TEST_EMAIL)).resolves.toBeUndefined();
      expect(deleteItem).toHaveBeenCalledWith(KEY);
    });
  });

  describe('incrementLoginAttempts', () => {
    it('첫 시도는 count=1, lockUntil=null', async () => {
      getItem.mockResolvedValueOnce(null);

      await incrementLoginAttempts(TEST_EMAIL);

      expect(setItem).toHaveBeenCalledWith(
        KEY,
        expect.objectContaining({ count: 1, lockUntil: null })
      );
    });

    it('5회째 시도에서 잠금 시작', async () => {
      getItem.mockResolvedValueOnce({
        count: 4,
        lockUntil: null,
        lastAttempt: Date.now(),
      });

      await incrementLoginAttempts(TEST_EMAIL);

      expect(setItem).toHaveBeenCalledWith(
        KEY,
        expect.objectContaining({
          count: 5,
          lockUntil: expect.any(Number),
        })
      );
    });
  });

  describe('resetLoginAttempts', () => {
    it('기록 삭제', async () => {
      await resetLoginAttempts(TEST_EMAIL);
      expect(deleteItem).toHaveBeenCalledWith(KEY);
    });
  });

  describe('getRemainingLoginAttempts', () => {
    it('기록 없으면 5 반환', async () => {
      getItem.mockResolvedValueOnce(null);
      await expect(getRemainingLoginAttempts(TEST_EMAIL)).resolves.toBe(5);
    });

    it('count=2면 3 반환', async () => {
      getItem.mockResolvedValueOnce({
        count: 2,
        lockUntil: null,
        lastAttempt: Date.now(),
      });
      await expect(getRemainingLoginAttempts(TEST_EMAIL)).resolves.toBe(3);
    });

    it('count=10이어도 0 이상 반환', async () => {
      getItem.mockResolvedValueOnce({
        count: 10,
        lockUntil: Date.now() + 60000,
        lastAttempt: Date.now(),
      });
      await expect(getRemainingLoginAttempts(TEST_EMAIL)).resolves.toBe(0);
    });
  });
});
