/**
 * UNIQN Mobile - 알림 관련 타입 정의
 *
 * @description 푸시 알림, 인앱 알림 타입 정의
 * @version 2.0.0
 */

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
  /** 취소 요청 접수됨 (사장·워크스페이스 멤버·협업자에게) */
  CANCELLATION_REQUESTED: 'cancellation_requested',

  // === 출퇴근/스케줄 관련 ===
  /**
   * ⚠️ 아래 STAFF_CHECKED_* / CHECK_*_CONFIRMED 4종은
   * supabase/migrations/20260807160000_worklog_checkinout_notify_split_recipient_types.sql
   * 의 트리거 함수(notify_on_work_log_checkinout_update)에서 문자열로 하드코딩되어
   * INSERT됩니다. 값 변경 시 반드시 새 마이그레이션으로 트리거 함수도 함께 수정해야 합니다.
   *
   * 수신자별로 타입이 갈린다 — 이 분리가 곧 딥링크 방향 판별자다.
   * 합치면 구인자가 구직자용 공고 상세로 착지한다(2026-04-21~08-07 실제 회귀).
   */
  /** 출근 체크인 알림 (구인자에게) */
  STAFF_CHECKED_IN: 'staff_checked_in',
  /** 퇴근 체크아웃 알림 (구인자에게) */
  STAFF_CHECKED_OUT: 'staff_checked_out',
  /** 출근 확인 알림 (스태프 본인에게) */
  CHECK_IN_CONFIRMED: 'check_in_confirmed',
  /** 퇴근 확인 알림 (스태프 본인에게) */
  CHECK_OUT_CONFIRMED: 'check_out_confirmed',
  /**
   * ⚠️ 레거시 — 2026-04-21 timestamptz 전환이 위 4종을 두 종으로 합쳐 버린 기간
   * (2026-04-21 ~ 2026-08-07)에 발송된 prod 6건을 흡수하기 위한 값이다.
   * `20260807160000` 이후 트리거는 이 값을 **더 이상 보내지 않는다**.
   * 신규 코드에서 쓰지 말 것. 기존 알림 이력의 카테고리·아이콘·라우팅을 위해서만 존재한다.
   */
  /** (레거시) 출근 기록 — 스태프·구인자 공용이던 값 */
  WORK_LOG_CHECK_IN: 'work_log_check_in',
  /** (레거시) 퇴근 기록 — 스태프·구인자 공용이던 값 */
  WORK_LOG_CHECK_OUT: 'work_log_check_out',
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
  /**
   * 지급 완료 되돌리기 (스태프에게) — SETTLEMENT_COMPLETED 의 짝.
   *
   * ⚠️ 이 값은 supabase/migrations/20260802093000_notify_settlement_revert_and_cancel_hint_gate.sql
   * 의 트리거 함수(notify_on_work_log_update Case 3-B)에서 문자열로 하드코딩되어 INSERT됩니다.
   * 값 변경 시 반드시 새 마이그레이션으로 트리거 함수도 함께 수정해야 합니다.
   */
  SETTLEMENT_REVERTED: 'settlement_reverted',
  /** 음수 정산 경고 (관리자에게) */
  NEGATIVE_SETTLEMENT_ALERT: 'negative_settlement_alert',

  // === 공고 관련 ===
  /** 공고 수정됨 */
  JOB_UPDATED: 'job_updated',
  /** 공고 취소됨 */
  JOB_CANCELLED: 'job_cancelled',
  /** 공고 마감됨 */
  JOB_CLOSED: 'job_closed',
  /** 고정 공고 만료 (작성자에게) */
  FIXED_POSTING_EXPIRED: 'fixed_posting_expired',
  /** 근무일 경과 자동 마감 (작성자에게) */
  WORK_DATE_EXPIRED: 'work_date_expired',
  /**
   * ⚠️ 아래 JOB_POSTING_COLLABORATOR_* 2종은 baseline(20260710000002)의 트리거 함수
   * notify_on_collaborator_added / notify_on_collaborator_removed 가 문자열로
   * 하드코딩해 INSERT합니다. 값 변경 시 새 마이그레이션으로 트리거도 함께 수정해야 합니다.
   */
  /** 공고 관리 협업자로 초대됨 */
  JOB_POSTING_COLLABORATOR_ADDED: 'job_posting_collaborator_added',
  /** 공고 관리 협업자에서 제외됨 */
  JOB_POSTING_COLLABORATOR_REMOVED: 'job_posting_collaborator_removed',

  // === 시스템 ===
  /** 공지사항 */
  ANNOUNCEMENT: 'announcement',
  /** 시스템 점검 */
  MAINTENANCE: 'maintenance',
  /** 앱 업데이트 */
  APP_UPDATE: 'app_update',
  BOARD_COMMENT: 'board_comment',
  BOARD_REPLY: 'board_reply',
  BOARD_MENTION: 'board_mention',
  BOARD_LOCKED: 'board_locked',

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
  /**
   * ⚠️ 아래 EMPLOYER_APP_* / NEW_EMPLOYER_APPLICATION 값은
   * supabase/migrations/20260416190000_employer_application_notifications.sql 의
   * 트리거 함수에서 문자열로 하드코딩되어 INSERT됩니다. 값 변경 시 반드시 새
   * 마이그레이션으로 트리거 함수도 함께 수정해야 합니다.
   */
  /** 구인자 신청 접수 (신청자에게) */
  EMPLOYER_APP_SUBMITTED: 'employer_app_submitted',
  /** 구인자 신청 승인 (신청자에게) */
  EMPLOYER_APP_APPROVED: 'employer_app_approved',
  /** 구인자 신청 거부 (신청자에게) */
  EMPLOYER_APP_REJECTED: 'employer_app_rejected',
  /** 새 구인자 신청 접수 (관리자에게) */
  NEW_EMPLOYER_APPLICATION: 'new_employer_application',
  /**
   * ⚠️ ROLE_CHANGED 값은 supabase/migrations/20260725180000_update_user_role_change_notification.sql
   * 의 update_user_role RPC에서 문자열로 하드코딩되어 INSERT됩니다. 값 변경 시 반드시
   * 새 마이그레이션으로 RPC도 함께 수정해야 합니다.
   */
  /** 관리자에 의한 계정 권한 변경 (대상 유저에게) — 수신 시 refreshProfile로 세션 재발급 */
  ROLE_CHANGED: 'role_changed',

  // === 리뷰/평가 관련 ===
  /** 평가 요청 (근무 완료 후 양쪽에게) */
  REVIEW_REQUEST: 'review_request',
  /** 평가 도착 (상대방이 평가 완료 시) */
  REVIEW_RECEIVED: 'review_received',
  /** 평가 마감 리마인더 (D-2) */
  REVIEW_REMINDER: 'review_reminder',

  // === 워크스페이스 협업 (PR #2) ===
  /** 워크스페이스 초대 발송 (invitee 에게) */
  WORKSPACE_INVITATION: 'workspace_invitation',

  // === ops (라이브 운영 대회) ===
  /**
   * ops 대회에 스태프로 직접 배정됨 (배정된 스태프에게) — ops 결함⑦-1.
   *
   * ⚠️ 이 값은 supabase/migrations/20260809100000_ops_staff_assignment_notification.sql
   * 의 트리거 함수(notify_on_ops_staff_insert)에서 문자열로 하드코딩되어 INSERT됩니다.
   * 값 변경 시 반드시 새 마이그레이션으로 트리거 함수도 함께 수정해야 합니다.
   *
   * 🔴 딥링크가 없다(link=NULL). is_ops_member 가 ops_staff 를 멤버로 보지 않아
   * 배정된 스태프는 ops 화면을 한 줄도 SELECT 할 수 없다 — 보내면 RLS 가 막는 빈 화면에
   * 도착한다. 그래서 본문이 대회명·담당·날짜·장소를 전부 싣고, 라우트는 알림함에 머문다.
   */
  OPS_STAFF_ASSIGNED: 'ops_staff_assigned',
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- const/type 합성 패턴
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NOTIFICATION_TYPES = Object.values(NotificationType) as [
  NotificationType,
  ...NotificationType[],
];

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
  REVIEW: 'review', // 리뷰/평가
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- const/type 합성 패턴
export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NOTIFICATION_CATEGORIES = Object.values(NotificationCategory) as [
  NotificationCategory,
  ...NotificationCategory[],
];

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
  [NotificationType.CANCELLATION_REQUESTED]: NotificationCategory.APPLICATION,

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
  // 레거시 흡수분도 '출퇴근' 탭에서 보여야 한다 — 미매핑이면 탭에서 증발한다.
  [NotificationType.WORK_LOG_CHECK_IN]: NotificationCategory.ATTENDANCE,
  [NotificationType.WORK_LOG_CHECK_OUT]: NotificationCategory.ATTENDANCE,

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: NotificationCategory.SETTLEMENT,
  [NotificationType.SETTLEMENT_REVERTED]: NotificationCategory.SETTLEMENT,
  [NotificationType.NEGATIVE_SETTLEMENT_ALERT]: NotificationCategory.ADMIN,

  // 공고 관련
  [NotificationType.JOB_UPDATED]: NotificationCategory.JOB,
  [NotificationType.JOB_CANCELLED]: NotificationCategory.JOB,
  [NotificationType.JOB_CLOSED]: NotificationCategory.JOB,
  [NotificationType.FIXED_POSTING_EXPIRED]: NotificationCategory.JOB,
  [NotificationType.WORK_DATE_EXPIRED]: NotificationCategory.JOB,
  // 협업자 초대/제외는 공고 '상태' 변화가 아니라 '권한' 변화다 —
  // ROLE_CHANGED·WORKSPACE_INVITATION 과 같은 축으로 둔다. '공고' 토글을 끈 사장이
  // 관리 권한 통지까지 놓치면 안 된다.
  [NotificationType.JOB_POSTING_COLLABORATOR_ADDED]: NotificationCategory.SYSTEM,
  [NotificationType.JOB_POSTING_COLLABORATOR_REMOVED]: NotificationCategory.SYSTEM,

  // 시스템
  [NotificationType.ANNOUNCEMENT]: NotificationCategory.SYSTEM,
  [NotificationType.MAINTENANCE]: NotificationCategory.SYSTEM,
  [NotificationType.APP_UPDATE]: NotificationCategory.SYSTEM,
  [NotificationType.BOARD_COMMENT]: NotificationCategory.SYSTEM,
  [NotificationType.BOARD_REPLY]: NotificationCategory.SYSTEM,
  [NotificationType.BOARD_MENTION]: NotificationCategory.SYSTEM,
  [NotificationType.BOARD_LOCKED]: NotificationCategory.SYSTEM,

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: NotificationCategory.ADMIN,
  [NotificationType.REPORT_RESOLVED]: NotificationCategory.ADMIN,
  [NotificationType.NEW_REPORT]: NotificationCategory.ADMIN,
  [NotificationType.NEW_INQUIRY]: NotificationCategory.ADMIN,
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: NotificationCategory.ADMIN,
  [NotificationType.EMPLOYER_APP_SUBMITTED]: NotificationCategory.SYSTEM,
  [NotificationType.EMPLOYER_APP_APPROVED]: NotificationCategory.SYSTEM,
  [NotificationType.EMPLOYER_APP_REJECTED]: NotificationCategory.SYSTEM,
  [NotificationType.NEW_EMPLOYER_APPLICATION]: NotificationCategory.ADMIN,
  [NotificationType.ROLE_CHANGED]: NotificationCategory.SYSTEM,

  // 리뷰/평가 관련
  [NotificationType.REVIEW_REQUEST]: NotificationCategory.REVIEW,
  [NotificationType.REVIEW_RECEIVED]: NotificationCategory.REVIEW,
  [NotificationType.REVIEW_REMINDER]: NotificationCategory.REVIEW,

  // 워크스페이스 협업 (PR #2)
  [NotificationType.WORKSPACE_INVITATION]: NotificationCategory.SYSTEM,

  // ops — 근무 배정 축이다. notification_category enum 에 'ops' 를 새로 넣지 않는다
  // (ALTER TYPE ADD VALUE 는 되돌릴 수 없다). 스태프가 이미 켜 두고 보는 '출퇴근' 탭에 얹는다.
  [NotificationType.OPS_STAFF_ASSIGNED]: NotificationCategory.ATTENDANCE,
};

