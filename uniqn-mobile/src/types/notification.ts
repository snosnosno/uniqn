/**
 * UNIQN Mobile - 알림 관련 타입 정의
 *
 * @description 푸시 알림, 인앱 알림 타입 정의
 * @version 2.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument } from './common';

// ============================================================================
// Notification Types (Enum-like)
// ============================================================================

/**
 * 알림 타입 상수
 *
 * @description 모든 알림 종류를 정의하는 상수 객체
 */
export const NotificationType = {
  // === 지원 관련 ===
  /** 새로운 지원자 (구인자에게) */
  NEW_APPLICATION: 'new_application',
  /** 지원 취소됨 */
  APPLICATION_CANCELLED: 'application_cancelled',
  /** 확정됨 (스태프에게) */
  APPLICATION_CONFIRMED: 'application_confirmed',
  /** 확정 취소됨 */
  CONFIRMATION_CANCELLED: 'confirmation_cancelled',
  /** 거절됨 */
  APPLICATION_REJECTED: 'application_rejected',
  /** 취소 요청 승인됨 (지원자에게) */
  CANCELLATION_APPROVED: 'cancellation_approved',
  /** 취소 요청 거절됨 (지원자에게) */
  CANCELLATION_REJECTED: 'cancellation_rejected',

  // === 출퇴근/스케줄 관련 ===
  /** 출근 체크인 알림 (구인자에게) */
  STAFF_CHECKED_IN: 'staff_checked_in',
  /** 퇴근 체크아웃 알림 (구인자에게) */
  STAFF_CHECKED_OUT: 'staff_checked_out',
  /** 출근 확인 알림 (스태프 본인에게) */
  CHECK_IN_CONFIRMED: 'check_in_confirmed',
  /** 퇴근 확인 알림 (스태프 본인에게) */
  CHECK_OUT_CONFIRMED: 'check_out_confirmed',
  /** 출근 리마인더 (스태프에게) */
  CHECKIN_REMINDER: 'checkin_reminder',
  /** 노쇼 알림 */
  NO_SHOW_ALERT: 'no_show_alert',
  /** 근무 시간 변경 (스태프에게) - 관리자가 시간 수정 시 */
  SCHEDULE_CHANGE: 'schedule_change',
  /** 새로운 근무 배정 (스태프에게) */
  SCHEDULE_CREATED: 'schedule_created',
  /** 근무 취소 (스태프에게) */
  SCHEDULE_CANCELLED: 'schedule_cancelled',

  // === 정산 관련 ===
  /** 정산 완료 (스태프에게) */
  SETTLEMENT_COMPLETED: 'settlement_completed',
  /** 정산 요청 (구인자에게) */
  SETTLEMENT_REQUESTED: 'settlement_requested',

  // === 공고 관련 ===
  /** 공고 수정됨 */
  JOB_UPDATED: 'job_updated',
  /** 공고 취소됨 */
  JOB_CANCELLED: 'job_cancelled',
  /** 공고 마감됨 */
  JOB_CLOSED: 'job_closed',

  // === 시스템 ===
  /** 공지사항 */
  ANNOUNCEMENT: 'announcement',
  /** 시스템 점검 */
  MAINTENANCE: 'maintenance',
  /** 앱 업데이트 */
  APP_UPDATE: 'app_update',

  // === 관리자 ===
  /** 문의 답변 완료 */
  INQUIRY_ANSWERED: 'inquiry_answered',
  /** 신고 처리 완료 */
  REPORT_RESOLVED: 'report_resolved',
  /** 새로운 신고 접수 (관리자에게) */
  NEW_REPORT: 'new_report',
  /** 새로운 문의 접수 (관리자에게) */
  NEW_INQUIRY: 'new_inquiry',
  /** 대회공고 승인 요청 (관리자에게) */
  TOURNAMENT_APPROVAL_REQUEST: 'tournament_approval_request',
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- const/type 합성 패턴
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// ============================================================================
// Notification Categories
// ============================================================================

/**
 * 알림 카테고리
 */
export const NotificationCategory = {
  APPLICATION: 'application', // 지원 관련
  ATTENDANCE: 'attendance', // 출퇴근 관련
  SETTLEMENT: 'settlement', // 정산 관련
  JOB: 'job', // 공고 관련
  SYSTEM: 'system', // 시스템
  ADMIN: 'admin', // 관리자
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- const/type 합성 패턴
export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];

/**
 * 알림 타입 → 카테고리 매핑
 */
export const NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  // 지원 관련
  [NotificationType.NEW_APPLICATION]: NotificationCategory.APPLICATION,
  [NotificationType.APPLICATION_CANCELLED]: NotificationCategory.APPLICATION,
  [NotificationType.APPLICATION_CONFIRMED]: NotificationCategory.APPLICATION,
  [NotificationType.CONFIRMATION_CANCELLED]: NotificationCategory.APPLICATION,
  [NotificationType.APPLICATION_REJECTED]: NotificationCategory.APPLICATION,
  [NotificationType.CANCELLATION_APPROVED]: NotificationCategory.APPLICATION,
  [NotificationType.CANCELLATION_REJECTED]: NotificationCategory.APPLICATION,

  // 출퇴근/스케줄 관련
  [NotificationType.STAFF_CHECKED_IN]: NotificationCategory.ATTENDANCE,
  [NotificationType.STAFF_CHECKED_OUT]: NotificationCategory.ATTENDANCE,
  [NotificationType.CHECK_IN_CONFIRMED]: NotificationCategory.ATTENDANCE,
  [NotificationType.CHECK_OUT_CONFIRMED]: NotificationCategory.ATTENDANCE,
  [NotificationType.CHECKIN_REMINDER]: NotificationCategory.ATTENDANCE,
  [NotificationType.NO_SHOW_ALERT]: NotificationCategory.ATTENDANCE,
  [NotificationType.SCHEDULE_CHANGE]: NotificationCategory.ATTENDANCE,
  [NotificationType.SCHEDULE_CREATED]: NotificationCategory.ATTENDANCE,
  [NotificationType.SCHEDULE_CANCELLED]: NotificationCategory.ATTENDANCE,

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: NotificationCategory.SETTLEMENT,
  [NotificationType.SETTLEMENT_REQUESTED]: NotificationCategory.SETTLEMENT,

  // 공고 관련
  [NotificationType.JOB_UPDATED]: NotificationCategory.JOB,
  [NotificationType.JOB_CANCELLED]: NotificationCategory.JOB,
  [NotificationType.JOB_CLOSED]: NotificationCategory.JOB,

  // 시스템
  [NotificationType.ANNOUNCEMENT]: NotificationCategory.SYSTEM,
  [NotificationType.MAINTENANCE]: NotificationCategory.SYSTEM,
  [NotificationType.APP_UPDATE]: NotificationCategory.SYSTEM,

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: NotificationCategory.ADMIN,
  [NotificationType.REPORT_RESOLVED]: NotificationCategory.ADMIN,
  [NotificationType.NEW_REPORT]: NotificationCategory.ADMIN,
  [NotificationType.NEW_INQUIRY]: NotificationCategory.ADMIN,
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: NotificationCategory.ADMIN,
};

