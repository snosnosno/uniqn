/**
 * UNIQN Mobile - 알림 설정 중앙 관리
 *
 * @description 알림 타입별 설정 통합 관리
 * @version 1.0.0
 *
 * @example
 * import { getNotificationConfig, generateDeepLink } from '@/config/notificationConfig';
 *
 * const config = getNotificationConfig(NotificationType.NEW_APPLICATION);
 * const link = generateDeepLink(NotificationType.NEW_APPLICATION, { applicationId: '123' });
 */

import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  AndroidChannelId,
  NOTIFICATION_TYPE_TO_CATEGORY,
  NOTIFICATION_DEFAULT_PRIORITY,
  NOTIFICATION_TYPE_TO_CHANNEL,
  NOTIFICATION_TYPE_LABELS,
} from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

/**
 * 알림 타입별 통합 설정
 */
export interface NotificationTypeConfig {
  /** 알림 타입 */
  type: NotificationType;
  /** 카테고리 */
  category: NotificationCategory;
  /** 우선순위 */
  priority: NotificationPriority;
  /** Android 채널 ID */
  channelId: AndroidChannelId;
  /** 라벨 (한글) */
  label: string;
  /** 딥링크 생성 함수 */
  generateLink: (data?: NotificationLinkData) => string;
}

/**
 * 딥링크 생성을 위한 데이터
 */
export interface NotificationLinkData {
  applicationId?: string;
  jobPostingId?: string;
  workLogId?: string;
  date?: string;
}

// ============================================================================
// Deep Link Generators
// ============================================================================

/**
 * 딥링크 경로 생성기
 */
const deepLinkGenerators: Record<NotificationType, (data?: NotificationLinkData) => string> = {
  // === 지원 관련 ===
  [NotificationType.NEW_APPLICATION]: (data) =>
    data?.applicationId && data?.jobPostingId
      ? `/employer/applicants/${data.jobPostingId}`
      : '/employer/my-postings',
  [NotificationType.APPLICATION_CANCELLED]: (data) =>
    data?.jobPostingId ? `/employer/applicants/${data.jobPostingId}` : '/employer/my-postings',
  [NotificationType.APPLICATION_CONFIRMED]: (data) =>
    data?.applicationId ? `/applications/${data.applicationId}` : '/my-applications',
  [NotificationType.CONFIRMATION_CANCELLED]: (data) =>
    data?.applicationId ? `/applications/${data.applicationId}` : '/my-applications',
  [NotificationType.APPLICATION_REJECTED]: (data) =>
    data?.applicationId ? `/applications/${data.applicationId}` : '/my-applications',
  [NotificationType.CANCELLATION_APPROVED]: (data) =>
    data?.applicationId ? `/applications/${data.applicationId}` : '/schedule',
  [NotificationType.CANCELLATION_REJECTED]: (data) =>
    data?.applicationId ? `/applications/${data.applicationId}` : '/schedule',

  // === 출퇴근/스케줄 관련 ===
  [NotificationType.STAFF_CHECKED_IN]: (data) =>
    data?.jobPostingId ? `/employer/applicants/${data.jobPostingId}` : '/employer/my-postings',
  [NotificationType.STAFF_CHECKED_OUT]: (data) =>
    data?.jobPostingId ? `/employer/applicants/${data.jobPostingId}` : '/employer/my-postings',
  [NotificationType.CHECK_IN_CONFIRMED]: (data) =>
    data?.date ? `/schedule/${data.date}` : '/schedule',
  [NotificationType.CHECK_OUT_CONFIRMED]: (data) =>
    data?.date ? `/schedule/${data.date}` : '/schedule',
  [NotificationType.CHECKIN_REMINDER]: (data) =>
    data?.date ? `/schedule/${data.date}` : '/schedule',
  [NotificationType.NO_SHOW_ALERT]: (data) => (data?.date ? `/schedule/${data.date}` : '/schedule'),
  [NotificationType.SCHEDULE_CHANGE]: (data) =>
    data?.date ? `/schedule/${data.date}` : '/schedule',
  [NotificationType.SCHEDULE_CREATED]: (data) =>
    data?.date ? `/schedule/${data.date}` : '/schedule',
  [NotificationType.SCHEDULE_CANCELLED]: (data) =>
    data?.date ? `/schedule/${data.date}` : '/schedule',

  // === 정산 관련 ===
  [NotificationType.SETTLEMENT_COMPLETED]: () => '/schedule',
  [NotificationType.SETTLEMENT_REQUESTED]: (data) =>
    data?.jobPostingId ? `/employer/settlement/${data.jobPostingId}` : '/employer/my-postings',
  [NotificationType.NEGATIVE_SETTLEMENT_ALERT]: () => '/admin/dashboard',

  // === 공고 관련 ===
  [NotificationType.JOB_UPDATED]: (data) =>
    data?.jobPostingId ? `/jobs/${data.jobPostingId}` : '/jobs',
  [NotificationType.JOB_CANCELLED]: () => '/my-applications',
  [NotificationType.JOB_CLOSED]: () => '/my-applications',

  // === 시스템 ===
  [NotificationType.ANNOUNCEMENT]: () => '/notifications',
  [NotificationType.MAINTENANCE]: () => '/notifications',
  [NotificationType.APP_UPDATE]: () => '/notifications',

  // === 관리자 ===
  [NotificationType.INQUIRY_ANSWERED]: () => '/support/inquiries',
  [NotificationType.REPORT_RESOLVED]: () => '/notifications',
  [NotificationType.NEW_REPORT]: (data) =>
    data?.applicationId ? `/admin/reports/${data.applicationId}` : '/admin/reports',
  [NotificationType.NEW_INQUIRY]: (data) =>
    data?.applicationId ? `/admin/inquiries/${data.applicationId}` : '/admin/inquiries',
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: (data) =>
    data?.jobPostingId ? `/admin/tournaments/${data.jobPostingId}` : '/admin/tournaments',
};

