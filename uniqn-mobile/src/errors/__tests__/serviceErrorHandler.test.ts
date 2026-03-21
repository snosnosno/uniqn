import { AppError, BusinessError, ERROR_CODES } from '../AppError';
import { handleServiceError, handleSilentError } from '../serviceErrorHandler';

jest.mock('@/utils/logger', () => ({
  logger: {
    appError: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const { logger } = jest.requireMock('@/utils/logger') as {
  logger: {
    appError: jest.Mock;
    warn: jest.Mock;
    info: jest.Mock;
    debug: jest.Mock;
  };
};

describe('serviceErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleServiceError', () => {
    it('기존 AppError를 그대로 반환하고 telemetry 분류를 로깅해야 한다', () => {
      const appError = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

      const result = handleServiceError(appError, {
        operation: '지원 처리',
        component: 'applicationService',
      });

      expect(result).toBe(appError);
      expect(logger.appError).toHaveBeenCalledWith(
        appError,
        expect.objectContaining({
          operation: '지원 처리',
          component: 'applicationService',
          handlingKind: 'recoverable-business',
          telemetryChannel: 'none',
        })
      );
    });

    it('일반 Error를 AppError로 정규화하고 infra telemetry 분류를 로깅해야 한다', () => {
      const result = handleServiceError(new Error('unexpected failure'), {
        operation: '데이터 조회',
        component: 'jobService',
        context: { userId: 'user-123456' },
      });

      expect(result).toBeInstanceOf(AppError);
      expect(result.category).toBe('unknown');
      expect(logger.appError).toHaveBeenCalledWith(
        result,
        expect.objectContaining({
          operation: '데이터 조회',
          component: 'jobService',
          handlingKind: 'infra',
          telemetryChannel: 'error',
          userId: 'use***456',
        })
      );
    });
  });

  describe('handleSilentError', () => {
    it('silent 에러는 telemetry suppressed 컨텍스트와 함께 warn 로깅해야 한다', () => {
      const appError = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

      handleSilentError(appError, {
        operation: '캐시 삭제',
        component: 'cacheService',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        '캐시 삭제 - 에러 발생 (무시됨)',
        expect.objectContaining({
          operation: '캐시 삭제',
          component: 'cacheService',
          handlingKind: 'recoverable-business',
          telemetryChannel: 'none',
          telemetrySuppressed: true,
          silent: true,
          errorCode: ERROR_CODES.BUSINESS_ALREADY_APPLIED,
        })
      );
    });
  });
});