// ============================================================================
// Notification Priority
// ============================================================================

/**
 * 알림 우선순위
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * 알림 타입별 기본 우선순위
 */
export const NOTIFICATION_DEFAULT_PRIORITY: Record<NotificationType, NotificationPriority> = {
  // 지원 관련 - 대부분 high
  [NotificationType.NEW_APPLICATION]: 'high',
  [NotificationType.APPLICATION_CANCELLED]: 'normal',
  [NotificationType.APPLICATION_CONFIRMED]: 'high',
  [NotificationType.CONFIRMATION_CANCELLED]: 'high',
  [NotificationType.APPLICATION_REJECTED]: 'normal',
  [NotificationType.CANCELLATION_APPROVED]: 'normal',
  [NotificationType.CANCELLATION_REJECTED]: 'high',

  // 출퇴근/스케줄 관련 - 리마인더/노쇼는 urgent
  [NotificationType.STAFF_CHECKED_IN]: 'normal',
  [NotificationType.STAFF_CHECKED_OUT]: 'normal',
  [NotificationType.CHECK_IN_CONFIRMED]: 'normal',
  [NotificationType.CHECK_OUT_CONFIRMED]: 'normal',
  [NotificationType.CHECKIN_REMINDER]: 'urgent',
  [NotificationType.NO_SHOW_ALERT]: 'urgent',
  [NotificationType.SCHEDULE_CHANGE]: 'high',
  [NotificationType.SCHEDULE_CREATED]: 'high',
  [NotificationType.SCHEDULE_CANCELLED]: 'high',

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: 'high',
  [NotificationType.SETTLEMENT_REQUESTED]: 'normal',

  // 공고 관련
  [NotificationType.JOB_UPDATED]: 'low',
  [NotificationType.JOB_CANCELLED]: 'high',
  [NotificationType.JOB_CLOSED]: 'normal',

  // 시스템
  [NotificationType.ANNOUNCEMENT]: 'normal',
  [NotificationType.MAINTENANCE]: 'high',
  [NotificationType.APP_UPDATE]: 'low',

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: 'normal',
  [NotificationType.REPORT_RESOLVED]: 'normal',
  [NotificationType.NEW_REPORT]: 'high',
  [NotificationType.NEW_INQUIRY]: 'normal',
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: 'high',
};

