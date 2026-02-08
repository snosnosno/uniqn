/**
 * UNIQN Mobile - 알림 전용 에러 클래스
 *
 * @description 푸시 알림 관련 에러 처리를 위한 에러 클래스
 * @version 1.0.0
 *
 * 에러 코드:
 * - E6050: 알림 권한 거부
 * - E6051: FCM 토큰 발급 실패
 * - E6052: 알림 전송 실패
 * - E6053: 유효하지 않은 알림 링크
 */

import { AppError, ERROR_CODES, isAppError } from './AppError';

// ============================================================================
// Notification Permission Error
// ============================================================================

/**
 * 알림 권한 에러
 *
 * @description 알림 권한이 거부되었을 때 발생
 * @property canAskAgain - 권한 재요청 가능 여부
 */
export class NotificationPermissionError extends AppError {
  readonly canAskAgain: boolean;

  constructor(canAskAgain: boolean = true) {
    super({
      code: ERROR_CODES.NOTIFICATION_PERMISSION_DENIED,
      category: 'business',
      severity: 'low',
      isRetryable: canAskAgain,
      userMessage: canAskAgain
        ? '알림 권한이 필요합니다. 설정에서 허용해주세요.'
        : '알림 권한이 거부되었습니다. 설정 앱에서 직접 허용해주세요.',
      metadata: { canAskAgain },
    });
    this.name = 'NotificationPermissionError';
    this.canAskAgain = canAskAgain;
    Object.setPrototypeOf(this, NotificationPermissionError.prototype);
  }
}

// ============================================================================
// FCM Token Error
// ============================================================================

/**
 * FCM 토큰 에러
 *
 * @description FCM 토큰 발급/등록 실패 시 발생
 * @property reason - 실패 원인
 */
export class FCMTokenError extends AppError {
  readonly reason: 'acquisition_failed' | 'registration_failed' | 'unregistration_failed';

  constructor(
    reason:
      | 'acquisition_failed'
      | 'registration_failed'
      | 'unregistration_failed' = 'acquisition_failed',
    originalError?: Error
  ) {
    const messages: Record<string, string> = {
      acquisition_failed: '푸시 토큰을 발급받지 못했습니다. 잠시 후 다시 시도해주세요.',
      registration_failed: '푸시 토큰 등록에 실패했습니다.',
      unregistration_failed: '푸시 토큰 해제에 실패했습니다.',
    };

    super({
      code: ERROR_CODES.NOTIFICATION_TOKEN_FAILED,
      category: 'business',
      severity: 'medium',
      isRetryable: true,
      userMessage: messages[reason],
      originalError,
      metadata: { reason },
    });
    this.name = 'FCMTokenError';
    this.reason = reason;
    Object.setPrototypeOf(this, FCMTokenError.prototype);
  }
}

// ============================================================================
// Notification Send Error
// ============================================================================

/**
 * 알림 전송 에러
 *
 * @description 알림 전송 실패 시 발생 (Cloud Functions에서 사용)
 * @property partialSuccess - 부분 성공 여부 (일부 수신자에게만 전송된 경우)
 * @property successCount - 성공한 전송 수
 * @property failureCount - 실패한 전송 수
 */
export class NotificationSendError extends AppError {
  readonly partialSuccess: boolean;
  readonly successCount: number;
  readonly failureCount: number;

  constructor(
    options: {
      partialSuccess?: boolean;
      successCount?: number;
      failureCount?: number;
      originalError?: Error;
    } = {}
  ) {
    const { partialSuccess = false, successCount = 0, failureCount = 0, originalError } = options;

    const userMessage = partialSuccess
      ? `일부 알림 전송에 실패했습니다. (성공: ${successCount}, 실패: ${failureCount})`
      : '알림 전송에 실패했습니다.';

    super({
      code: ERROR_CODES.NOTIFICATION_SEND_FAILED,
      category: 'business',
      severity: partialSuccess ? 'low' : 'medium',
      isRetryable: true,
      userMessage,
      originalError,
      metadata: { partialSuccess, successCount, failureCount },
    });
    this.name = 'NotificationSendError';
    this.partialSuccess = partialSuccess;
    this.successCount = successCount;
    this.failureCount = failureCount;
    Object.setPrototypeOf(this, NotificationSendError.prototype);
  }
}

// ============================================================================
// Invalid Link Error
// ============================================================================

/**
 * 유효하지 않은 알림 링크 에러
 *
 * @description 알림에 포함된 딥링크가 유효하지 않을 때 발생
 * @property link - 문제가 된 링크
 */
export class InvalidNotificationLinkError extends AppError {
  readonly link: string;

  constructor(link: string) {
    super({
      code: ERROR_CODES.NOTIFICATION_INVALID_LINK,
      category: 'security',
      severity: 'low',
      isRetryable: false,
      userMessage: '알림 링크를 열 수 없습니다.',
      metadata: { link: link.substring(0, 50) }, // 보안을 위해 길이 제한
    });
    this.name = 'InvalidNotificationLinkError';
    this.link = link;
    Object.setPrototypeOf(this, InvalidNotificationLinkError.prototype);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Babel wrapNativeSuper 환경에서 instanceof 대신 name + isAppError로 판별
 */
const hasErrorName = (error: unknown, name: string): boolean =>
  isAppError(error) && error.name === name;

export const isNotificationPermissionError = (
  error: unknown
): error is NotificationPermissionError => {
  return error instanceof NotificationPermissionError || hasErrorName(error, 'NotificationPermissionError');
};

export const isFCMTokenError = (error: unknown): error is FCMTokenError => {
  return error instanceof FCMTokenError || hasErrorName(error, 'FCMTokenError');
};

export const isNotificationSendError = (error: unknown): error is NotificationSendError => {
  return error instanceof NotificationSendError || hasErrorName(error, 'NotificationSendError');
};

export const isInvalidNotificationLinkError = (
  error: unknown
): error is InvalidNotificationLinkError => {
  return error instanceof InvalidNotificationLinkError || hasErrorName(error, 'InvalidNotificationLinkError');
};
