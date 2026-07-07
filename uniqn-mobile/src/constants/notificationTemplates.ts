/**
 * UNIQN Mobile - 알림 메시지 템플릿
 *
 * @description 알림 타입별 제목, 본문, 딥링크 템플릿
 * @version 1.0.0
 */

import { NotificationType } from '@/types/notification';
import { buildBoardNoticePostId } from '@/shared/board/boardIds';

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
    link: (d) => `/employer/applicants/${d.jobPostingId}`,
    icon: '👤',
  },

  [NotificationType.APPLICATION_CANCELLED]: {
    title: '지원 취소',
    body: (d) => `${d.staffName}님이 "${d.jobTitle}" 공고 지원을 취소했습니다.`,
    link: (d) => `/employer/applicants/${d.jobPostingId}`,
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

  [NotificationType.CANCELLATION_APPROVED]: {
    title: '취소 요청 승인',
    body: (d) => `"${d.jobTitle}" 취소 요청이 승인되었습니다.`,
    link: () => '/schedule',
    icon: '✅',
  },

  [NotificationType.CANCELLATION_REJECTED]: {
    title: '취소 요청 거절',
    body: (d) =>
      `"${d.jobTitle}" 취소 요청이 거절되었습니다.${d.reason ? ` 사유: ${d.reason}` : ''}`,
    link: () => '/schedule',
    icon: '❌',
  },

  // =========================================================================
  // 출퇴근 관련
  // =========================================================================

  [NotificationType.STAFF_CHECKED_IN]: {
    title: '출근 알림',
    body: (d) => `${d.staffName}님이 ${d.checkInTime}에 출근했습니다.`,
    link: (d) => `/employer/applicants/${d.jobPostingId}`,
    icon: '🟢',
  },

  [NotificationType.STAFF_CHECKED_OUT]: {
    title: '퇴근 알림',
    body: (d) => `${d.staffName}님이 퇴근했습니다. 근무시간: ${d.workHours}`,
    link: (d) => `/employer/settlement/${d.jobPostingId}`,
    icon: '🔴',
  },

  [NotificationType.CHECK_IN_CONFIRMED]: {
    title: '✅ 출근 확인',
    body: (d) => `"${d.jobTitle}" 출근이 확인되었습니다. (${d.checkInTime || ''})`,
    link: (d) => `/schedule?date=${d.workDate}`,
    icon: '✅',
  },

  [NotificationType.CHECK_OUT_CONFIRMED]: {
    title: '✅ 퇴근 확인',
    body: (d) => `"${d.jobTitle}" 퇴근이 확인되었습니다. 근무시간: ${d.workHours || ''}`,
    link: (d) => `/schedule?date=${d.workDate}`,
    icon: '✅',
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
    link: (d) => `/employer/applicants/${d.jobPostingId}`,
    icon: '⚠️',
  },

  [NotificationType.SCHEDULE_CHANGE]: {
    title: '⏰ 근무 시간 변경',
    body: (d) =>
      `"${d.jobTitle}" 근무 시간이 변경되었습니다.${d.changeDescription ? `\n${d.changeDescription}` : ''}`,
    link: (d) => `/schedule?date=${d.workDate}`,
    icon: '📝',
  },

  [NotificationType.SCHEDULE_CREATED]: {
    title: '📆 새 근무 배정',
    body: (d) => `"${d.jobTitle}" 근무가 배정되었습니다. ${d.workDate} ${d.startTime || ''}`,
    link: (d) => `/schedule?date=${d.workDate}`,
    icon: '📆',
  },

  [NotificationType.SCHEDULE_CANCELLED]: {
    title: '🚫 근무 취소',
    body: (d) =>
      `"${d.jobTitle}" ${d.workDate} 근무가 취소되었습니다.${d.reason ? ` 사유: ${d.reason}` : ''}`,
    link: (d) => `/schedule?date=${d.workDate}`,
    icon: '🚫',
  },

  // =========================================================================
  // 정산 관련
  // =========================================================================

  [NotificationType.SETTLEMENT_COMPLETED]: {
    title: '💰 정산 완료',
    body: (d) => `"${d.jobTitle}" 정산이 완료되었습니다. 지급액: ${d.amount}원`,
    link: () => '/schedule',
    icon: '💰',
  },

  [NotificationType.SETTLEMENT_REQUESTED]: {
    title: '정산 요청',
    body: (d) => `${d.staffName}님이 정산을 요청했습니다.`,
    link: (d) => `/employer/settlement/${d.jobPostingId}`,
    icon: '📋',
  },

  // =========================================================================
  // 공고 관련
  // =========================================================================

  [NotificationType.JOB_UPDATED]: {
    title: '공고 수정',
    body: (d) => `"${d.jobTitle}" 공고가 수정되었습니다.`,
    link: (d) => `/jobs/${d.jobPostingId}`,
    icon: '✏️',
  },

  [NotificationType.JOB_CANCELLED]: {
    title: '공고 취소',
    body: (d) => `"${d.jobTitle}" 공고가 취소되었습니다.`,
    link: () => '/schedule',
    icon: '🚫',
  },

  [NotificationType.JOB_CLOSED]: {
    title: '📋 공고 마감 안내',
    body: (d) => `"${d.jobTitle}" 공고가 마감되었습니다.`,
    link: (d) => (d.jobPostingId ? `/jobs/${d.jobPostingId}` : '/jobs'),
    icon: '📋',
  },

  [NotificationType.FIXED_POSTING_EXPIRED]: {
    title: '⏰ 고정 공고 만료',
    body: (d) => `"${d.jobTitle}" 고정 공고가 만료되어 자동 마감되었습니다.`,
    link: (d) => (d.jobPostingId ? `/jobs/${d.jobPostingId}` : '/jobs'),
    icon: '⏰',
  },

  [NotificationType.WORK_DATE_EXPIRED]: {
    title: '⏰ 공고 자동 마감',
    body: (d) => `"${d.jobTitle}" 공고가 근무일 경과로 자동 마감되었습니다.`,
    link: (d) => (d.jobPostingId ? `/jobs/${d.jobPostingId}` : '/jobs'),
    icon: '⏰',
  },

  // =========================================================================
  // 시스템
  // =========================================================================

  [NotificationType.ANNOUNCEMENT]: {
    title: (d) => d.announcementTitle || '공지사항',
    body: (d) => d.announcementBody || '새로운 공지사항이 있습니다.',
    link: (d) =>
      d.announcementId
        ? `/board/post/${buildBoardNoticePostId(d.announcementId)}`
        : '/board/notice',
    icon: '📢',
  },

  [NotificationType.MAINTENANCE]: {
    title: '🔧 시스템 점검',
    body: (d) => d.maintenanceMessage || '시스템 점검이 예정되어 있습니다.',
    link: () => '/board/notice',
    icon: '🔧',
  },

  [NotificationType.APP_UPDATE]: {
    title: '📱 앱 업데이트',
    body: (d) => `새로운 버전(${d.version || ''})이 출시되었습니다.`,
    link: () => '/settings',
    icon: '📱',
  },

  // =========================================================================
  // 관리자
  // =========================================================================

  [NotificationType.BOARD_COMMENT]: {
    title: '새 댓글',
    body: (d) => d.body || `"${d.boardTitle || '게시글'}"에 새 댓글이 달렸습니다.`,
    link: (d) => (d.postId ? `/board/post/${d.postId}` : '/board'),
    icon: '💬',
  },

  [NotificationType.BOARD_REPLY]: {
    title: '새 답글',
    body: (d) => d.body || `"${d.boardTitle || '게시글'}" 댓글에 새 답글이 달렸습니다.`,
    link: (d) => (d.postId ? `/board/post/${d.postId}` : '/board'),
    icon: '↩️',
  },

  [NotificationType.BOARD_MENTION]: {
    title: '멘션',
    body: (d) => d.body || `"${d.boardTitle || '게시글'}"에서 회원님을 멘션했습니다.`,
    link: (d) => (d.postId ? `/board/post/${d.postId}` : '/board'),
    icon: '@',
  },

  [NotificationType.BOARD_LOCKED]: {
    title: '게시글 잠금',
    body: (d) => d.body || `"${d.boardTitle || '게시글'}"이 잠겼습니다.`,
    link: (d) => (d.postId ? `/board/post/${d.postId}` : '/board'),
    icon: '🔒',
  },

  [NotificationType.INQUIRY_ANSWERED]: {
    title: '💬 문의 답변',
    body: () => '문의하신 내용에 답변이 등록되었습니다.',
    link: (d) => (d.inquiryId ? `/support/inquiry/${d.inquiryId}` : '/support/my-inquiries'),
    icon: '💬',
  },

  [NotificationType.REPORT_RESOLVED]: {
    title: '신고 처리 완료',
    body: () => '신고가 처리되었습니다.',
    link: () => '/notifications',
    icon: '✅',
  },

  [NotificationType.NEW_REPORT]: {
    title: '🚨 새로운 신고 접수',
    body: (d) => `${d.reporterName}님이 ${d.targetName}님을 신고했습니다.`,
    link: (d) => `/admin/reports/${d.reportId}`,
    icon: '🚨',
  },

  [NotificationType.NEW_INQUIRY]: {
    title: '💬 새로운 문의 접수',
    body: (d) => `${d.userName}님의 문의: ${d.subject}`,
    link: (d) => `/admin/inquiries/${d.inquiryId}`,
    icon: '💬',
  },

  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: {
    title: '🏆 대회공고 승인 요청',
    body: (d) => `${d.employerName}님이 "${d.jobTitle}" 대회공고 승인을 요청했습니다.`,
    link: () => '/admin/tournaments',
    icon: '🏆',
  },

  [NotificationType.EMPLOYER_APP_SUBMITTED]: {
    title: '구인자 신청 접수',
    body: '구인자 등록 신청이 접수되었습니다. 평균 1-2시간 내 검토 후 결과를 알려드립니다.',
    link: () => '/employer-application-status',
    icon: '📋',
  },

  [NotificationType.EMPLOYER_APP_APPROVED]: {
    title: '🎉 구인자 신청 승인',
    body: '구인자 등록 신청이 승인되었습니다. 지금 바로 공고를 등록해보세요!',
    link: () => '/employer-application-status',
    icon: '✅',
  },

  [NotificationType.EMPLOYER_APP_REJECTED]: {
    title: '구인자 신청 거부',
    body: (d) =>
      `구인자 신청이 거부되었습니다.${d.rejectionCategory ? ` 사유: ${d.rejectionCategory}` : ''}`,
    link: () => '/employer-application-status',
    icon: '❌',
  },

  [NotificationType.NEW_EMPLOYER_APPLICATION]: {
    title: '📋 새 구인자 신청',
    body: (d) => `새로운 구인자 등록 신청이 접수되었습니다. (신청자 ID: ${d.userId || ''})`,
    link: (d) => `/admin/employer-applications/${d.applicationId || ''}`,
    icon: '📋',
  },

  [NotificationType.NEGATIVE_SETTLEMENT_ALERT]: {
    title: '⚠️ 음수 정산 경고',
    body: (d) => `${d.staffName || '스태프'}님의 정산 금액이 -${d.amount || '0'}원입니다.`,
    link: () => '/admin/dashboard',
    icon: '⚠️',
  },

  // =========================================================================
  // 리뷰/평가 관련
  // =========================================================================

  [NotificationType.REVIEW_REQUEST]: {
    title: '평가를 남겨주세요',
    body: (d) =>
      `"${d.jobTitle}" 근무가 완료되었습니다. ${d.revieweeName}님에 대한 평가를 남겨주세요.`,
    link: (d) => `/reviews/${d.workLogId}`,
    icon: '📝',
  },

  [NotificationType.REVIEW_RECEIVED]: {
    title: '새로운 평가 도착',
    body: (d) =>
      `"${d.jobTitle}" 근무에 대한 평가가 도착했습니다. 내 평가를 작성하면 확인할 수 있습니다.`,
    link: (d) => `/reviews/${d.workLogId}`,
    icon: '⭐',
  },

  [NotificationType.REVIEW_REMINDER]: {
    title: '평가 마감 임박',
    body: (d) => `"${d.jobTitle}" 근무 평가 마감까지 2일 남았습니다.`,
    link: (d) => `/reviews/${d.workLogId}`,
    icon: '⏰',
  },

  // 워크스페이스 협업 (PR #2)
  [NotificationType.WORKSPACE_INVITATION]: {
    title: (d) => `${d.inviterName ?? '누군가'}님이 워크스페이스에 초대했어요`,
    body: (d) => `${d.workspaceName ?? '워크스페이스'} · 편집자 권한`,
    link: () => `/workspace/invitations`,
    icon: '🤝',
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
