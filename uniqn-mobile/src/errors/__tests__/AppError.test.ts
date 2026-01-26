/**
 * AppError 클래스 단위 테스트
 */

import {
  AppError,
  NetworkError,
  AuthError,
  ValidationError,
  PermissionError,
  BusinessError,
  ERROR_CODES,
  ERROR_MESSAGES,
  isAppError,
  isNetworkError,
  isAuthError,
  isValidationError,
  isPermissionError,
  isBusinessError,
} from '../AppError';

describe('AppError', () => {
  describe('constructor', () => {
    it('기본 속성을 올바르게 설정해야 한다', () => {
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
      });

      expect(error.code).toBe(ERROR_CODES.UNKNOWN);
      expect(error.category).toBe('unknown');
      expect(error.name).toBe('AppError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('severity 기본값은 medium이어야 한다', () => {
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
      });

      expect(error.severity).toBe('medium');
    });

    it('isRetryable 기본값은 false이어야 한다', () => {
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
      });

      expect(error.isRetryable).toBe(false);
    });

    it('userMessage가 없으면 ERROR_MESSAGES에서 자동 매핑해야 한다', () => {
      const error = new AppError({
        code: ERROR_CODES.NETWORK_OFFLINE,
        category: 'network',
      });

      expect(error.userMessage).toBe(ERROR_MESSAGES[ERROR_CODES.NETWORK_OFFLINE]);
    });

    it('userMessage를 직접 지정할 수 있어야 한다', () => {
      const customMessage = '커스텀 에러 메시지';
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
        userMessage: customMessage,
      });

      expect(error.userMessage).toBe(customMessage);
    });

    it('originalError를 저장해야 한다', () => {
      const originalError = new Error('원본 에러');
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
        originalError,
      });

      expect(error.originalError).toBe(originalError);
    });

    it('metadata를 저장해야 한다', () => {
      const metadata = { userId: '123', action: 'login' };
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
        metadata,
      });

      expect(error.metadata).toEqual(metadata);
    });
  });

  describe('toJSON', () => {
    it('올바른 JSON 형식을 반환해야 한다', () => {
      const error = new AppError({
        code: ERROR_CODES.NETWORK_OFFLINE,
        category: 'network',
        severity: 'high',
        isRetryable: true,
        metadata: { test: 'value' },
      });

      const json = error.toJSON();

      expect(json).toMatchObject({
        name: 'AppError',
        code: ERROR_CODES.NETWORK_OFFLINE,
        category: 'network',
        severity: 'high',
        isRetryable: true,
        metadata: { test: 'value' },
      });
      expect(json.stack).toBeDefined();
    });
  });

  describe('프로토타입 체인', () => {
    it('Error 프로토타입 체인이 유지되어야 한다', () => {
      const error = new AppError({
        code: ERROR_CODES.UNKNOWN,
        category: 'unknown',
      });

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error.stack).toBeDefined();
    });
  });
});

describe('NetworkError', () => {
  it('기본 코드가 NETWORK_REQUEST_FAILED이어야 한다', () => {
    const error = new NetworkError();

    expect(error.code).toBe(ERROR_CODES.NETWORK_REQUEST_FAILED);
  });

  it('category가 network이어야 한다', () => {
    const error = new NetworkError();

    expect(error.category).toBe('network');
  });

  it('isRetryable이 기본적으로 true이어야 한다', () => {
    const error = new NetworkError();

    expect(error.isRetryable).toBe(true);
  });

  it('커스텀 코드를 지정할 수 있어야 한다', () => {
    const error = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT);

    expect(error.code).toBe(ERROR_CODES.NETWORK_TIMEOUT);
  });

  it('name이 NetworkError이어야 한다', () => {
    const error = new NetworkError();

    expect(error.name).toBe('NetworkError');
  });

  it('프로토타입 체인이 유지되어야 한다', () => {
    const error = new NetworkError();

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof NetworkError).toBe(true);
  });
});

