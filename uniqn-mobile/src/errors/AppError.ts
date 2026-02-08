/**
 * UNIQN Mobile - 에러 클래스 시스템
 *
 * @description 구조화된 에러 처리를 위한 에러 클래스 계층
 * @version 1.0.0
 *
 * 현재 상태:
 * - Sentry 연동 완료 (@sentry/react-native, crashlyticsService.ts)
 * - 에러 자동 보고 활성화됨
 *
 * TODO [P2]: 에러 클래스 단위 테스트 추가 (커버리지 향상)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 에러 카테고리
 */
export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'permission'
  | 'firebase'
  | 'security'
  | 'business'
  | 'unknown';

/**
 * 에러 심각도
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 에러 코드 범위
 * E1xxx: 네트워크 에러
 * E2xxx: 인증 에러
 * E3xxx: 검증 에러
 * E4xxx: Firebase 에러
 * E5xxx: 보안 에러
 * E6xxx: 비즈니스 에러
 * E7xxx: 알 수 없는 에러
 */
export type ErrorCode = `E${1 | 2 | 3 | 4 | 5 | 6 | 7}${string}`;

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  // 네트워크 에러 (E1xxx)
  NETWORK_OFFLINE: 'E1001',
  NETWORK_TIMEOUT: 'E1002',
  NETWORK_SERVER_UNREACHABLE: 'E1003',
  NETWORK_REQUEST_FAILED: 'E1004',

  // 인증 에러 (E2xxx)
  AUTH_INVALID_CREDENTIALS: 'E2001',
  AUTH_USER_NOT_FOUND: 'E2002',
  AUTH_EMAIL_ALREADY_EXISTS: 'E2003',
  AUTH_WEAK_PASSWORD: 'E2004',
  AUTH_TOKEN_EXPIRED: 'E2005',
  AUTH_SESSION_EXPIRED: 'E2006',
  AUTH_ACCOUNT_DISABLED: 'E2007',
  AUTH_EMAIL_NOT_VERIFIED: 'E2008',
  AUTH_TOO_MANY_REQUESTS: 'E2009',
  AUTH_REQUIRES_RECENT_LOGIN: 'E2010',
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
  FIREBASE_ABORTED: 'E4005',

  // 보안 에러 (E5xxx)
  SECURITY_XSS_DETECTED: 'E5001',
  SECURITY_UNAUTHORIZED_ACCESS: 'E5002',
  SECURITY_RATE_LIMIT: 'E5003',

  // 비즈니스 에러 (E6xxx)
  BUSINESS_ALREADY_APPLIED: 'E6002',
  BUSINESS_APPLICATION_CLOSED: 'E6003',
  BUSINESS_MAX_CAPACITY_REACHED: 'E6004',
  BUSINESS_ALREADY_CHECKED_IN: 'E6005',
  BUSINESS_NOT_CHECKED_IN: 'E6006',
  BUSINESS_INVALID_QR: 'E6007',
  BUSINESS_EXPIRED_QR: 'E6008',
  BUSINESS_ALREADY_SETTLED: 'E6009',
  BUSINESS_INVALID_WORKLOG: 'E6010',
  BUSINESS_QR_SECURITY_MISMATCH: 'E6011',
  BUSINESS_QR_WRONG_EVENT: 'E6012',
  BUSINESS_QR_WRONG_DATE: 'E6013',
  BUSINESS_PARTIAL_SCHEDULE_FETCH: 'E6020',
  // 신고 관련
  BUSINESS_DUPLICATE_REPORT: 'E6030',
  BUSINESS_REPORT_NOT_FOUND: 'E6031',
  BUSINESS_REPORT_ALREADY_REVIEWED: 'E6032',
  BUSINESS_CANNOT_REPORT_SELF: 'E6033',
  BUSINESS_REPORT_COOLDOWN: 'E6034',

  // 취소 관련
  BUSINESS_ALREADY_CANCELLED: 'E6040',
  BUSINESS_CANNOT_CANCEL_CONFIRMED: 'E6041',
  BUSINESS_INVALID_STATE: 'E6042',
  BUSINESS_ALREADY_REQUESTED: 'E6043',
  BUSINESS_PREVIOUSLY_REJECTED: 'E6044',

  // 알림 관련 (E6050~)
  NOTIFICATION_PERMISSION_DENIED: 'E6050',
  NOTIFICATION_TOKEN_FAILED: 'E6051',
  NOTIFICATION_SEND_FAILED: 'E6052',
  NOTIFICATION_INVALID_LINK: 'E6053',

  // 알 수 없는 에러 (E7xxx)
  UNKNOWN: 'E7000',
} as const;

// ============================================================================
// User-friendly Messages (한글)
// ============================================================================

