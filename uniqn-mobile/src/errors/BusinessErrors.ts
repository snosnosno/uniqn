/**
 * UNIQN Mobile - 비즈니스 에러 클래스
 *
 * @description 비즈니스 로직 관련 특화 에러 클래스들
 * @version 1.0.0
 */

import { AppError, ERROR_CODES } from './AppError';

// ============================================================================
// 지원 관련 에러
// ============================================================================

/**
 * 중복 지원 에러
 */
export class AlreadyAppliedError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      jobPostingId?: string;
      applicationId?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_ALREADY_APPLIED,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        jobPostingId: options?.jobPostingId,
        applicationId: options?.applicationId,
      },
    });
    this.name = 'AlreadyAppliedError';
    Object.setPrototypeOf(this, AlreadyAppliedError.prototype);
  }
}

/**
 * 지원 마감 에러
 */
export class ApplicationClosedError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      jobPostingId?: string;
      closedAt?: Date;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_APPLICATION_CLOSED,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        jobPostingId: options?.jobPostingId,
        closedAt: options?.closedAt,
      },
    });
    this.name = 'ApplicationClosedError';
    Object.setPrototypeOf(this, ApplicationClosedError.prototype);
  }
}

/**
 * 정원 초과 에러
 */
export class MaxCapacityReachedError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      jobPostingId?: string;
      maxCapacity?: number;
      currentCount?: number;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        jobPostingId: options?.jobPostingId,
        maxCapacity: options?.maxCapacity,
        currentCount: options?.currentCount,
      },
    });
    this.name = 'MaxCapacityReachedError';
    Object.setPrototypeOf(this, MaxCapacityReachedError.prototype);
  }
}

// ============================================================================
// 출퇴근 관련 에러
// ============================================================================

/**
 * 중복 출근 에러
 */
export class AlreadyCheckedInError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      workLogId?: string;
      checkedInAt?: Date;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_ALREADY_CHECKED_IN,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        workLogId: options?.workLogId,
        checkedInAt: options?.checkedInAt,
      },
    });
    this.name = 'AlreadyCheckedInError';
    Object.setPrototypeOf(this, AlreadyCheckedInError.prototype);
  }
}

/**
 * 출근 전 퇴근 시도 에러
 */
export class NotCheckedInError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_NOT_CHECKED_IN,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
    });
    this.name = 'NotCheckedInError';
    Object.setPrototypeOf(this, NotCheckedInError.prototype);
  }
}

/**
 * 유효하지 않은 QR 코드 에러
 */
export class InvalidQRCodeError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      qrData?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_INVALID_QR,
      category: 'business',
      severity: 'low',
      isRetryable: true, // QR 재스캔 가능
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        qrData: options?.qrData,
      },
    });
    this.name = 'InvalidQRCodeError';
    Object.setPrototypeOf(this, InvalidQRCodeError.prototype);
  }
}

/**
 * 만료된 QR 코드 에러
 */
export class ExpiredQRCodeError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      expiredAt?: Date;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_EXPIRED_QR,
      category: 'business',
      severity: 'low',
      isRetryable: true, // 새 QR 코드로 재시도 가능
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        expiredAt: options?.expiredAt,
      },
    });
    this.name = 'ExpiredQRCodeError';
    Object.setPrototypeOf(this, ExpiredQRCodeError.prototype);
  }
}

/**
 * QR 코드 보안 코드 불일치 에러
 */
export class QRSecurityMismatchError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      eventId?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_QR_SECURITY_MISMATCH,
      category: 'business',
      severity: 'medium', // 보안 관련은 중간 심각도
      isRetryable: true, // 새 QR 코드로 재시도 가능
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        eventId: options?.eventId,
      },
    });
    this.name = 'QRSecurityMismatchError';
    Object.setPrototypeOf(this, QRSecurityMismatchError.prototype);
  }
}

/**
 * 잘못된 공고의 QR 코드 에러
 */
export class QRWrongEventError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      expectedEventId?: string;
      actualEventId?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_QR_WRONG_EVENT,
      category: 'business',
      severity: 'low',
      isRetryable: true,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        expectedEventId: options?.expectedEventId,
        actualEventId: options?.actualEventId,
      },
    });
    this.name = 'QRWrongEventError';
    Object.setPrototypeOf(this, QRWrongEventError.prototype);
  }
}

/**
 * 잘못된 날짜의 QR 코드 에러
 */
export class QRWrongDateError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      expectedDate?: string;
      actualDate?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_QR_WRONG_DATE,
      category: 'business',
      severity: 'low',
      isRetryable: true,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        expectedDate: options?.expectedDate,
        actualDate: options?.actualDate,
      },
    });
    this.name = 'QRWrongDateError';
    Object.setPrototypeOf(this, QRWrongDateError.prototype);
  }
}