// ============================================================================
// Notification Priority
// ============================================================================

/**
 * 알림 우선순위
 */
export const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

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
  [NotificationType.CANCELLATION_REQUESTED]: 'high',

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
  // DB 트리거가 INSERT 하는 priority 리터럴과 일치시킨다 —
  // NotificationRepository 가 DB 값을 이 표로 덮어쓰므로 어긋나면 정렬이 왜곡된다.
  [NotificationType.WORK_LOG_CHECK_IN]: 'normal',
  [NotificationType.WORK_LOG_CHECK_OUT]: 'normal',

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: 'high',
  // 금전 상태 역행은 완료 통지와 같은 무게로 다룬다 — 이의 제기 시점을 놓치면 회복이 어렵다.
  [NotificationType.SETTLEMENT_REVERTED]: 'high',
  [NotificationType.NEGATIVE_SETTLEMENT_ALERT]: 'urgent',

  // 공고 관련
  [NotificationType.JOB_UPDATED]: 'low',
  [NotificationType.JOB_CANCELLED]: 'high',
  [NotificationType.JOB_CLOSED]: 'normal',
  [NotificationType.FIXED_POSTING_EXPIRED]: 'normal',
  [NotificationType.WORK_DATE_EXPIRED]: 'normal',
  [NotificationType.JOB_POSTING_COLLABORATOR_ADDED]: 'normal',
  [NotificationType.JOB_POSTING_COLLABORATOR_REMOVED]: 'normal',

  // 시스템
  [NotificationType.ANNOUNCEMENT]: 'normal',
  [NotificationType.MAINTENANCE]: 'high',
  [NotificationType.APP_UPDATE]: 'low',
  [NotificationType.BOARD_COMMENT]: 'normal',
  [NotificationType.BOARD_REPLY]: 'normal',
  [NotificationType.BOARD_MENTION]: 'high',
  [NotificationType.BOARD_LOCKED]: 'high',

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: 'normal',
  [NotificationType.REPORT_RESOLVED]: 'normal',
  [NotificationType.NEW_REPORT]: 'high',
  [NotificationType.NEW_INQUIRY]: 'normal',
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: 'high',
  [NotificationType.EMPLOYER_APP_SUBMITTED]: 'normal',
  [NotificationType.EMPLOYER_APP_APPROVED]: 'high',
  [NotificationType.EMPLOYER_APP_REJECTED]: 'normal',
  [NotificationType.NEW_EMPLOYER_APPLICATION]: 'high',
  [NotificationType.ROLE_CHANGED]: 'high',

  // 리뷰/평가 관련
  [NotificationType.REVIEW_REQUEST]: 'normal',
  [NotificationType.REVIEW_RECEIVED]: 'normal',
  [NotificationType.REVIEW_REMINDER]: 'high',

  // 워크스페이스 협업 (PR #2)
  [NotificationType.WORKSPACE_INVITATION]: 'normal',

  // ops — schedule_created('새 근무 배정')와 같은 무게다. 놓치면 그날 대회에 사람이 안 온다.
  // DB 트리거가 INSERT 하는 priority 리터럴('high')과 일치시킨다.
  [NotificationType.OPS_STAFF_ASSIGNED]: 'high',
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
  createdAt: Date;
  /** 읽은 시간 */
  readAt?: Date;
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
  updatedAt?: Date;
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
  [NotificationType.CANCELLATION_REQUESTED]: '취소 요청',

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
  // 레거시 6건은 스태프·구인자가 같은 값을 공유한다 — 한쪽 시점 라벨('출근 확인')을 쓰면
  // 나머지 절반에게 거짓말이 되고, 위 죽지 않은 4종과 목록에서 구분도 되지 않는다.
  [NotificationType.WORK_LOG_CHECK_IN]: '출근 기록',
  [NotificationType.WORK_LOG_CHECK_OUT]: '퇴근 기록',

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: '정산 완료',
  [NotificationType.SETTLEMENT_REVERTED]: '지급 완료 취소',
  [NotificationType.NEGATIVE_SETTLEMENT_ALERT]: '음수 정산 경고',

  // 공고 관련
  [NotificationType.JOB_UPDATED]: '공고 수정',
  [NotificationType.JOB_CANCELLED]: '공고 취소',
  [NotificationType.JOB_CLOSED]: '공고 마감',
  [NotificationType.FIXED_POSTING_EXPIRED]: '고정 공고 만료',
  [NotificationType.WORK_DATE_EXPIRED]: '근무일 경과 마감',
  [NotificationType.JOB_POSTING_COLLABORATOR_ADDED]: '공고 관리 초대',
  [NotificationType.JOB_POSTING_COLLABORATOR_REMOVED]: '공고 관리 제외',

  // 시스템
  [NotificationType.ANNOUNCEMENT]: '공지사항',
  [NotificationType.MAINTENANCE]: '시스템 점검',
  [NotificationType.APP_UPDATE]: '앱 업데이트',
  [NotificationType.BOARD_COMMENT]: '새 댓글',
  [NotificationType.BOARD_REPLY]: '새 답글',
  [NotificationType.BOARD_MENTION]: '멘션',
  [NotificationType.BOARD_LOCKED]: '게시글 잠금',

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: '문의 답변',
  [NotificationType.REPORT_RESOLVED]: '신고 처리 완료',
  [NotificationType.NEW_REPORT]: '새 신고',
  [NotificationType.NEW_INQUIRY]: '새 문의',
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: '대회 승인 요청',
  [NotificationType.EMPLOYER_APP_SUBMITTED]: '구인자 신청 접수',
  [NotificationType.EMPLOYER_APP_APPROVED]: '구인자 신청 승인',
  [NotificationType.EMPLOYER_APP_REJECTED]: '구인자 신청 거부',
  [NotificationType.NEW_EMPLOYER_APPLICATION]: '새 구인자 신청',
  [NotificationType.ROLE_CHANGED]: '계정 권한 변경',

  // 리뷰/평가 관련
  [NotificationType.REVIEW_REQUEST]: '평가 요청',
  [NotificationType.REVIEW_RECEIVED]: '평가 도착',
  [NotificationType.REVIEW_REMINDER]: '평가 마감 임박',

  // 워크스페이스 협업 (PR #2)
  [NotificationType.WORKSPACE_INVITATION]: '팀 초대',

  // ops
  [NotificationType.OPS_STAFF_ASSIGNED]: '대회 스태프 배정',
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
  [NotificationCategory.REVIEW]: '평가',
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
 * Timestamp/Date를 Date로 변환
 *
 * @note Firestore 웹 SDK에서 Timestamp가 plain object로 올 수 있어 duck typing 사용
 */
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
  latestCreatedAt: Date;
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