// ============================================================================
// Notification Data Types
// ============================================================================

/**
 * 알림 데이터 인터페이스
 *
 * @description Firestore notifications 컬렉션 문서 구조
 */
export interface NotificationData extends FirebaseDocument {
  /** 수신자 ID */
  recipientId: string;
  /** 알림 타입 */
  type: NotificationType;
  /**
   * 알림 카테고리
   *
   * @description Firestore에 저장되거나 type에서 계산됨
   * @see NOTIFICATION_TYPE_TO_CATEGORY - type에서 category 계산
   */
  category?: NotificationCategory;
  /** 제목 */
  title: string;
  /** 본문 */
  body: string;
  /** 딥링크 경로 */
  link?: string;
  /** 추가 데이터 */
  data?: Record<string, string>;
  /** 읽음 여부 */
  isRead: boolean;
  /** 우선순위 */
  priority?: NotificationPriority;
  /** 생성 시간 */
  createdAt: Timestamp;
  /** 읽은 시간 */
  readAt?: Timestamp;
}

/**
 * 알림 설정
 */
export interface NotificationSettings {
  /** 전체 알림 활성화 */
  /** 전체 푸시 알림 활성화 */
  pushEnabled?: boolean;
  enabled: boolean;
  /** 카테고리별 설정 */
  categories: {
    [key in NotificationCategory]: {
      enabled: boolean;
      pushEnabled: boolean;
    };
  };
  /** 방해 금지 시간 */
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
  };
  /** 알림 그룹화 설정 */
  grouping?: {
    /** 그룹화 활성화 여부 (기본: true) */
    enabled: boolean;
    /** 최소 그룹 크기 (기본: 2) */
    minGroupSize: number;
    /** 그룹화 시간 윈도우 (시간 단위, 기본: 24) */
    timeWindowHours: number;
  };
  /** 업데이트 시간 */
  updatedAt?: Timestamp;
}

/**
 * 알림 필터
 */
export interface NotificationFilter {
  isRead?: boolean;
  category?: NotificationCategory;
  types?: NotificationType[];
  startDate?: Date;
  endDate?: Date;
}

/**
 * 알림 통계
 */
export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
}

// ============================================================================
// Android Channel Types
// ============================================================================

/**
 * Android 알림 채널 ID
 */