// ============================================================================
// 정산 관련 에러
// ============================================================================

/**
 * 중복 정산 에러
 */
export class AlreadySettledError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      workLogId?: string;
      settledAt?: Date;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_ALREADY_SETTLED,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        workLogId: options?.workLogId,
        settledAt: options?.settledAt,
      },
    });
    this.name = 'AlreadySettledError';
    Object.setPrototypeOf(this, AlreadySettledError.prototype);
  }
}

/**
 * 유효하지 않은 근무 기록 에러
 */
export class InvalidWorkLogError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      workLogId?: string;
      reason?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_INVALID_WORKLOG,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        workLogId: options?.workLogId,
        reason: options?.reason,
      },
    });
    this.name = 'InvalidWorkLogError';
    Object.setPrototypeOf(this, InvalidWorkLogError.prototype);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export const isAlreadyAppliedError = (error: unknown): error is AlreadyAppliedError => {
  return error instanceof AlreadyAppliedError;
};

export const isApplicationClosedError = (error: unknown): error is ApplicationClosedError => {
  return error instanceof ApplicationClosedError;
};

export const isMaxCapacityReachedError = (error: unknown): error is MaxCapacityReachedError => {
  return error instanceof MaxCapacityReachedError;
};

export const isAlreadyCheckedInError = (error: unknown): error is AlreadyCheckedInError => {
  return error instanceof AlreadyCheckedInError;
};

export const isNotCheckedInError = (error: unknown): error is NotCheckedInError => {
  return error instanceof NotCheckedInError;
};

export const isInvalidQRCodeError = (error: unknown): error is InvalidQRCodeError => {
  return error instanceof InvalidQRCodeError;
};

export const isExpiredQRCodeError = (error: unknown): error is ExpiredQRCodeError => {
  return error instanceof ExpiredQRCodeError;
};

export const isQRSecurityMismatchError = (error: unknown): error is QRSecurityMismatchError => {
  return error instanceof QRSecurityMismatchError;
};

export const isQRWrongEventError = (error: unknown): error is QRWrongEventError => {
  return error instanceof QRWrongEventError;
};

export const isQRWrongDateError = (error: unknown): error is QRWrongDateError => {
  return error instanceof QRWrongDateError;
};

export const isAlreadySettledError = (error: unknown): error is AlreadySettledError => {
  return error instanceof AlreadySettledError;
};

export const isInvalidWorkLogError = (error: unknown): error is InvalidWorkLogError => {
  return error instanceof InvalidWorkLogError;
};

// ============================================================================
// 신고 관련 에러
// ============================================================================

/**
 * 중복 신고 에러
 */
export class DuplicateReportError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      targetId?: string;
      jobPostingId?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_DUPLICATE_REPORT,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        targetId: options?.targetId,
        jobPostingId: options?.jobPostingId,
      },
    });
    this.name = 'DuplicateReportError';
    Object.setPrototypeOf(this, DuplicateReportError.prototype);
  }
}

/**
 * 신고 찾을 수 없음 에러
 */
export class ReportNotFoundError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      reportId?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_REPORT_NOT_FOUND,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        reportId: options?.reportId,
      },
    });
    this.name = 'ReportNotFoundError';
    Object.setPrototypeOf(this, ReportNotFoundError.prototype);
  }
}

/**
 * 이미 처리된 신고 에러
 */
export class ReportAlreadyReviewedError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      reportId?: string;
      currentStatus?: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_REPORT_ALREADY_REVIEWED,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        reportId: options?.reportId,
        currentStatus: options?.currentStatus,
      },
    });
    this.name = 'ReportAlreadyReviewedError';
    Object.setPrototypeOf(this, ReportAlreadyReviewedError.prototype);
  }
}

/**
 * 본인 신고 불가 에러
 */
export class CannotReportSelfError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_CANNOT_REPORT_SELF,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
    });
    this.name = 'CannotReportSelfError';
    Object.setPrototypeOf(this, CannotReportSelfError.prototype);
  }
}

// Type Guards - 신고 관련
export const isDuplicateReportError = (error: unknown): error is DuplicateReportError => {
  return error instanceof DuplicateReportError;
};

export const isReportNotFoundError = (error: unknown): error is ReportNotFoundError => {
  return error instanceof ReportNotFoundError;
};

export const isReportAlreadyReviewedError = (
  error: unknown
): error is ReportAlreadyReviewedError => {
  return error instanceof ReportAlreadyReviewedError;
};

export const isCannotReportSelfError = (error: unknown): error is CannotReportSelfError => {
  return error instanceof CannotReportSelfError;
};
