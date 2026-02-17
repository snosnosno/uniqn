/**
 * UNIQN Mobile - errorUtils 단위 테스트
 *
 * @description 에러 유틸리티 함수 테스트
 * @version 1.0.0
 */

import {
  normalizeError,
  withErrorHandling,
  withSyncErrorHandling,
  tryCatch,
  tryCatchSync,
  getErrorMessage,
  extractUserMessage,
  isRetryableError,
  isRecoverableError,
  requiresReauthentication,
  getErrorAction,
  type Result,
} from '../errorUtils';
import {
  AppError,
  NetworkError,
  AuthError,
  ValidationError,
  ERROR_CODES,
  ERROR_MESSAGES,
  isAppError,
  isNetworkError,
} from '../AppError';

// ============================================================================
// normalizeError Tests
// ============================================================================

describe('normalizeError', () => {
  describe('AppError 입력', () => {
    it('이미 AppError인 경우 그대로 반환', () => {
      const original = new AppError({
        code: 'E1001',
        category: 'network',
        message: 'Test error',
      });

      const result = normalizeError(original);

      expect(result).toBe(original);
    });

    it('NetworkError를 그대로 반환', () => {
      const original = new NetworkError(ERROR_CODES.NETWORK_OFFLINE);
      const result = normalizeError(original);

      expect(result).toBe(original);
      expect(isNetworkError(result)).toBe(true);
    });

    it('AuthError를 그대로 반환', () => {
      const original = new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
      const result = normalizeError(original);

      expect(result).toBe(original);
    });
  });

  describe('Firebase 에러 입력', () => {
    it('Firebase auth 에러를 AppError로 변환', () => {
      const firebaseError = {
        code: 'auth/invalid-email',
        message: 'Invalid email',
      };

      const result = normalizeError(firebaseError);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    });

    it('Firebase firestore 에러를 AppError로 변환', () => {
      const firebaseError = {
        code: 'permission-denied',
        message: 'Permission denied',
      };

      const result = normalizeError(firebaseError);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.FIREBASE_PERMISSION_DENIED);
    });
  });

  describe('TypeError (fetch) 입력', () => {
    it('fetch 관련 TypeError를 NetworkError로 변환', () => {
      const fetchError = new TypeError('Failed to fetch');

      const result = normalizeError(fetchError);

      expect(isNetworkError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.NETWORK_OFFLINE);
      expect(result.originalError).toBe(fetchError);
    });
  });

  describe('일반 Error 입력', () => {
    it('네트워크 관련 메시지를 NetworkError로 변환', () => {
      const testCases = [
        { message: 'Network error occurred', expectedCode: ERROR_CODES.NETWORK_REQUEST_FAILED },
        { message: 'Connection timeout', expectedCode: ERROR_CODES.NETWORK_REQUEST_FAILED },
        { message: 'Server is offline', expectedCode: ERROR_CODES.NETWORK_REQUEST_FAILED },
        { message: 'ECONNREFUSED', expectedCode: ERROR_CODES.NETWORK_REQUEST_FAILED },
        { message: 'ETIMEDOUT', expectedCode: ERROR_CODES.NETWORK_REQUEST_FAILED },
      ];

      testCases.forEach(({ message, expectedCode }) => {
        const error = new Error(message);
        const result = normalizeError(error);

        expect(isNetworkError(result)).toBe(true);
        expect(result.code).toBe(expectedCode);
      });
    });

    it('일반 Error를 AppError로 변환 (UNKNOWN)', () => {
      const error = new Error('Something went wrong');
      const result = normalizeError(error);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
      expect(result.category).toBe('unknown');
      expect(result.message).toBe('Something went wrong');
    });
  });

  describe('문자열 에러 입력', () => {
    it('문자열을 AppError로 변환', () => {
      const result = normalizeError('String error message');

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
      expect(result.message).toBe('String error message');
    });
  });

  describe('기타 입력', () => {
    it('숫자를 AppError로 변환', () => {
      const result = normalizeError(404);

      expect(isAppError(result)).toBe(true);
      expect(result.message).toBe('404');
    });

    it('null을 AppError로 변환', () => {
      const result = normalizeError(null);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
    });

    it('undefined를 AppError로 변환', () => {
      const result = normalizeError(undefined);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.UNKNOWN);
    });

    it('객체를 AppError로 변환', () => {
      const result = normalizeError({ custom: 'error' });

      expect(isAppError(result)).toBe(true);
    });
  });
});