export const AndroidChannelId = {
  DEFAULT: 'default',
  APPLICATIONS: 'applications',
  REMINDERS: 'reminders',
  SETTLEMENT: 'settlement',
  ANNOUNCEMENTS: 'announcements',
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- const/type 합성 패턴
export type AndroidChannelId = (typeof AndroidChannelId)[keyof typeof AndroidChannelId];

/**
 * 알림 타입 → Android 채널 매핑
 */
export const NOTIFICATION_TYPE_TO_CHANNEL: Record<NotificationType, AndroidChannelId> = {
  // 지원 관련
  [NotificationType.NEW_APPLICATION]: AndroidChannelId.APPLICATIONS,
  [NotificationType.APPLICATION_CANCELLED]: AndroidChannelId.APPLICATIONS,
  [NotificationType.APPLICATION_CONFIRMED]: AndroidChannelId.APPLICATIONS,
  [NotificationType.CONFIRMATION_CANCELLED]: AndroidChannelId.APPLICATIONS,
  [NotificationType.APPLICATION_REJECTED]: AndroidChannelId.APPLICATIONS,
  [NotificationType.CANCELLATION_APPROVED]: AndroidChannelId.APPLICATIONS,
  [NotificationType.CANCELLATION_REJECTED]: AndroidChannelId.APPLICATIONS,

  // 출퇴근/스케줄 관련
  [NotificationType.STAFF_CHECKED_IN]: AndroidChannelId.REMINDERS,
  [NotificationType.STAFF_CHECKED_OUT]: AndroidChannelId.REMINDERS,
  [NotificationType.CHECK_IN_CONFIRMED]: AndroidChannelId.DEFAULT,
  [NotificationType.CHECK_OUT_CONFIRMED]: AndroidChannelId.DEFAULT,
  [NotificationType.CHECKIN_REMINDER]: AndroidChannelId.REMINDERS,
  [NotificationType.NO_SHOW_ALERT]: AndroidChannelId.REMINDERS,
  [NotificationType.SCHEDULE_CHANGE]: AndroidChannelId.REMINDERS,
  [NotificationType.SCHEDULE_CREATED]: AndroidChannelId.REMINDERS,
  [NotificationType.SCHEDULE_CANCELLED]: AndroidChannelId.REMINDERS,

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: AndroidChannelId.SETTLEMENT,
  [NotificationType.SETTLEMENT_REQUESTED]: AndroidChannelId.SETTLEMENT,

  // 공고 관련
  [NotificationType.JOB_UPDATED]: AndroidChannelId.ANNOUNCEMENTS,
  [NotificationType.JOB_CANCELLED]: AndroidChannelId.ANNOUNCEMENTS,
  [NotificationType.JOB_CLOSED]: AndroidChannelId.ANNOUNCEMENTS,

  // 시스템
  [NotificationType.ANNOUNCEMENT]: AndroidChannelId.ANNOUNCEMENTS,
  [NotificationType.MAINTENANCE]: AndroidChannelId.ANNOUNCEMENTS,
  [NotificationType.APP_UPDATE]: AndroidChannelId.ANNOUNCEMENTS,

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: AndroidChannelId.DEFAULT,
  [NotificationType.REPORT_RESOLVED]: AndroidChannelId.DEFAULT,
  [NotificationType.NEW_REPORT]: AndroidChannelId.DEFAULT,
  [NotificationType.NEW_INQUIRY]: AndroidChannelId.DEFAULT,
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: AndroidChannelId.DEFAULT,
};

// ============================================================================
// Notification Labels
// ============================================================================

/**
 * 알림 타입 라벨 (한글)
 */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  // 지원 관련
  [NotificationType.NEW_APPLICATION]: '새로운 지원자',
  [NotificationType.APPLICATION_CANCELLED]: '지원 취소',
  [NotificationType.APPLICATION_CONFIRMED]: '지원 확정',
  [NotificationType.CONFIRMATION_CANCELLED]: '확정 취소',
  [NotificationType.APPLICATION_REJECTED]: '지원 거절',
  [NotificationType.CANCELLATION_APPROVED]: '취소 승인',
  [NotificationType.CANCELLATION_REJECTED]: '취소 거절',

  // 출퇴근/스케줄 관련
  [NotificationType.STAFF_CHECKED_IN]: '출근 알림',
  [NotificationType.STAFF_CHECKED_OUT]: '퇴근 알림',
  [NotificationType.CHECK_IN_CONFIRMED]: '출근 확인',
  [NotificationType.CHECK_OUT_CONFIRMED]: '퇴근 확인',
  [NotificationType.CHECKIN_REMINDER]: '출근 리마인더',
  [NotificationType.NO_SHOW_ALERT]: '노쇼 알림',
  [NotificationType.SCHEDULE_CHANGE]: '근무 시간 변경',
  [NotificationType.SCHEDULE_CREATED]: '새 근무 배정',
  [NotificationType.SCHEDULE_CANCELLED]: '근무 취소',

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: '정산 완료',
  [NotificationType.SETTLEMENT_REQUESTED]: '정산 요청',

  // 공고 관련
  [NotificationType.JOB_UPDATED]: '공고 수정',
  [NotificationType.JOB_CANCELLED]: '공고 취소',
  [NotificationType.JOB_CLOSED]: '공고 마감',

  // 시스템
  [NotificationType.ANNOUNCEMENT]: '공지사항',
  [NotificationType.MAINTENANCE]: '시스템 점검',
  [NotificationType.APP_UPDATE]: '앱 업데이트',

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: '문의 답변',
  [NotificationType.REPORT_RESOLVED]: '신고 처리 완료',
  [NotificationType.NEW_REPORT]: '새 신고',
  [NotificationType.NEW_INQUIRY]: '새 문의',
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: '대회 승인 요청',
};