describe('AuthError', () => {
  it('기본 코드가 AUTH_INVALID_CREDENTIALS이어야 한다', () => {
    const error = new AuthError();

    expect(error.code).toBe(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  });

  it('category가 auth이어야 한다', () => {
    const error = new AuthError();

    expect(error.category).toBe('auth');
  });

  it('isRetryable이 기본적으로 false이어야 한다', () => {
    const error = new AuthError();

    expect(error.isRetryable).toBe(false);
  });

  it('name이 AuthError이어야 한다', () => {
    const error = new AuthError();

    expect(error.name).toBe('AuthError');
  });

  it('프로토타입 체인이 유지되어야 한다', () => {
    const error = new AuthError();

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof AuthError).toBe(true);
  });
});

describe('ValidationError', () => {
  it('기본 코드가 VALIDATION_SCHEMA이어야 한다', () => {
    const error = new ValidationError();

    expect(error.code).toBe(ERROR_CODES.VALIDATION_SCHEMA);
  });

  it('category가 validation이어야 한다', () => {
    const error = new ValidationError();

    expect(error.category).toBe('validation');
  });

  it('severity가 기본적으로 low이어야 한다', () => {
    const error = new ValidationError();

    expect(error.severity).toBe('low');
  });

  it('field 속성을 지원해야 한다', () => {
    const error = new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      field: 'email',
    });

    expect(error.field).toBe('email');
  });

  it('errors 객체를 지원해야 한다', () => {
    const errors = {
      email: ['이메일 형식이 올바르지 않습니다'],
      password: ['비밀번호는 8자 이상이어야 합니다'],
    };
    const error = new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, { errors });

    expect(error.errors).toEqual(errors);
  });

  it('name이 ValidationError이어야 한다', () => {
    const error = new ValidationError();

    expect(error.name).toBe('ValidationError');
  });

  it('프로토타입 체인이 유지되어야 한다', () => {
    const error = new ValidationError();

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof ValidationError).toBe(true);
  });
});

describe('PermissionError', () => {
  it('기본 코드가 FIREBASE_PERMISSION_DENIED이어야 한다', () => {
    const error = new PermissionError();

    expect(error.code).toBe(ERROR_CODES.FIREBASE_PERMISSION_DENIED);
  });

  it('category가 permission이어야 한다', () => {
    const error = new PermissionError();

    expect(error.category).toBe('permission');
  });

  it('isRetryable이 기본적으로 false이어야 한다', () => {
    const error = new PermissionError();

    expect(error.isRetryable).toBe(false);
  });

  it('name이 PermissionError이어야 한다', () => {
    const error = new PermissionError();

    expect(error.name).toBe('PermissionError');
  });

  it('프로토타입 체인이 유지되어야 한다', () => {
    const error = new PermissionError();

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof PermissionError).toBe(true);
  });
});

describe('BusinessError', () => {
  it('지정한 코드를 사용해야 한다', () => {
    const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

    expect(error.code).toBe(ERROR_CODES.BUSINESS_ALREADY_APPLIED);
  });

  it('category가 business이어야 한다', () => {
    const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

    expect(error.category).toBe('business');
  });

  it('severity가 기본적으로 low이어야 한다', () => {
    const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

    expect(error.severity).toBe('low');
  });

  it('isRetryable이 기본적으로 false이어야 한다', () => {
    const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

    expect(error.isRetryable).toBe(false);
  });

  it('name이 BusinessError이어야 한다', () => {
    const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

    expect(error.name).toBe('BusinessError');
  });

  it('프로토타입 체인이 유지되어야 한다', () => {
    const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof BusinessError).toBe(true);
  });
});

