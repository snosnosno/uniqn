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
 * 칩 부족 에러
 */
export class InsufficientChipsError extends AppError {
  constructor(
    options?: Partial<{
      message: string;
      userMessage: string;
      requiredChips?: number;
      currentChips?: number;
    }>
  ) {
    super({
      code: ERROR_CODES.BUSINESS_INSUFFICIENT_CHIPS,
      category: 'business',
      severity: 'low',
      isRetryable: false,
      message: options?.message,
      userMessage: options?.userMessage,
      metadata: {
        requiredChips: options?.requiredChips,
        currentChips: options?.currentChips,
      },
    });
    this.name = 'InsufficientChipsError';
    Object.setPrototypeOf(this, InsufficientChipsError.prototype);
  }
}

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

// ============================================================================
// Type Guards
// ============================================================================

export const isInsufficientChipsError = (error: unknown): error is InsufficientChipsError => {
  return error instanceof InsufficientChipsError;
};

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

export const isAlreadySettledError = (error: unknown): error is AlreadySettledError => {
  return error instanceof AlreadySettledError;
};