/**
 * 알림 카테고리 라벨 (한글)
 */
export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  [NotificationCategory.APPLICATION]: '지원/확정',
  [NotificationCategory.ATTENDANCE]: '출퇴근',
  [NotificationCategory.SETTLEMENT]: '정산',
  [NotificationCategory.JOB]: '공고',
  [NotificationCategory.SYSTEM]: '시스템',
  [NotificationCategory.ADMIN]: '관리자',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 알림 카테고리 가져오기
 */
export function getNotificationCategory(type: NotificationType): NotificationCategory {
  return NOTIFICATION_TYPE_TO_CATEGORY[type];
}

/**
 * 알림 우선순위 가져오기
 */
export function getNotificationPriority(type: NotificationType): NotificationPriority {
  return NOTIFICATION_DEFAULT_PRIORITY[type];
}

/**
 * Android 채널 ID 가져오기
 */
export function getAndroidChannelId(type: NotificationType): AndroidChannelId {
  return NOTIFICATION_TYPE_TO_CHANNEL[type];
}

/**
 * Timestamp/Date를 Date로 변환
 *
 * @note Firestore 웹 SDK에서 Timestamp가 plain object로 올 수 있어 duck typing 사용
 */
export function toDateFromTimestamp(value: Timestamp | Date | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  // plain object fallback ({seconds, nanoseconds})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ('seconds' in value && typeof (value as any).seconds === 'number') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Date((value as any).seconds * 1000);
  }
  return undefined;
}

/**
 * 기본 알림 설정 생성
 */
export function createDefaultNotificationSettings(): NotificationSettings {
  const categories = Object.values(NotificationCategory).reduce(
    (acc, category) => ({
      ...acc,
      [category]: { enabled: true, pushEnabled: true },
    }),
    {} as NotificationSettings['categories']
  );

  return {
    enabled: true,
    categories,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
    grouping: {
      enabled: true,
      minGroupSize: 2,
      timeWindowHours: 24,
    },
  };
}

// ============================================================================
// Notification Grouping Types
// ============================================================================

/**
 * 그룹핑 가능한 알림 타입
 *
 * @description 같은 컨텍스트(jobPostingId)에서 여러 번 발생할 수 있는 타입만 포함
 */
export const GROUPABLE_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.NEW_APPLICATION,
  NotificationType.APPLICATION_CANCELLED,
  NotificationType.STAFF_CHECKED_IN,
  NotificationType.STAFF_CHECKED_OUT,
  NotificationType.NO_SHOW_ALERT,
];

/**
 * 그룹화된 알림 데이터
 */
export interface GroupedNotificationData {
  /** 그룹 고유 ID (type + context key 조합) */
  groupId: string;
  /** 알림 타입 (그룹 내 동일) */
  type: NotificationType;
  /** 그룹핑 컨텍스트 */
  context: {
    jobPostingId?: string;
    jobTitle?: string;
  };
  /** 그룹 내 알림 목록 (최신순 정렬) */
  notifications: NotificationData[];
  /** 그룹 내 총 알림 수 */
  count: number;
  /** 읽지 않은 알림 수 */
  unreadCount: number;
  /** 가장 최근 알림 시간 (그룹 정렬용) */
  latestCreatedAt: Timestamp;
  /** 그룹 대표 제목 (예: "새 지원자 5명") */
  groupTitle: string;
  /** 그룹 대표 본문 (최근 알림 내용 요약) */
  groupBody: string;
}

/**
 * 알림 리스트 아이템 (개별 or 그룹)
 */
export type NotificationListItem = NotificationData | GroupedNotificationData;

/**
 * 그룹 여부 타입 가드
 */
export function isGroupedNotification(item: NotificationListItem): item is GroupedNotificationData {
  return 'groupId' in item && 'notifications' in item;
}

/**
 * 그룹핑 옵션
 */
export interface NotificationGroupingOptions {
  /** 그룹핑 활성화 여부 (기본: true) */
  enabled?: boolean;
  /** 최소 그룹 크기 (이 수 이상일 때만 그룹화, 기본: 2) */
  minGroupSize?: number;
  /** 그룹핑 시간 윈도우 (밀리초, 기본: 24시간) */
  timeWindowMs?: number;
}
