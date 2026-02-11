/**
 * withErrorHandling 유틸리티 테스트
 *
 * @description 비동기 함수 에러 처리 래퍼 테스트
 * - 성공/실패 기본 동작
 * - 기본값 반환
 * - 재시도 로직
 * - 문자열 레이블 사용
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
      message: string,
      options: {
        code?: string;
        category?: string;
        severity?: string;
        isRetryable?: boolean;
      } = {}
    ) {
      super(message);
      this.name = 'AppError';
      this.code = options.code ?? 'E7000';
      this.category = options.category ?? 'unknown';
      this.severity = options.severity ?? 'medium';
      this.isRetryable = options.isRetryable ?? false;
      this.userMessage = message;
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
      const e = new MockAppError(
        error instanceof Error ? error.message : String(error),
        { category: 'unknown' }
      );
      return e;
    },
  };
});

import { withErrorHandling } from '../withErrorHandling';
import { logger } from '@/utils/logger';

describe('withErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // 성공 케이스
  // ============================================================================
  describe('성공 케이스', () => {
    it('성공 시 결과 반환', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const result = await withErrorHandling(fn);

      expect(result).toBe('result');
    });

    it('성공 시 에러 로깅 없음', async () => {
      const fn = jest.fn().mockResolvedValue('ok');

      await withErrorHandling(fn);

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 에러 throw 케이스
  // ============================================================================
  describe('에러 throw', () => {
    it('에러 발생 시 정규화된 에러 throw', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('실패'));

      await expect(withErrorHandling(fn)).rejects.toThrow();
    });

    it('에러 발생 시 기본적으로 로깅', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('에러'));

      await expect(withErrorHandling(fn)).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });

    it('logError: false 시 로깅 안 함', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('에러'));

      await expect(
        withErrorHandling(fn, { logError: false })
      ).rejects.toThrow();

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 기본값 반환 케이스
  // ============================================================================
  describe('기본값 반환', () => {
    it('defaultValue가 있으면 에러 시 기본값 반환', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('에러'));

      const result = await withErrorHandling(fn, {
        defaultValue: 'fallback',
      });

      expect(result).toBe('fallback');
    });

    it('defaultValue가 null이면 null 반환', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('에러'));

      const result = await withErrorHandling(fn, {
        defaultValue: null,
      });

      expect(result).toBeNull();
    });

    it('defaultValue가 빈 배열이면 빈 배열 반환', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('에러'));

      const result = await withErrorHandling(fn, {
        defaultValue: [],
      });

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // 문자열 레이블 사용
  // ============================================================================
  describe('문자열 레이블', () => {
    it('두 번째 인자로 문자열 전달 시 errorMessage로 사용', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('원본 에러'));

      await expect(
        withErrorHandling(fn, '사용자 조회')
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '사용자 조회',
        expect.anything(),
        expect.objectContaining({
          attempt: 1,
        })
      );
    });
  });

  // ============================================================================
  // 재시도 동작
  // ============================================================================
  describe('재시도 동작', () => {
    it('retryCount: 0은 재시도 없음 (기본값)', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('에러'));

      await expect(withErrorHandling(fn)).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // 컨텍스트 전달
  // ============================================================================
  describe('컨텍스트', () => {
    it('context가 로그에 포함됨', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('에러'));

      await expect(
        withErrorHandling(fn, {
          context: { userId: 'user-1', action: 'fetch' },
        })
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({
          userId: 'user-1',
          action: 'fetch',
        })
      );
    });
  });
});
