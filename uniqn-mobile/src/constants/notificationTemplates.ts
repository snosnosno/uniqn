/**
 * UNIQN Mobile - 알림 메시지 템플릿
 *
 * @description 알림 타입별 제목, 본문, 딥링크 템플릿
 * @version 1.0.0
 */

import { NotificationType } from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

export interface NotificationTemplate {
  /** 제목 (문자열 또는 데이터 기반 함수) */
  title: string | ((data: Record<string, string>) => string);
  /** 본문 (문자열 또는 데이터 기반 함수) */
  body: string | ((data: Record<string, string>) => string);
  /** 딥링크 생성 함수 */
  link: (data: Record<string, string>) => string;
  /** 아이콘 (이모지) */
  icon?: string;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * 알림 메시지 템플릿
 *
 * @description 알림 타입별 제목, 본문, 딥링크 정의
 */
export const NotificationTemplates: Record<NotificationType, NotificationTemplate> = {
  // =========================================================================
  // 지원 관련
  // =========================================================================

  [NotificationType.NEW_APPLICATION]: {
    title: '새로운 지원자',
    body: (d) => `${d.staffName}님이 "${d.jobTitle}" 공고에 지원했습니다.`,
    link: (d) => `/employer/postings/${d.jobPostingId}/applicants`,
    icon: '👤',
  },

  [NotificationType.APPLICATION_CANCELLED]: {
    title: '지원 취소',
    body: (d) => `${d.staffName}님이 "${d.jobTitle}" 공고 지원을 취소했습니다.`,
    link: (d) => `/employer/postings/${d.jobPostingId}/applicants`,
    icon: '❌',
  },

  [NotificationType.APPLICATION_CONFIRMED]: {
    title: '🎉 확정 알림',
    body: (d) => `"${d.jobTitle}" 공고에 확정되었습니다. ${d.workDate}에 출근해주세요.`,
    link: (d) => `/schedule?date=${d.workDate}`,
    icon: '✅',
  },

  [NotificationType.CONFIRMATION_CANCELLED]: {
    title: '확정 취소',
    body: (d) => `"${d.jobTitle}" 확정이 취소되었습니다.${d.reason ? ` 사유: ${d.reason}` : ''}`,
    link: () => '/schedule',
    icon: '🚫',
  },

  [NotificationType.APPLICATION_REJECTED]: {
    title: '지원 결과',
    body: (d) => `"${d.jobTitle}" 공고 지원이 거절되었습니다.`,
    link: (d) => `/jobs/${d.jobPostingId}`,
    icon: '😢',
  },

  // =========================================================================
  // 출퇴근 관련
  // =========================================================================

  [NotificationType.STAFF_CHECKED_IN]: {
    title: '출근 알림',
    body: (d) => `${d.staffName}님이 ${d.checkInTime}에 출근했습니다.`,
    link: (d) => `/employer/postings/${d.jobPostingId}/attendance`,
    icon: '🟢',
  },

  [NotificationType.STAFF_CHECKED_OUT]: {
    title: '퇴근 알림',
    body: (d) => `${d.staffName}님이 퇴근했습니다. 근무시간: ${d.workHours}`,
    link: (d) => `/employer/postings/${d.jobPostingId}/settlement`,
    icon: '🔴',
  },

  [NotificationType.CHECKIN_REMINDER]: {
    title: (d) => `⏰ 출근 ${d.remainingTime || '30분'} 전`,
    body: (d) => `"${d.jobTitle}" 출근 시간이 다가왔습니다.`,
    link: (d) => `/schedule?date=${d.workDate}`,
    icon: '⏰',
  },

  [NotificationType.NO_SHOW_ALERT]: {
    title: '🚨 노쇼 알림',
    body: (d) => `${d.staffName}님이 예정된 시간에 출근하지 않았습니다.`,
    link: (d) => `/employer/postings/${d.jobPostingId}/attendance`,
    icon: '⚠️',
  },

  [NotificationType.SCHEDULE_CHANGE]: {
    title: '⏰ 근무 시간 변경',
    body: (d) => `"${d.jobTitle}" 근무 시간이 변경되었습니다.${d.changeDescription ? `\n${d.changeDescription}` : ''}`,
    link: (d) => `/schedule?date=${d.workDate}`,
    icon: '📝',
  },

  // =========================================================================
  // 정산 관련
  // =========================================================================

  [NotificationType.SETTLEMENT_COMPLETED]: {
    title: '💰 정산 완료',
    body: (d) => `"${d.jobTitle}" 정산이 완료되었습니다. 지급액: ${d.amount}원`,
    link: (d) => `/schedule/${d.workLogId}`,
    icon: '💰',
  },

  [NotificationType.SETTLEMENT_REQUESTED]: {
    title: '정산 요청',
    body: (d) => `${d.staffName}님이 정산을 요청했습니다.`,
    link: (d) => `/employer/postings/${d.jobPostingId}/settlement`,
    icon: '📋',
  },

  // =========================================================================
  // 공고 관련
  // =========================================================================

  [NotificationType.JOB_CLOSING_SOON]: {
    title: '⏳ 마감 임박',
    body: (d) => `"${d.jobTitle}" 공고가 ${d.remainingTime}에 마감됩니다.`,
    link: (d) => `/jobs/${d.jobPostingId}`,
    icon: '⏳',
  },

  [NotificationType.NEW_JOB_IN_AREA]: {
    title: '📍 새 공고',
    body: (d) => `${d.location}에 새로운 공고가 등록되었습니다. "${d.jobTitle}"`,
    link: (d) => `/jobs/${d.jobPostingId}`,
    icon: '📍',
  },

  [NotificationType.JOB_UPDATED]: {
    title: '공고 수정',
    body: (d) => `"${d.jobTitle}" 공고가 수정되었습니다.`,
    link: (d) => `/jobs/${d.jobPostingId}`,
    icon: '✏️',
  },

  [NotificationType.JOB_CANCELLED]: {
    title: '공고 취소',
    body: (d) => `"${d.jobTitle}" 공고가 취소되었습니다.`,
    link: () => '/jobs',
    icon: '🚫',
  },

  // =========================================================================
  // 칩 관련
  // =========================================================================

  [NotificationType.CHIPS_PURCHASED]: {
    title: '✅ 칩 충전 완료',
    body: (d) => `${d.amount}칩이 충전되었습니다. 잔액: ${d.balance}칩`,
    link: () => '/chips',
    icon: '🪙',
  },

  [NotificationType.LOW_CHIPS_WARNING]: {
    title: '⚠️ 칩 잔액 부족',
    body: (d) => `칩 잔액이 ${d.balance}칩입니다. 충전이 필요합니다.`,
    link: () => '/chips/purchase',
    icon: '⚠️',
  },

  [NotificationType.CHIPS_REFUNDED]: {
    title: '칩 환불 완료',
    body: (d) => `${d.amount}칩이 환불되었습니다. 잔액: ${d.balance}칩`,
    link: () => '/chips',
    icon: '💸',
  },

  // =========================================================================
  // 시스템
  // =========================================================================

  [NotificationType.ANNOUNCEMENT]: {
    title: (d) => d.announcementTitle || '공지사항',
    body: (d) => d.announcementBody || '새로운 공지사항이 있습니다.',
    link: (d) => `/announcements/${d.announcementId}`,
    icon: '📢',
  },

  [NotificationType.MAINTENANCE]: {
    title: '🔧 시스템 점검',
    body: (d) => d.maintenanceMessage || '시스템 점검이 예정되어 있습니다.',
    link: () => '/announcements',
    icon: '🔧',
  },

  [NotificationType.APP_UPDATE]: {
    title: '📱 앱 업데이트',
    body: (d) => `새로운 버전(${d.version || ''})이 출시되었습니다.`,
    link: () => '/settings/about',
    icon: '📱',
  },

  // =========================================================================
  // 관리자
  // =========================================================================

  [NotificationType.INQUIRY_ANSWERED]: {
    title: '💬 문의 답변',
    body: () => '문의하신 내용에 답변이 등록되었습니다.',
    link: (d) => `/support/inquiries/${d.inquiryId}`,
    icon: '💬',
  },

  [NotificationType.REPORT_RESOLVED]: {
    title: '신고 처리 완료',
    body: () => '신고가 처리되었습니다.',
    link: (d) => `/support/reports/${d.reportId}`,
    icon: '✅',
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 알림 메시지 생성
 *
 * @param type 알림 타입
 * @param data 템플릿 데이터
 * @returns 제목, 본문, 딥링크
 */
export function createNotificationMessage(
  type: NotificationType,
  data: Record<string, string> = {}
): { title: string; body: string; link: string; icon?: string } {
  const template = NotificationTemplates[type];

  if (!template) {
    return {
      title: '알림',
      body: '새로운 알림이 있습니다.',
      link: '/notifications',
    };
  }

  const title = typeof template.title === 'function' ? template.title(data) : template.title;

  const body = typeof template.body === 'function' ? template.body(data) : template.body;

  const link = template.link(data);
  const icon = template.icon;

  return { title, body, link, icon };
}

/**
 * 알림 본문에서 데이터 추출 정규식 패턴
 */
export const NOTIFICATION_DATA_PATTERNS = {
  staffName: /(.+?)님이/,
  jobTitle: /"(.+?)"/,
  workDate: /(\d{4}-\d{2}-\d{2})/,
  amount: /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/,
};

export default NotificationTemplates;