describe('Type Guards', () => {
  describe('isAppError', () => {
    it('AppError 인스턴스에 대해 true를 반환해야 한다', () => {
      const error = new AppError({ code: ERROR_CODES.UNKNOWN, category: 'unknown' });
      expect(isAppError(error)).toBe(true);
    });

    it('일반 Error에 대해 false를 반환해야 한다', () => {
      const error = new Error('일반 에러');
      expect(isAppError(error)).toBe(false);
    });

    it('null에 대해 false를 반환해야 한다', () => {
      expect(isAppError(null)).toBe(false);
    });

    it('undefined에 대해 false를 반환해야 한다', () => {
      expect(isAppError(undefined)).toBe(false);
    });

    it('문자열에 대해 false를 반환해야 한다', () => {
      expect(isAppError('에러')).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('NetworkError 인스턴스에 대해 true를 반환해야 한다', () => {
      const error = new NetworkError();
      expect(isNetworkError(error)).toBe(true);
    });

    it('다른 AppError 서브클래스에 대해 false를 반환해야 한다', () => {
      const error = new AuthError();
      expect(isNetworkError(error)).toBe(false);
    });

    it('일반 Error에 대해 false를 반환해야 한다', () => {
      const error = new Error('일반 에러');
      expect(isNetworkError(error)).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('AuthError 인스턴스에 대해 true를 반환해야 한다', () => {
      const error = new AuthError();
      expect(isAuthError(error)).toBe(true);
    });

    it('다른 AppError 서브클래스에 대해 false를 반환해야 한다', () => {
      const error = new NetworkError();
      expect(isAuthError(error)).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('ValidationError 인스턴스에 대해 true를 반환해야 한다', () => {
      const error = new ValidationError();
      expect(isValidationError(error)).toBe(true);
    });

    it('다른 AppError 서브클래스에 대해 false를 반환해야 한다', () => {
      const error = new AuthError();
      expect(isValidationError(error)).toBe(false);
    });
  });

  describe('isPermissionError', () => {
    it('PermissionError 인스턴스에 대해 true를 반환해야 한다', () => {
      const error = new PermissionError();
      expect(isPermissionError(error)).toBe(true);
    });

    it('다른 AppError 서브클래스에 대해 false를 반환해야 한다', () => {
      const error = new AuthError();
      expect(isPermissionError(error)).toBe(false);
    });
  });

  describe('isBusinessError', () => {
    it('BusinessError 인스턴스에 대해 true를 반환해야 한다', () => {
      const error = new BusinessError(ERROR_CODES.BUSINESS_ALREADY_APPLIED);
      expect(isBusinessError(error)).toBe(true);
    });

    it('다른 AppError 서브클래스에 대해 false를 반환해야 한다', () => {
      const error = new AuthError();
      expect(isBusinessError(error)).toBe(false);
    });
  });
});

describe('ERROR_CODES', () => {
  it('네트워크 에러 코드가 E1xxx 형식이어야 한다', () => {
    expect(ERROR_CODES.NETWORK_OFFLINE).toMatch(/^E1\d{3}$/);
    expect(ERROR_CODES.NETWORK_TIMEOUT).toMatch(/^E1\d{3}$/);
  });

  it('인증 에러 코드가 E2xxx 형식이어야 한다', () => {
    expect(ERROR_CODES.AUTH_INVALID_CREDENTIALS).toMatch(/^E2\d{3}$/);
    expect(ERROR_CODES.AUTH_TOKEN_EXPIRED).toMatch(/^E2\d{3}$/);
  });

  it('검증 에러 코드가 E3xxx 형식이어야 한다', () => {
    expect(ERROR_CODES.VALIDATION_REQUIRED).toMatch(/^E3\d{3}$/);
  });

  it('Firebase 에러 코드가 E4xxx 형식이어야 한다', () => {
    expect(ERROR_CODES.FIREBASE_PERMISSION_DENIED).toMatch(/^E4\d{3}$/);
  });

  it('보안 에러 코드가 E5xxx 형식이어야 한다', () => {
    expect(ERROR_CODES.SECURITY_XSS_DETECTED).toMatch(/^E5\d{3}$/);
  });

  it('비즈니스 에러 코드가 E6xxx 형식이어야 한다', () => {
    expect(ERROR_CODES.BUSINESS_ALREADY_APPLIED).toMatch(/^E6\d{3}$/);
  });

  it('알 수 없는 에러 코드가 E7xxx 형식이어야 한다', () => {
    expect(ERROR_CODES.UNKNOWN).toMatch(/^E7\d{3}$/);
  });
});

describe('ERROR_MESSAGES', () => {
  it('모든 ERROR_CODES에 대응하는 메시지가 있어야 한다', () => {
    const allCodes = Object.values(ERROR_CODES);

    allCodes.forEach((code) => {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof ERROR_MESSAGES[code]).toBe('string');
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    });
  });

  it('메시지가 한글로 작성되어야 한다', () => {
    const koreanRegex = /[가-힣]/;

    Object.values(ERROR_MESSAGES).forEach((message) => {
      expect(koreanRegex.test(message)).toBe(true);
    });
  });
});