export const ERROR_MESSAGES: Record<string, string> = {
  // 네트워크
  [ERROR_CODES.NETWORK_OFFLINE]: '인터넷 연결을 확인해주세요',
  [ERROR_CODES.NETWORK_TIMEOUT]: '요청 시간이 초과되었습니다. 다시 시도해주세요',
  [ERROR_CODES.NETWORK_SERVER_UNREACHABLE]: '서버에 연결할 수 없습니다',
  [ERROR_CODES.NETWORK_REQUEST_FAILED]: '요청에 실패했습니다. 다시 시도해주세요',

  // 인증
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: '이메일 또는 비밀번호가 올바르지 않습니다',
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: '등록되지 않은 사용자입니다',
  [ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS]: '이미 사용 중인 이메일입니다',
  [ERROR_CODES.AUTH_WEAK_PASSWORD]: '비밀번호가 너무 약합니다',
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: '로그인이 만료되었습니다. 다시 로그인해주세요',
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: '세션이 만료되었습니다. 다시 로그인해주세요',
  [ERROR_CODES.AUTH_ACCOUNT_DISABLED]: '비활성화된 계정입니다. 고객센터에 문의해주세요',
  [ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]: '본인인증이 필요합니다', // 휴대폰 본인인증
  [ERROR_CODES.AUTH_TOO_MANY_REQUESTS]: '너무 많은 시도입니다. 잠시 후 다시 시도해주세요',
  [ERROR_CODES.AUTH_REQUIRES_RECENT_LOGIN]: '보안을 위해 다시 로그인해주세요',
  [ERROR_CODES.AUTH_RATE_LIMITED]: '로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요',
  [ERROR_CODES.AUTH_REQUIRED]: '로그인이 필요합니다',

  // 검증
  [ERROR_CODES.VALIDATION_REQUIRED]: '필수 입력 항목입니다',
  [ERROR_CODES.VALIDATION_FORMAT]: '올바른 형식이 아닙니다',
  [ERROR_CODES.VALIDATION_MIN_LENGTH]: '입력값이 너무 짧습니다',
  [ERROR_CODES.VALIDATION_MAX_LENGTH]: '입력값이 너무 깁니다',
  [ERROR_CODES.VALIDATION_SCHEMA]: '입력값을 확인해주세요',

  // Firebase
  [ERROR_CODES.FIREBASE_PERMISSION_DENIED]: '권한이 없습니다',
  [ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND]: '데이터를 찾을 수 없습니다',
  [ERROR_CODES.FIREBASE_QUOTA_EXCEEDED]: '요청 한도를 초과했습니다',
  [ERROR_CODES.FIREBASE_UNAVAILABLE]: '서비스를 일시적으로 사용할 수 없습니다',
  [ERROR_CODES.FIREBASE_ABORTED]: '작업이 중단되었습니다',

  // 보안
  [ERROR_CODES.SECURITY_XSS_DETECTED]: '잘못된 입력이 감지되었습니다',
  [ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS]: '접근 권한이 없습니다',
  [ERROR_CODES.SECURITY_RATE_LIMIT]: '요청이 너무 많습니다. 잠시 후 시도해주세요',

  // 비즈니스
  [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '이미 지원한 공고입니다',
  [ERROR_CODES.BUSINESS_APPLICATION_CLOSED]: '지원이 마감되었습니다',
  [ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED]: '모집 인원이 마감되었습니다',
  [ERROR_CODES.BUSINESS_ALREADY_CHECKED_IN]: '이미 출근 처리되었습니다',
  [ERROR_CODES.BUSINESS_NOT_CHECKED_IN]: '출근 기록이 없습니다',
  [ERROR_CODES.BUSINESS_INVALID_QR]: '유효하지 않은 QR 코드입니다',
  [ERROR_CODES.BUSINESS_EXPIRED_QR]: 'QR 코드가 만료되었습니다',
  [ERROR_CODES.BUSINESS_ALREADY_SETTLED]: '이미 정산 완료되었습니다',
  [ERROR_CODES.BUSINESS_INVALID_WORKLOG]: '유효하지 않은 근무 기록입니다',
  [ERROR_CODES.BUSINESS_QR_SECURITY_MISMATCH]: 'QR 코드 보안 검증에 실패했습니다',
  [ERROR_CODES.BUSINESS_QR_WRONG_EVENT]: '해당 공고의 QR 코드가 아닙니다',
  [ERROR_CODES.BUSINESS_QR_WRONG_DATE]: '오늘 날짜의 QR 코드가 아닙니다',
  [ERROR_CODES.BUSINESS_PARTIAL_SCHEDULE_FETCH]: '일부 스케줄 정보를 불러오지 못했습니다',
  // 신고 관련
  [ERROR_CODES.BUSINESS_DUPLICATE_REPORT]: '이미 해당 건에 대해 신고하셨습니다',
  [ERROR_CODES.BUSINESS_REPORT_NOT_FOUND]: '신고 내역을 찾을 수 없습니다',
  [ERROR_CODES.BUSINESS_REPORT_ALREADY_REVIEWED]: '이미 처리된 신고입니다',
  [ERROR_CODES.BUSINESS_CANNOT_REPORT_SELF]: '본인을 신고할 수 없습니다',
  [ERROR_CODES.BUSINESS_REPORT_COOLDOWN]: '동일 대상에 대한 신고는 24시간 후 가능합니다',

  // 취소 관련
  [ERROR_CODES.BUSINESS_ALREADY_CANCELLED]: '이미 취소된 지원입니다',
  [ERROR_CODES.BUSINESS_CANNOT_CANCEL_CONFIRMED]: '확정된 지원은 취소할 수 없습니다',
  [ERROR_CODES.BUSINESS_INVALID_STATE]: '현재 상태에서는 이 작업을 수행할 수 없습니다',
  [ERROR_CODES.BUSINESS_ALREADY_REQUESTED]: '이미 취소 요청이 진행 중입니다',
  [ERROR_CODES.BUSINESS_PREVIOUSLY_REJECTED]: '이전에 거절된 요청입니다',

  // 알림 관련
  [ERROR_CODES.NOTIFICATION_PERMISSION_DENIED]: '알림 권한이 필요합니다',
  [ERROR_CODES.NOTIFICATION_TOKEN_FAILED]: '푸시 토큰 발급에 실패했습니다',
  [ERROR_CODES.NOTIFICATION_SEND_FAILED]: '알림 전송에 실패했습니다',
  [ERROR_CODES.NOTIFICATION_INVALID_LINK]: '유효하지 않은 알림 링크입니다',

  // 알 수 없는 에러
  [ERROR_CODES.UNKNOWN]: '알 수 없는 오류가 발생했습니다',
};

// ============================================================================
// Base AppError Class
// ============================================================================

/**
 * 앱 에러 베이스 클래스
 * 모든 커스텀 에러는 이 클래스를 상속받음
 */
export class AppError extends Error {
  /** Babel wrapNativeSuper 환경에서 instanceof 대신 사용하는 브랜드 */
  readonly __isAppError = true as const;
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

    // Error 프로토타입 체인 유지
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * 로깅용 JSON 변환
   */
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
      stack: this.stack,
    };
  }
}