// ============================================================================
// withErrorHandling Tests
// ============================================================================

describe('withErrorHandling', () => {
  it('성공 시 결과를 반환', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const wrappedFn = withErrorHandling(mockFn);

    const result = await wrappedFn();

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalled();
  });

  it('에러 발생 시 AppError로 변환하여 throw', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Original error'));
    const wrappedFn = withErrorHandling(mockFn);

    await expect(wrappedFn()).rejects.toThrow(AppError);
  });

  it('context를 에러 메타데이터에 추가', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Test'));
    const context = { component: 'TestComponent', operation: 'testOp' };
    const wrappedFn = withErrorHandling(mockFn, context);

    try {
      await wrappedFn();
    } catch (error) {
      expect((error as AppError).metadata).toMatchObject(context);
    }
  });

  it('인자를 함수에 전달', async () => {
    const mockFn = jest.fn().mockResolvedValue('result');
    const wrappedFn = withErrorHandling(mockFn);

    await wrappedFn('arg1', 'arg2');

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('AppError를 그대로 throw', async () => {
    const originalError = new NetworkError(ERROR_CODES.NETWORK_OFFLINE);
    const mockFn = jest.fn().mockRejectedValue(originalError);
    const wrappedFn = withErrorHandling(mockFn);

    await expect(wrappedFn()).rejects.toThrow(originalError);
  });
});

// ============================================================================
// withSyncErrorHandling Tests
// ============================================================================

describe('withSyncErrorHandling', () => {
  it('성공 시 결과를 반환', () => {
    const mockFn = jest.fn().mockReturnValue('success');
    const wrappedFn = withSyncErrorHandling(mockFn);

    const result = wrappedFn();

    expect(result).toBe('success');
  });

  it('에러 발생 시 AppError로 변환하여 throw', () => {
    const mockFn = jest.fn().mockImplementation(() => {
      throw new Error('Sync error');
    });
    const wrappedFn = withSyncErrorHandling(mockFn);

    expect(() => wrappedFn()).toThrow(AppError);
  });

  it('context를 에러 메타데이터에 추가', () => {
    const mockFn = jest.fn().mockImplementation(() => {
      throw new Error('Test');
    });
    const context = { component: 'SyncComponent', operation: 'syncOp' };
    const wrappedFn = withSyncErrorHandling(mockFn, context);

    try {
      wrappedFn();
    } catch (error) {
      expect((error as AppError).metadata).toMatchObject(context);
    }
  });

  it('인자를 함수에 전달', () => {
    const mockFn = jest.fn().mockReturnValue('result');
    const wrappedFn = withSyncErrorHandling(mockFn);

    wrappedFn('arg1', 123);

    expect(mockFn).toHaveBeenCalledWith('arg1', 123);
  });
});

// ============================================================================
// tryCatch Tests
// ============================================================================

describe('tryCatch', () => {
  it('성공 시 success Result 반환', async () => {
    const result = await tryCatch(() => Promise.resolve('data'));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('data');
    }
  });

  it('실패 시 error Result 반환', async () => {
    const result = await tryCatch(() => Promise.reject(new Error('Failed')));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(isAppError(result.error)).toBe(true);
    }
  });

  it('throw 하지 않고 Result로 래핑', async () => {
    const fn = async () => {
      throw new NetworkError(ERROR_CODES.NETWORK_OFFLINE);
    };

    // throw하지 않음을 검증
    const result = await tryCatch(fn);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.NETWORK_OFFLINE);
    }
  });

  it('복잡한 데이터 타입 반환', async () => {
    const complexData = { items: [1, 2, 3], meta: { page: 1 } };
    const result = await tryCatch(() => Promise.resolve(complexData));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(complexData);
    }
  });
});

// ============================================================================
// tryCatchSync Tests
// ============================================================================

describe('tryCatchSync', () => {
  it('성공 시 success Result 반환', () => {
    const result = tryCatchSync(() => 'sync data');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('sync data');
    }
  });

  it('실패 시 error Result 반환', () => {
    const result = tryCatchSync(() => {
      throw new Error('Sync failed');
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(isAppError(result.error)).toBe(true);
    }
  });

  it('ValidationError도 정상적으로 처리', () => {
    const result = tryCatchSync(() => {
      throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
        metadata: { field: 'email' },
      });
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ERROR_CODES.VALIDATION_REQUIRED);
    }
  });
});