// ============================================================================
// Config Lookup Functions
// ============================================================================

/**
 * 알림 타입별 통합 설정 가져오기
 *
 * @param type - 알림 타입
 * @returns 해당 타입의 전체 설정
 */
export function getNotificationConfig(type: NotificationType): NotificationTypeConfig {
  return {
    type,
    category: NOTIFICATION_TYPE_TO_CATEGORY[type],
    priority: NOTIFICATION_DEFAULT_PRIORITY[type],
    channelId: NOTIFICATION_TYPE_TO_CHANNEL[type],
    label: NOTIFICATION_TYPE_LABELS[type],
    generateLink: deepLinkGenerators[type],
  };
}

/**
 * 알림 타입에 대한 딥링크 생성
 *
 * @param type - 알림 타입
 * @param data - 딥링크 생성에 필요한 데이터
 * @returns 딥링크 경로 (예: '/jobs/abc123')
 */
export function generateDeepLink(type: NotificationType, data?: NotificationLinkData): string {
  const generator = deepLinkGenerators[type];
  return generator(data);
}

/**
 * 모든 알림 타입의 설정 맵
 *
 * @description 타입 안전성 검증에 사용
 */
export const NOTIFICATION_CONFIG_MAP: Record<NotificationType, NotificationTypeConfig> =
  Object.values(NotificationType).reduce(
    (acc, type) => {
      // type이 string인 경우만 처리 (const assertion으로 인한 타입)
      if (typeof type === 'string') {
        acc[type as NotificationType] = getNotificationConfig(type as NotificationType);
      }
      return acc;
    },
    {} as Record<NotificationType, NotificationTypeConfig>
  );

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * 유효한 알림 타입인지 확인
 */
export function isValidNotificationType(type: string): type is NotificationType {
  return Object.values(NotificationType).includes(type as NotificationType);
}

/**
 * 알림 타입 파싱 (안전한 변환)
 */
export function parseNotificationType(type: string | undefined): NotificationType | null {
  if (!type) return null;
  return isValidNotificationType(type) ? type : null;
}

// ============================================================================
// FCM Message Helpers (for Cloud Functions)
// ============================================================================

/**
 * FCM 메시지 옵션 생성
 *
 * @description Cloud Functions에서 알림 전송 시 사용
 */
export function getFCMOptions(type: NotificationType): {
  channelId: string;
  priority: 'high' | 'normal';
} {
  const config = getNotificationConfig(type);

  return {
    channelId: config.channelId,
    priority: config.priority === 'urgent' || config.priority === 'high' ? 'high' : 'normal',
  };
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  getNotificationConfig,
  generateDeepLink,
  isValidNotificationType,
  parseNotificationType,
  getFCMOptions,
  NOTIFICATION_CONFIG_MAP,
};
