/**
 * UNIQN Functions - 에러 클래스 시스템
 *
 * @description Cloud Functions용 구조화된 에러 처리 체계
 * 모바일앱(uniqn-mobile/src/errors/AppError.ts)과 동일한 에러 코드/메시지 공유
 *
 * @version 1.0.0
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'permission'
  | 'firebase'
  | 'business'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Error Codes (모바일앱과 동기화)
// ============================================================================

export const ERROR_CODES = {
  // 인증 에러 (E2xxx)
  AUTH_INVALID_CREDENTIALS: 'E2001',
  AUTH_USER_NOT_FOUND: 'E2002',
  AUTH_EMAIL_ALREADY_EXISTS: 'E2003',
  AUTH_TOKEN_EXPIRED: 'E2005',
  AUTH_ACCOUNT_DISABLED: 'E2007',
  AUTH_TOO_MANY_REQUESTS: 'E2009',
  AUTH_RATE_LIMITED: 'E2011',
  AUTH_REQUIRED: 'E2012',

  // 검증 에러 (E3xxx)
  VALIDATION_REQUIRED: 'E3001',
  VALIDATION_FORMAT: 'E3002',
  VALIDATION_MIN_LENGTH: 'E3003',
  VALIDATION_MAX_LENGTH: 'E3004',
  VALIDATION_SCHEMA: 'E3005',

  // Firebase 에러 (E4xxx)
  FIREBASE_PERMISSION_DENIED: 'E4001',
  FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
  FIREBASE_QUOTA_EXCEEDED: 'E4003',
  FIREBASE_UNAVAILABLE: 'E4004',

  // 비즈니스 에러 (E6xxx)
  BUSINESS_ALREADY_APPLIED: 'E6002',
  BUSINESS_APPLICATION_CLOSED: 'E6003',
  BUSINESS_MAX_CAPACITY_REACHED: 'E6004',
  BUSINESS_ALREADY_CHECKED_IN: 'E6005',
  BUSINESS_NOT_CHECKED_IN: 'E6006',
  BUSINESS_ALREADY_SETTLED: 'E6009',
  BUSINESS_INVALID_WORKLOG: 'E6010',
  BUSINESS_DUPLICATE: 'E6039',
  BUSINESS_ALREADY_CANCELLED: 'E6040',
  BUSINESS_INVALID_STATE: 'E6042',
  BUSINESS_ALREADY_REQUESTED: 'E6043',
  BUSINESS_PREVIOUSLY_REJECTED: 'E6044',
  NOTIFICATION_SEND_FAILED: 'E6052',

  // 알 수 없는 에러 (E7xxx)
  UNKNOWN: 'E7000',
} as const;

// ============================================================================
// User-friendly Messages (한글, 모바일앱과 동기화)
// ============================================================================

export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: '이메일 또는 비밀번호가 올바르지 않습니다',
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: '등록되지 않은 사용자입니다',
  [ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS]: '이미 사용 중인 이메일입니다',
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: '로그인이 만료되었습니다. 다시 로그인해주세요',
  [ERROR_CODES.AUTH_ACCOUNT_DISABLED]: '비활성화된 계정입니다',
  [ERROR_CODES.AUTH_TOO_MANY_REQUESTS]: '너무 많은 시도입니다. 잠시 후 다시 시도해주세요',
  [ERROR_CODES.AUTH_RATE_LIMITED]: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요',
  [ERROR_CODES.AUTH_REQUIRED]: '로그인이 필요합니다',

  [ERROR_CODES.VALIDATION_REQUIRED]: '필수 입력 항목입니다',
  [ERROR_CODES.VALIDATION_FORMAT]: '올바른 형식이 아닙니다',
  [ERROR_CODES.VALIDATION_MIN_LENGTH]: '입력값이 너무 짧습니다',
  [ERROR_CODES.VALIDATION_MAX_LENGTH]: '입력값이 너무 깁니다',
  [ERROR_CODES.VALIDATION_SCHEMA]: '입력값을 확인해주세요',

  [ERROR_CODES.FIREBASE_PERMISSION_DENIED]: '권한이 없습니다',
  [ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND]: '데이터를 찾을 수 없습니다',
  [ERROR_CODES.FIREBASE_QUOTA_EXCEEDED]: '요청 한도를 초과했습니다',
  [ERROR_CODES.FIREBASE_UNAVAILABLE]: '서비스를 일시적으로 사용할 수 없습니다',

  [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '이미 지원한 공고입니다',
  [ERROR_CODES.BUSINESS_APPLICATION_CLOSED]: '지원이 마감되었습니다',
  [ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED]: '모집 인원이 마감되었습니다',
  [ERROR_CODES.BUSINESS_ALREADY_CHECKED_IN]: '이미 출근 처리되었습니다',
  [ERROR_CODES.BUSINESS_NOT_CHECKED_IN]: '출근 기록이 없습니다',
  [ERROR_CODES.BUSINESS_ALREADY_SETTLED]: '이미 정산 완료되었습니다',
  [ERROR_CODES.BUSINESS_INVALID_WORKLOG]: '유효하지 않은 근무 기록입니다',
  [ERROR_CODES.BUSINESS_ALREADY_CANCELLED]: '이미 취소되었습니다',
  [ERROR_CODES.BUSINESS_INVALID_STATE]: '현재 상태에서는 이 작업을 수행할 수 없습니다',
  [ERROR_CODES.BUSINESS_ALREADY_REQUESTED]: '이미 요청이 진행 중입니다',
  [ERROR_CODES.BUSINESS_PREVIOUSLY_REJECTED]: '이전에 거절된 요청입니다',
  [ERROR_CODES.NOTIFICATION_SEND_FAILED]: '알림 전송에 실패했습니다',

  [ERROR_CODES.UNKNOWN]: '알 수 없는 오류가 발생했습니다',
};

// ============================================================================
// Base AppError Class
// ============================================================================

export class AppError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly userMessage: string;
  readonly isRetryable: boolean;
  readonly originalError?: Error;
  readonly metadata?: Record<string, unknown>;

  constructor(options: {
    code: string;
    category: ErrorCategory;
    severity?: ErrorSeverity;
    message?: string;
    userMessage?: string;
    isRetryable?: boolean;
    originalError?: Error;
    metadata?: Record<string, unknown>;
  }) {
    const userMessage =
      options.userMessage || ERROR_MESSAGES[options.code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN];

    super(options.message || userMessage);

    this.name = 'AppError';
    this.code = options.code;
    this.category = options.category;
    this.severity = options.severity || 'medium';
    this.userMessage = userMessage;
    this.isRetryable = options.isRetryable ?? false;
    this.originalError = options.originalError;
    this.metadata = options.metadata;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      isRetryable: this.isRetryable,
      metadata: this.metadata,
    };
  }
}

// ============================================================================
// Specialized Error Classes
// ============================================================================

export class AuthError extends AppError {
  constructor(
    code: string = ERROR_CODES.AUTH_REQUIRED,
    options?: Partial<ConstructorParameters<typeof AppError>[0]>
  ) {
    super({
      code,
      category: 'auth',
      severity: 'medium',
      isRetryable: false,
      ...options,
    });
    this.name = 'AuthError';
  }
}

export class ValidationError extends AppError {
  readonly field?: string;

  constructor(
    code: string = ERROR_CODES.VALIDATION_SCHEMA,
    options?: Partial<ConstructorParameters<typeof AppError>[0]> & { field?: string }
  ) {
    super({
      code,
      category: 'validation',
      severity: 'low',
      isRetryable: false,
      ...options,
    });
    this.name = 'ValidationError';
    this.field = options?.field;
  }
}

export class PermissionError extends AppError {
  constructor(
    code: string = ERROR_CODES.FIREBASE_PERMISSION_DENIED,
    options?: Partial<ConstructorParameters<typeof AppError>[0]>
  ) {
    super({
      code,
      category: 'permission',
      severity: 'medium',
      isRetryable: false,
      ...options,
    });
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends AppError {
  constructor(
    options?: Partial<ConstructorParameters<typeof AppError>[0]>
  ) {
    super({
      code: ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND,
      category: 'firebase',
      severity: 'low',
      isRetryable: false,
      ...options,
    });
    this.name = 'NotFoundError';
  }
}

export class BusinessError extends AppError {
  constructor(code: string, options?: Partial<ConstructorParameters<typeof AppError>[0]>) {
    super({
      code,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      ...options,
    });
    this.name = 'BusinessError';
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

export const isAuthError = (error: unknown): error is AuthError => {
  return error instanceof AuthError || (isAppError(error) && error.category === 'auth');
};

export const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof ValidationError || (isAppError(error) && error.category === 'validation');
};

export const isPermissionError = (error: unknown): error is PermissionError => {
  return error instanceof PermissionError || (isAppError(error) && error.category === 'permission');
};

export const isNotFoundError = (error: unknown): error is NotFoundError => {
  return error instanceof NotFoundError;
};

export const isBusinessError = (error: unknown): error is BusinessError => {
  return error instanceof BusinessError || (isAppError(error) && error.category === 'business');
};
