/**
 * withRetry 유틸리티 테스트
 *
 * @description Exponential Backoff + Jitter 재시도 유틸리티 테스트
 * - 기본 재시도 동작
 * - 최대 재시도 횟수
 * - 재시도 불가 에러 처리
 * - withRetryResult 메타데이터
 */

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/errors', () => {
  class MockAppError extends Error {
    code: string;
    category: string;
    severity: string;
    isRetryable: boolean;
    userMessage: string;
    metadata: Record<string, unknown>;
    originalError?: Error;

    constructor(
      options: {
        message?: string;
        code?: string;
        category?: string;
        severity?: string;
        isRetryable?: boolean;
      } = {}
    ) {
      super(options.message ?? '');
      this.name = 'AppError';
      this.code = options.code ?? 'E7000';
      this.category = options.category ?? 'unknown';
      this.severity = options.severity ?? 'medium';
      this.isRetryable = options.isRetryable ?? false;
      this.userMessage = options.message ?? '';
      this.metadata = {};
    }
  }

  return {
    AppError: MockAppError,
    isAppError: (error: unknown): error is InstanceType<typeof MockAppError> => {
      return error instanceof MockAppError;
    },
    normalizeError: (error: unknown) => {
      if (error instanceof MockAppError) return error;
      const e = new MockAppError({
        message: error instanceof Error ? error.message : String(error),
        category: 'unknown',
      });
      return e;
    },
  };
});

import { withRetry, withRetryResult } from '../withRetry';
import { AppError } from '@/errors';

describe('withRetry', () => {
  // 빠른 테스트를 위해 타이머 사용
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // 성공 케이스
  // ============================================================================
  describe('성공 케이스', () => {
    it('첫 번째 시도에 성공하면 바로 결과 반환', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('maxRetries: 0이면 재시도 없이 1번만 실행', async () => {
      const fn = jest.fn().mockResolvedValue('ok');

      const result = await withRetry(fn, { maxRetries: 0 });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // 재시도 후 성공 케이스
  // ============================================================================
  describe('재시도 후 성공', () => {
    it('2번째 시도에 성공', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('일시적 에러'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        useJitter: false,
        // 모든 에러에 대해 재시도 허용
        shouldRetry: () => true,
      });

      // 딜레이 후 재시도
      await jest.advanceTimersByTimeAsync(200);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // 모든 재시도 실패 케이스
  // ============================================================================
  describe('모든 재시도 실패', () => {
    it('최대 재시도 횟수 초과 시 마지막 에러 throw', async () => {
      jest.useRealTimers(); // 이 테스트만 real timers 사용

      const fn = jest.fn().mockRejectedValue(new Error('항상 실패'));

      await expect(
        withRetry(fn, {
          maxRetries: 2,
          initialDelay: 10, // 짧은 딜레이
          maxDelay: 50,
          useJitter: false,
          shouldRetry: () => true,
        })
      ).rejects.toThrow('항상 실패');

      expect(fn).toHaveBeenCalledTimes(3); // 1번 + 2번 재시도

      jest.useFakeTimers(); // 복원
    });
  });

  // ============================================================================
  // shouldRetry 콜백 테스트
  // ============================================================================
  describe('shouldRetry', () => {
    it('shouldRetry가 false 반환 시 즉시 실패', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('치명적 에러'));

      const promise = withRetry(fn, {
        maxRetries: 5,
        shouldRetry: () => false, // 재시도 거부
      });

      await expect(promise).rejects.toThrow('치명적 에러');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('AppError의 isRetryable 기반 기본 shouldRetry', async () => {
      const nonRetryableError = new AppError({
        message: '권한 없음',
        code: 'E4001',
        category: 'permission',
        isRetryable: false,
      });

      const fn = jest.fn().mockRejectedValue(nonRetryableError);

      const promise = withRetry(fn, { maxRetries: 3 });

      await expect(promise).rejects.toThrow('권한 없음');
      expect(fn).toHaveBeenCalledTimes(1); // 재시도 없음
    });
  });

  // ============================================================================
  // onRetry 콜백 테스트
  // ============================================================================
  describe('onRetry 콜백', () => {
    it('재시도 시 onRetry 콜백 호출', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('에러'))
        .mockResolvedValue('ok');

      const promise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        useJitter: false,
        shouldRetry: () => true,
        onRetry,
      });

      await jest.advanceTimersByTimeAsync(200);
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Number)
      );
    });
  });
});

describe('withRetryResult', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('성공 시 success: true 및 data 반환', async () => {
    const fn = jest.fn().mockResolvedValue('data');

    const result = await withRetryResult(fn, { maxRetries: 0 });

    expect(result.success).toBe(true);
    expect(result.data).toBe('data');
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.totalTime).toBeGreaterThanOrEqual(0);
  });

  it('실패 시 success: false 및 error 반환', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('실패'));

    const promise = withRetryResult(fn, {
      maxRetries: 1,
      initialDelay: 50,
      useJitter: false,
      shouldRetry: () => true,
    });

    await jest.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });
});