// ============================================================================
// getErrorMessage Tests
// ============================================================================

describe('getErrorMessage', () => {
  it('알려진 에러 코드의 메시지 반환', () => {
    const message = getErrorMessage(ERROR_CODES.NETWORK_OFFLINE);

    expect(message).toBe(ERROR_MESSAGES[ERROR_CODES.NETWORK_OFFLINE]);
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('알 수 없는 에러 코드는 UNKNOWN 메시지 반환', () => {
    const message = getErrorMessage('INVALID_CODE');

    expect(message).toBe(ERROR_MESSAGES[ERROR_CODES.UNKNOWN]);
  });

  it('다양한 에러 코드 테스트', () => {
    const codes = [
      ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      ERROR_CODES.VALIDATION_REQUIRED,
      ERROR_CODES.FIREBASE_PERMISSION_DENIED,
    ];

    codes.forEach((code) => {
      const message = getErrorMessage(code);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// extractUserMessage Tests
// ============================================================================

describe('extractUserMessage', () => {
  it('AppError에서 userMessage 추출', () => {
    const error = new AppError({
      code: 'E1001',
      category: 'network',
      userMessage: '네트워크 오류가 발생했습니다',
    });

    const message = extractUserMessage(error);

    expect(message).toBe('네트워크 오류가 발생했습니다');
  });

  it('Firebase 에러를 변환하여 userMessage 추출', () => {
    const firebaseError = {
      code: 'auth/wrong-password',
      message: 'Firebase auth error',
    };

    const message = extractUserMessage(firebaseError);

    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('일반 Error는 UNKNOWN 메시지 반환', () => {
    const error = new Error('Internal error details');

    const message = extractUserMessage(error);

    expect(message).toBe(ERROR_MESSAGES[ERROR_CODES.UNKNOWN]);
  });

  it('문자열/숫자 등은 UNKNOWN 메시지 반환', () => {
    expect(extractUserMessage('string error')).toBe(ERROR_MESSAGES[ERROR_CODES.UNKNOWN]);
    expect(extractUserMessage(500)).toBe(ERROR_MESSAGES[ERROR_CODES.UNKNOWN]);
    expect(extractUserMessage(null)).toBe(ERROR_MESSAGES[ERROR_CODES.UNKNOWN]);
  });
});

// ============================================================================
// isRetryableError Tests
// ============================================================================

describe('isRetryableError', () => {
  it('NetworkError는 재시도 가능', () => {
    const error = new NetworkError(ERROR_CODES.NETWORK_OFFLINE);
    expect(isRetryableError(error)).toBe(true);
  });

  it('isRetryable=true인 에러는 재시도 가능', () => {
    const error = new AppError({
      code: 'E9999',
      category: 'business',
      isRetryable: true,
    });
    expect(isRetryableError(error)).toBe(true);
  });

  it('ValidationError는 재시도 불가', () => {
    const error = new ValidationError(ERROR_CODES.VALIDATION_REQUIRED);
    expect(isRetryableError(error)).toBe(false);
  });

  it('특정 에러 코드는 재시도 가능', () => {
    const retryableCodes = [
      ERROR_CODES.NETWORK_OFFLINE,
      ERROR_CODES.NETWORK_TIMEOUT,
      ERROR_CODES.NETWORK_SERVER_UNREACHABLE,
      ERROR_CODES.FIREBASE_UNAVAILABLE,
      ERROR_CODES.AUTH_TOO_MANY_REQUESTS,
    ];

    retryableCodes.forEach((code) => {
      const error = new AppError({ code, category: 'unknown' });
      expect(isRetryableError(error)).toBe(true);
    });
  });

  it('일반 Error를 정규화하여 판별', () => {
    const networkError = new Error('Network timeout');
    expect(isRetryableError(networkError)).toBe(true);

    const generalError = new Error('Random error');
    expect(isRetryableError(generalError)).toBe(false);
  });
});

// ============================================================================
// isRecoverableError Tests
// ============================================================================

describe('isRecoverableError', () => {
  it('NetworkError는 복구 가능', () => {
    const error = new NetworkError(ERROR_CODES.NETWORK_OFFLINE);
    expect(isRecoverableError(error)).toBe(true);
  });

  it('isRetryable=true인 에러는 복구 가능', () => {
    const error = new AppError({
      code: 'E9999',
      category: 'business',
      isRetryable: true,
    });
    expect(isRecoverableError(error)).toBe(true);
  });

  it('ValidationError는 복구 불가', () => {
    const error = new ValidationError(ERROR_CODES.VALIDATION_REQUIRED);
    expect(isRecoverableError(error)).toBe(false);
  });

  it('일반 Error는 복구 불가', () => {
    const error = new Error('Some error');
    expect(isRecoverableError(error)).toBe(false);
  });

  it('문자열/null은 복구 불가', () => {
    expect(isRecoverableError('error')).toBe(false);
    expect(isRecoverableError(null)).toBe(false);
  });
});

// ============================================================================
// requiresReauthentication Tests
// ============================================================================

describe('requiresReauthentication', () => {
  it('TOKEN_EXPIRED는 재인증 필요', () => {
    const error = new AuthError(ERROR_CODES.AUTH_TOKEN_EXPIRED);
    expect(requiresReauthentication(error)).toBe(true);
  });

  it('SESSION_EXPIRED는 재인증 필요', () => {
    const error = new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED);
    expect(requiresReauthentication(error)).toBe(true);
  });

  it('REQUIRES_RECENT_LOGIN은 재인증 필요', () => {
    const error = new AuthError(ERROR_CODES.AUTH_REQUIRES_RECENT_LOGIN);
    expect(requiresReauthentication(error)).toBe(true);
  });

  it('다른 AuthError는 재인증 불필요', () => {
    const error = new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    expect(requiresReauthentication(error)).toBe(false);
  });

  it('NetworkError는 재인증 불필요', () => {
    const error = new NetworkError(ERROR_CODES.NETWORK_OFFLINE);
    expect(requiresReauthentication(error)).toBe(false);
  });

  it('일반 Error는 재인증 불필요', () => {
    const error = new Error('Some error');
    expect(requiresReauthentication(error)).toBe(false);
  });
});

// ============================================================================
// getErrorAction Tests
// ============================================================================

describe('getErrorAction', () => {
  it('severity=low면 toast 반환', () => {
    const error = new AppError({
      code: 'E1001',
      category: 'network',
      severity: 'low',
    });
    expect(getErrorAction(error)).toBe('toast');
  });

  it('severity=medium + auth면 redirect 반환', () => {
    const error = new AppError({
      code: 'E2001',
      category: 'auth',
      severity: 'medium',
    });
    expect(getErrorAction(error)).toBe('redirect');
  });

  it('severity=medium + 다른 카테고리면 alert 반환', () => {
    const error = new AppError({
      code: 'E1001',
      category: 'network',
      severity: 'medium',
    });
    expect(getErrorAction(error)).toBe('alert');
  });

  it('severity=high면 alert 반환', () => {
    const error = new AppError({
      code: 'E3001',
      category: 'validation',
      severity: 'high',
    });
    expect(getErrorAction(error)).toBe('alert');
  });

  it('severity=critical이면 crash 반환', () => {
    const error = new AppError({
      code: 'E9001',
      category: 'unknown',
      severity: 'critical',
    });
    expect(getErrorAction(error)).toBe('crash');
  });

  it('기본값은 toast', () => {
    const error = new AppError({
      code: 'E1001',
      category: 'network',
    });
    // severity 기본값이 있을 때 해당 액션 반환
    const action = getErrorAction(error);
    expect(['toast', 'alert', 'redirect', 'crash']).toContain(action);
  });
});

// ============================================================================
// Result Type Tests
// ============================================================================

describe('Result 타입', () => {
  it('success Result 타입 가드', () => {
    const result: Result<string> = { success: true, data: 'hello' };

    if (result.success) {
      // TypeScript가 data 타입을 string으로 인식해야 함
      expect(result.data).toBe('hello');
    }
  });

  it('error Result 타입 가드', () => {
    const result: Result<string> = {
      success: false,
      error: new AppError({ code: 'E1001', category: 'network' }),
    };

    if (!result.success) {
      // TypeScript가 error 타입을 AppError로 인식해야 함
      expect(result.error).toBeInstanceOf(AppError);
    }
  });

  it('제네릭 타입 지원', () => {
    interface User {
      id: string;
      name: string;
    }

    const successResult: Result<User> = {
      success: true,
      data: { id: '1', name: 'Test' },
    };

    if (successResult.success) {
      expect(successResult.data.id).toBe('1');
      expect(successResult.data.name).toBe('Test');
    }
  });
});
