/**
 * UNIQN Mobile - Logger 유틸리티 테스트
 *
 * @description logger.ts의 구조화된 로깅 시스템 테스트
 * - logger.debug, logger.info, logger.warn, logger.error
 * - logger.withPerformanceTracking
 * - logger.group, logger.groupEnd, logger.table
 * - logger.appError
 * - logger.network
 * - logger.firebase
 */

// Mock @/config/env before importing logger
jest.mock('@/config/env', () => ({
  env: {
    isProduction: false,
    isDevelopment: true,
  },
}));

// Mock crashlyticsService (dynamic import used by logger)
jest.mock('@/services/crashlyticsService', () => ({
  crashlyticsService: {
    recordError: jest.fn(() => Promise.resolve()),
    recordAppError: jest.fn(() => Promise.resolve()),
  },
}));

// Mock @/errors/AppError
jest.mock('@/errors/AppError', () => {
  const isAppError = (error: unknown): boolean => {
    return (
      error !== null &&
      typeof error === 'object' &&
      '_isAppError' in (error as Record<string, unknown>)
    );
  };

  return { isAppError };
});

import { logger } from '../logger';

// =============================================================================
// Helpers
// =============================================================================

const createMockAppError = (overrides = {}) => ({
  _isAppError: true,
  message: '비즈니스 에러',
  code: 'E6001',
  category: 'business',
  severity: 'medium' as const,
  isRetryable: false,
  metadata: { extra: 'info' },
  originalError: new Error('원본 에러'),
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe('logger', () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleGroupSpy: jest.SpyInstance;
  let consoleGroupEndSpy: jest.SpyInstance;
  let consoleTableSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation();
    consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();
    consoleTableSpy = jest.spyOn(console, 'table').mockImplementation();
  });

  // ===========================================================================
  // Basic log levels
  // ===========================================================================
  describe('basic log levels', () => {
    it('logger.debug should call console.debug', () => {
      logger.debug('디버그 메시지');
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('DEBUG'));
    });

    it('logger.debug should include context in output', () => {
      logger.debug('디버그 메시지', { component: 'TestComponent' });
      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('TestComponent'));
    });

    it('logger.info should call console.info', () => {
      logger.info('정보 메시지');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
    });

    it('logger.info should include context', () => {
      logger.info('정보 메시지', { action: 'login', userId: 'user-1' });
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('login'));
    });

    it('logger.warn should call console.warn', () => {
      logger.warn('경고 메시지');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
    });

    it('logger.error should call console.error', () => {
      logger.error('에러 메시지');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
    });

    it('logger.error should accept Error object', () => {
      const err = new Error('테스트 에러');
      logger.error('에러 발생', err);
      // When Error is passed without context, createEntry receives (level, msg, undefined, err)
      // Since contextOrError is undefined, entry.error is not set via the else-if branch.
      // Only the formatted message is logged via console.error.
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('에러 발생'));
    });

    it('logger.error should accept context without Error', () => {
      logger.error('에러 발생', { component: 'TestComponent' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('TestComponent'));
    });

    it('logger.error should accept Error + context', () => {
      const err = new Error('테스트');
      logger.error('에러 발생', err, { component: 'Test' });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Log output format
  // ===========================================================================
  describe('log output format', () => {
    it('should include timestamp in ISO format', () => {
      logger.info('타임스탬프 테스트');
      const output = consoleInfoSpy.mock.calls[0]?.[0] as string;
      // Should contain ISO timestamp pattern
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should include log level in uppercase', () => {
      logger.warn('레벨 테스트');
      const output = consoleWarnSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[WARN]');
    });

    it('should include message', () => {
      logger.info('특정 메시지');
      const output = consoleInfoSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('특정 메시지');
    });
  });

  // ===========================================================================
  // withPerformanceTracking
  // ===========================================================================
  describe('withPerformanceTracking', () => {
    it('should return function result on success', async () => {
      const result = await logger.withPerformanceTracking(async () => 'success', 'testOp');
      expect(result).toBe('success');
    });

    it('should log completion with duration on success', async () => {
      await logger.withPerformanceTracking(async () => 42, 'calcOp');
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('calcOp completed'));
    });

    it('should rethrow and log error on failure', async () => {
      const err = new Error('실패');
      await expect(
        logger.withPerformanceTracking(async () => {
          throw err;
        }, 'failOp')
      ).rejects.toThrow('실패');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('failOp failed'));
    });

    it('should include context in performance log', async () => {
      await logger.withPerformanceTracking(async () => 'ok', 'contextOp', {
        component: 'TestComp',
      });
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('TestComp'));
    });
  });

  // ===========================================================================
  // group / groupEnd / table (development only)
  // ===========================================================================
  describe('group / groupEnd / table', () => {
    it('logger.group should call console.group in development', () => {
      logger.group('그룹 라벨');
      expect(consoleGroupSpy).toHaveBeenCalledWith('그룹 라벨');
    });

    it('logger.groupEnd should call console.groupEnd in development', () => {
      logger.groupEnd();
      expect(consoleGroupEndSpy).toHaveBeenCalled();
    });

    it('logger.table should call console.table in development', () => {
      const data = [{ a: 1 }, { a: 2 }];
      logger.table(data);
      expect(consoleTableSpy).toHaveBeenCalledWith(data);
    });
  });

  // ===========================================================================
  // appError
  // ===========================================================================
  describe('appError', () => {
    it('should log AppError with metadata', () => {
      const appError = createMockAppError();
      logger.appError(appError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('비즈니스 에러'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('E6001'));
    });

    it('should log regular Error via logger.error', () => {
      const error = new Error('일반 에러');
      logger.appError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('일반 에러'));
    });

    it('should log unknown error as string', () => {
      logger.appError('문자열 에러');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('문자열 에러'));
    });

    it('should handle null/undefined error', () => {
      // Should not throw
      expect(() => logger.appError(null)).not.toThrow();
      expect(() => logger.appError(undefined)).not.toThrow();
    });

    it('should include context when provided with AppError', () => {
      const appError = createMockAppError();
      logger.appError(appError, { component: 'SettlementService' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('SettlementService'));
    });
  });

  // ===========================================================================
  // network
  // ===========================================================================
  describe('network', () => {
    it('should log successful request at info level', () => {
      logger.network('GET', '/api/jobs', 200, 150);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Network] GET /api/jobs')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('200'));
    });

    it('should log failed request at error level', () => {
      logger.network('POST', '/api/apply', 500, 300);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Network] POST /api/apply')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('500'));
    });

    it('should handle missing status and duration', () => {
      logger.network('GET', '/api/health');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Network] GET /api/health')
      );
    });

    it('should include context when provided', () => {
      logger.network('PUT', '/api/jobs/1', 200, 100, { userId: 'u1' });

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('u1'));
    });
  });

  // ===========================================================================
  // firebase
  // ===========================================================================
  describe('firebase', () => {
    it('should log Firebase operations at debug level', () => {
      logger.firebase('read', 'jobPostings', 'job-1');

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Firebase] READ jobPostings/job-1')
      );
    });

    it('should handle operation without docId', () => {
      logger.firebase('query', 'applications');

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Firebase] QUERY applications')
      );
    });

    it('should include context when provided', () => {
      logger.firebase('write', 'workLogs', 'wl-1', { action: 'checkIn' });

      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('checkIn'));
    });

    it('should support all operation types', () => {
      const operations = ['read', 'write', 'delete', 'query', 'auth', 'storage'] as const;

      for (const op of operations) {
        logger.firebase(op, 'testCollection');
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringContaining(`[Firebase] ${op.toUpperCase()} testCollection`)
        );
      }
    });
  });
});
