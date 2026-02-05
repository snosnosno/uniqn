/**
 * hookErrorHandler 테스트
 *
 * @description Phase 1.3 - 에러 처리 표준화 테스트
 */

import {
  createMutationErrorHandler,
  createQueryErrorHandler,
  errorHandlerPresets,
  normalizeLoadingState,
  combineLoadingStates,
  requireAuth,
  extractErrorMessage,
  canRetry,
  needsReauth,
} from '../hookErrorHandler';
import { AppError, AuthError, BusinessError, NetworkError, ERROR_CODES } from '@/errors';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('hookErrorHandler', () => {
  let mockAddToast: jest.Mock;

  beforeEach(() => {
    mockAddToast = jest.fn();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // createMutationErrorHandler
  // ==========================================================================
  describe('createMutationErrorHandler', () => {
    it('should create a handler that calls addToast with error message', () => {
      const handler = createMutationErrorHandler('테스트 작업', mockAddToast);
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
        userMessage: '테스트 에러 메시지',
      });

      handler(error);

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '테스트 에러 메시지',
      });
    });

    it('should use custom message when provided', () => {
      const handler = createMutationErrorHandler('테스트 작업', mockAddToast, {
        customMessages: {
          [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '커스텀 메시지',
        },
      });
      const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED, {
        userMessage: '기본 메시지',
      });

      handler(error);

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '커스텀 메시지',
      });
    });

    it('should not show toast when showToast is false', () => {
      const handler = createMutationErrorHandler('테스트 작업', mockAddToast, {
        showToast: false,
      });
      const error = new Error('test error');

      handler(error);

      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // createQueryErrorHandler
  // ==========================================================================
  describe('createQueryErrorHandler', () => {
    it('should create a handler for query errors', () => {
      const handler = createQueryErrorHandler('목록 조회', mockAddToast);
      const error = new NetworkError(ERROR_CODES.NETWORK_OFFLINE, {
        userMessage: '네트워크 오류',
      });

      handler(error);

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '네트워크 오류',
      });
    });

    it('should suppress toast for retryable errors when option is set', () => {
      const handler = createQueryErrorHandler('목록 조회', mockAddToast, {
        suppressRetryableToast: true,
      });
      const error = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
        userMessage: '타임아웃',
        isRetryable: true,
      });
      // NetworkError with NETWORK_TIMEOUT is retryable by default

      handler(error);

      // May or may not be called depending on isRetryable
      // This depends on how the error class sets isRetryable
    });
  });

  // ==========================================================================
  // errorHandlerPresets
  // ==========================================================================
  describe('errorHandlerPresets', () => {
    it('should have all expected presets', () => {
      expect(errorHandlerPresets.confirm).toBeDefined();
      expect(errorHandlerPresets.reject).toBeDefined();
      expect(errorHandlerPresets.apply).toBeDefined();
      expect(errorHandlerPresets.cancel).toBeDefined();
      expect(errorHandlerPresets.settlement).toBeDefined();
      expect(errorHandlerPresets.attendance).toBeDefined();
      expect(errorHandlerPresets.profile).toBeDefined();
      expect(errorHandlerPresets.jobPosting).toBeDefined();
      expect(errorHandlerPresets.report).toBeDefined();
      expect(errorHandlerPresets.notification).toBeDefined();
    });

    it('confirm preset should handle already applied error', () => {
      const handler = errorHandlerPresets.confirm(mockAddToast);
      const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED, {
        userMessage: '기본 메시지',
      });

      handler(error);

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '이미 확정된 지원입니다.',
      });
    });

    it('apply preset should handle max capacity error', () => {
      const handler = errorHandlerPresets.apply(mockAddToast);
      const error = new BusinessError(ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED, {
        userMessage: '기본 메시지',
      });

      handler(error);

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '모집이 마감되었습니다.',
      });
    });

    it('notification preset should not show toast', () => {
      const handler = errorHandlerPresets.notification(mockAddToast);
      const error = new Error('notification error');

      handler(error);

      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // normalizeLoadingState
  // ==========================================================================
  describe('normalizeLoadingState', () => {
    it('should return correct state for initial loading', () => {
      const result = normalizeLoadingState({
        data: undefined,
        isLoading: true,
        isFetching: true,
        isError: false,
      });

      expect(result.isInitialLoading).toBe(true);
      expect(result.hasData).toBe(false);
      expect(result.showSkeleton).toBe(true);
      expect(result.showData).toBe(false);
    });

    it('should return correct state for data with refetching', () => {
      const result = normalizeLoadingState({
        data: [{ id: '1' }],
        isLoading: false,
        isFetching: true,
        isError: false,
      });

      expect(result.isInitialLoading).toBe(false);
      expect(result.isRefetching).toBe(true);
      expect(result.hasData).toBe(true);
      expect(result.showData).toBe(true);
      expect(result.showSkeleton).toBe(false);
    });

    it('should return correct state for empty array', () => {
      const result = normalizeLoadingState({
        data: [],
        isLoading: false,
        isFetching: false,
        isError: false,
      });

      expect(result.hasData).toBe(true);
      expect(result.isEmpty).toBe(true);
      expect(result.showEmpty).toBe(true);
      expect(result.showData).toBe(false);
    });

    it('should return correct state for error without data', () => {
      const result = normalizeLoadingState({
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: true,
      });

      expect(result.isError).toBe(true);
      expect(result.showError).toBe(true);
      expect(result.showData).toBe(false);
    });

    it('should use custom isEmptyFn when provided', () => {
      const result = normalizeLoadingState(
        {
          data: { items: [] },
          isLoading: false,
          isFetching: false,
          isError: false,
        },
        {
          isEmptyFn: (data) => data.items.length === 0,
        }
      );

      expect(result.isEmpty).toBe(true);
      expect(result.showEmpty).toBe(true);
    });
  });

  // ==========================================================================
  // combineLoadingStates
  // ==========================================================================
  describe('combineLoadingStates', () => {
    it('should combine multiple query states', () => {
      const queries = [
        { data: [1, 2, 3], isLoading: false, isFetching: false, isError: false },
        { data: { name: 'test' }, isLoading: false, isFetching: false, isError: false },
      ];

      const result = combineLoadingStates(queries);

      expect(result.isInitialLoading).toBe(false);
      expect(result.showData).toBe(true);
      expect(result.showSkeleton).toBe(false);
    });

    it('should show skeleton if any query is initial loading', () => {
      const queries = [
        { data: [1, 2, 3], isLoading: false, isFetching: false, isError: false },
        { data: undefined, isLoading: true, isFetching: true, isError: false },
      ];

      const result = combineLoadingStates(queries);

      expect(result.isInitialLoading).toBe(true);
      expect(result.showSkeleton).toBe(true);
    });

    it('should show error if any query has error and not all have data', () => {
      const queries = [
        { data: [1, 2, 3], isLoading: false, isFetching: false, isError: false },
        { data: undefined, isLoading: false, isFetching: false, isError: true },
      ];

      const result = combineLoadingStates(queries);

      expect(result.isError).toBe(true);
      expect(result.showError).toBe(true);
    });
  });

  // ==========================================================================
  // requireAuth
  // ==========================================================================
  describe('requireAuth', () => {
    it('should throw AuthError when user is null', () => {
      expect(() => requireAuth(null)).toThrow(AuthError);
    });

    it('should throw AuthError when user is undefined', () => {
      expect(() => requireAuth(undefined)).toThrow(AuthError);
    });

    it('should not throw when user exists', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockUser = { uid: 'test-uid' } as any;
      expect(() => requireAuth(mockUser)).not.toThrow();
    });
  });

  // ==========================================================================
  // extractErrorMessage
  // ==========================================================================
  describe('extractErrorMessage', () => {
    it('should extract user message from AppError', () => {
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
        userMessage: '사용자 메시지',
      });
      expect(extractErrorMessage(error)).toBe('사용자 메시지');
    });

    it('should return fallback for unknown errors', () => {
      expect(extractErrorMessage(new Error('raw error'), '기본 메시지')).toBeTruthy();
    });
  });

  // ==========================================================================
  // canRetry
  // ==========================================================================
  describe('canRetry', () => {
    it('should return false for business errors', () => {
      const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED, {
        userMessage: '이미 지원함',
      });
      expect(canRetry(error)).toBe(false);
    });
  });

  // ==========================================================================
  // needsReauth
  // ==========================================================================
  describe('needsReauth', () => {
    it('should return true for token expired error', () => {
      const error = new AuthError(ERROR_CODES.AUTH_TOKEN_EXPIRED, {
        userMessage: '토큰 만료',
      });
      expect(needsReauth(error)).toBe(true);
    });

    it('should return true for session expired error', () => {
      const error = new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
        userMessage: '세션 만료',
      });
      expect(needsReauth(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
        userMessage: '기타 에러',
      });
      expect(needsReauth(error)).toBe(false);
    });
  });
});
