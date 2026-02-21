/**
 * UNIQN Mobile - 알림 타입별 딥링크 라우트 매핑
 *
 * @description 29개 NotificationType 전체 커버
 * @version 2.0.0
 *
 * v2.0 변경사항:
 * - 누락된 4개 타입 추가: job_closed, new_report, new_inquiry, tournament_approval_request
 * - 존재하지 않는 라우트 제거: application, my-applications, notification, settings/notifications
 * - 관리자 라우트 추가
 */

import { NotificationType } from '@/types/notification';
import type { DeepLinkRoute } from './types';

// ============================================================================
// Notification Route Map
// ============================================================================

/**
 * 알림 타입별 딥링크 라우트 생성 함수 매핑
 *
 * @description 모든 NotificationType을 커버
 * Record<NotificationType, ...>로 타입 안전성 보장
 */
export const NOTIFICATION_ROUTE_MAP: Record<
  NotificationType,
  (data?: Record<string, string>) => DeepLinkRoute
> = {
  // ============================================================================
  // 지원 관련 (7개)
  // ============================================================================

  /**
   * 새로운 지원자 (구인자에게)
   * → 지원자 관리 페이지로 이동
   */
  [NotificationType.NEW_APPLICATION]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/applicants', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },

  /**
   * 지원 취소됨 (구인자에게)
   * → 지원자 관리 페이지로 이동
   */
  [NotificationType.APPLICATION_CANCELLED]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/applicants', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },

  /**
   * 확정됨 (스태프에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.APPLICATION_CONFIRMED]: () => ({ name: 'schedule' }),

  /**
   * 확정 취소됨 (스태프에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.CONFIRMATION_CANCELLED]: () => ({ name: 'schedule' }),

  /**
   * 거절됨 (스태프에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.APPLICATION_REJECTED]: () => ({ name: 'schedule' }),

  /**
   * 취소 요청 승인됨 (지원자에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.CANCELLATION_APPROVED]: () => ({ name: 'schedule' }),

  /**
   * 취소 요청 거절됨 (지원자에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.CANCELLATION_REJECTED]: () => ({ name: 'schedule' }),

  // ============================================================================
  // 출퇴근/스케줄 관련 (9개)
  // ============================================================================

  /**
   * 출근 체크인 알림 (구인자에게)
   * → 지원자 관리 페이지로 이동
   */
  [NotificationType.STAFF_CHECKED_IN]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/applicants', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },

  /**
   * 퇴근 체크아웃 알림 (구인자에게)
   * → 지원자 관리 페이지로 이동
   */
  [NotificationType.STAFF_CHECKED_OUT]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/applicants', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },

  /**
   * 출근 확인 알림 (스태프 본인에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.CHECK_IN_CONFIRMED]: () => ({ name: 'schedule' }),

  /**
   * 퇴근 확인 알림 (스태프 본인에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.CHECK_OUT_CONFIRMED]: () => ({ name: 'schedule' }),

  /**
   * 출근 리마인더 (스태프에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.CHECKIN_REMINDER]: () => ({ name: 'schedule' }),

  /**
   * 노쇼 알림
   * → 스케줄 페이지로 이동
   */
  [NotificationType.NO_SHOW_ALERT]: () => ({ name: 'schedule' }),

  /**
   * 근무 시간 변경 (스태프에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.SCHEDULE_CHANGE]: () => ({ name: 'schedule' }),

  /**
   * 새로운 근무 배정 (스태프에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.SCHEDULE_CREATED]: () => ({ name: 'schedule' }),

  /**
   * 근무 취소 (스태프에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.SCHEDULE_CANCELLED]: () => ({ name: 'schedule' }),

  // ============================================================================
  // 정산 관련 (2개)
  // ============================================================================

  /**
   * 정산 완료 (스태프에게)
   * → 스케줄 페이지로 이동
   */
  [NotificationType.SETTLEMENT_COMPLETED]: () => ({ name: 'schedule' }),

  /**
   * 정산 요청 (구인자에게)
   * → 정산 페이지로 이동
   */
  [NotificationType.SETTLEMENT_REQUESTED]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/settlement', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },

  // ============================================================================
  // 공고 관련 (3개)
  // ============================================================================

  /**
   * 공고 수정됨
   * → 공고 상세 페이지로 이동
   */
  [NotificationType.JOB_UPDATED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },

  /**
   * 공고 취소됨
   * → 스케줄 페이지로 이동 (내 지원 내역 페이지 없음)
   */
  [NotificationType.JOB_CANCELLED]: () => ({ name: 'schedule' }),

  /**
   * 공고 마감됨 (v2.0 추가)
   * → 공고 상세 페이지로 이동
   */
  [NotificationType.JOB_CLOSED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },

  // ============================================================================
  // 시스템 (3개)
  // ============================================================================

  /**
   * 공지사항
   * → 알림 목록으로 이동
   */
  [NotificationType.ANNOUNCEMENT]: () => ({ name: 'notifications' }),

  /**
   * 시스템 점검
   * → 알림 목록으로 이동
   */
  [NotificationType.MAINTENANCE]: () => ({ name: 'notifications' }),

  /**
   * 앱 업데이트
   * → 알림 목록으로 이동
   */
  [NotificationType.APP_UPDATE]: () => ({ name: 'notifications' }),

  // ============================================================================
  // 관리자 (5개)
  // ============================================================================

  /**
   * 문의 답변 완료 (사용자에게)
   * → 고객지원 페이지로 이동
   */
  [NotificationType.INQUIRY_ANSWERED]: () => ({ name: 'support' }),

  /**
   * 신고 처리 완료 (신고자에게)
   * → 알림 목록으로 이동
   */
  [NotificationType.REPORT_RESOLVED]: () => ({ name: 'notifications' }),

  /**
   * 새로운 신고 접수 (관리자에게) (v2.0 추가)
   * → 신고 관리 페이지로 이동
   */
  [NotificationType.NEW_REPORT]: (data) =>
    data?.reportId
      ? { name: 'admin/report', params: { id: data.reportId } }
      : { name: 'admin/reports' },

  /**
   * 새로운 문의 접수 (관리자에게) (v2.0 추가)
   * → 문의 관리 페이지로 이동
   */
  [NotificationType.NEW_INQUIRY]: (data) =>
    data?.inquiryId
      ? { name: 'admin/inquiry', params: { id: data.inquiryId } }
      : { name: 'admin/inquiries' },

  /**
   * 대회공고 승인 요청 (관리자에게) (v2.0 추가)
   * → 대회 관리 페이지로 이동
   */
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: () => ({ name: 'admin/tournaments' }),

  /**
   * 음수 정산 경고 (관리자에게)
   * → 관리자 통계 페이지로 이동
   */
  [NotificationType.NEGATIVE_SETTLEMENT_ALERT]: () => ({ name: 'admin/dashboard' }),
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 알림 타입에서 딥링크 라우트 가져오기
 *
 * @param type - 알림 타입
 * @param data - 알림 데이터
 * @returns 딥링크 라우트
 */
export function getRouteForNotificationType(
  type: NotificationType,
  data?: Record<string, string>
): DeepLinkRoute {
  const routeGenerator = NOTIFICATION_ROUTE_MAP[type];
  return routeGenerator(data);
}

/**
 * 알림 타입이 관리자 전용인지 확인
 *
 * @param type - 알림 타입
 * @returns 관리자 전용 여부
 */
export function isAdminOnlyNotification(type: NotificationType): boolean {
  const adminTypes: NotificationType[] = [
    NotificationType.NEW_REPORT,
    NotificationType.NEW_INQUIRY,
    NotificationType.TOURNAMENT_APPROVAL_REQUEST,
    NotificationType.NEGATIVE_SETTLEMENT_ALERT,
  ];
  return adminTypes.includes(type);
}

/**
 * 알림 타입이 구인자 전용인지 확인
 *
 * @param type - 알림 타입
 * @returns 구인자 전용 여부
 */
export function isEmployerOnlyNotification(type: NotificationType): boolean {
  const employerTypes: NotificationType[] = [
    NotificationType.NEW_APPLICATION,
    NotificationType.APPLICATION_CANCELLED,
    NotificationType.STAFF_CHECKED_IN,
    NotificationType.STAFF_CHECKED_OUT,
    NotificationType.SETTLEMENT_REQUESTED,
  ];
  return employerTypes.includes(type);
}