// ============================================================================
// Specialized Error Classes
// ============================================================================

/**
 * 네트워크 에러
 */
export class NetworkError extends AppError {
  constructor(
    code: string = ERROR_CODES.NETWORK_REQUEST_FAILED,
    options?: Partial<ConstructorParameters<typeof AppError>[0]>
  ) {
    super({
      code,
      category: 'network',
      severity: 'medium',
      isRetryable: true,
      ...options,
    });
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * 인증 에러
 */
export class AuthError extends AppError {
  constructor(
    code: string = ERROR_CODES.AUTH_INVALID_CREDENTIALS,
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
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * 검증 에러
 */
export class ValidationError extends AppError {
  readonly field?: string;
  readonly errors?: Record<string, string[]>;

  constructor(
    code: string = ERROR_CODES.VALIDATION_SCHEMA,
    options?: Partial<ConstructorParameters<typeof AppError>[0]> & {
      field?: string;
      errors?: Record<string, string[]>;
    }
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
    this.errors = options?.errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 권한 에러
 */
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
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

/**
 * 비즈니스 에러
 */
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
    Object.setPrototypeOf(this, BusinessError.prototype);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * AppError 여부 판별 (Babel wrapNativeSuper 환경에서도 안전)
 *
 * React Native + Babel 환경에서 Error 서브클래스의 instanceof가 실패할 수 있어
 * __isAppError 브랜드 속성으로 추가 판별합니다.
 */
export const isAppError = (error: unknown): error is AppError => {
  if (error instanceof AppError) return true;
  return (
    error !== null &&
    typeof error === 'object' &&
    '__isAppError' in error &&
    (error as { __isAppError: unknown }).__isAppError === true
  );
};

export const isNetworkError = (error: unknown): error is NetworkError => {
  if (error instanceof NetworkError) return true;
  return isAppError(error) && error.category === 'network';
};

export const isAuthError = (error: unknown): error is AuthError => {
  if (error instanceof AuthError) return true;
  return isAppError(error) && error.category === 'auth';
};

export const isValidationError = (error: unknown): error is ValidationError => {
  if (error instanceof ValidationError) return true;
  return isAppError(error) && error.category === 'validation';
};

export const isPermissionError = (error: unknown): error is PermissionError => {
  if (error instanceof PermissionError) return true;
  return isAppError(error) && error.category === 'permission';
};

export const isBusinessError = (error: unknown): error is BusinessError => {
  if (error instanceof BusinessError) return true;
  return isAppError(error) && error.category === 'business';
};

export default AppError;
