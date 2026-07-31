import { NotificationType } from '@/types/notification';
import type { DeepLinkRoute } from './types';

export const NOTIFICATION_ROUTE_MAP: Record<
  NotificationType,
  (data?: Record<string, string>) => DeepLinkRoute
> = {
  [NotificationType.NEW_APPLICATION]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/applicants', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },
  [NotificationType.APPLICATION_CANCELLED]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/applicants', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },
  [NotificationType.APPLICATION_CONFIRMED]: (data) =>
    data?.applicationId
      ? { name: 'schedule', params: { applicationId: data.applicationId } }
      : { name: 'schedule' },
  [NotificationType.CONFIRMATION_CANCELLED]: (data) =>
    data?.applicationId
      ? { name: 'schedule', params: { applicationId: data.applicationId } }
      : { name: 'schedule' },
  [NotificationType.APPLICATION_REJECTED]: (data) =>
    data?.applicationId
      ? { name: 'schedule', params: { applicationId: data.applicationId } }
      : { name: 'schedule' },
  [NotificationType.CANCELLATION_APPROVED]: (data) =>
    data?.applicationId
      ? { name: 'schedule', params: { applicationId: data.applicationId } }
      : { name: 'schedule' },
  [NotificationType.CANCELLATION_REJECTED]: (data) =>
    data?.applicationId
      ? { name: 'schedule', params: { applicationId: data.applicationId } }
      : { name: 'schedule' },
  [NotificationType.CANCELLATION_REQUESTED]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/cancellation-requests', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },

  [NotificationType.STAFF_CHECKED_IN]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/applicants', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },
  [NotificationType.STAFF_CHECKED_OUT]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/applicants', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },
  [NotificationType.CHECK_IN_CONFIRMED]: () => ({ name: 'schedule' }),
  [NotificationType.CHECK_OUT_CONFIRMED]: () => ({ name: 'schedule' }),
  [NotificationType.CHECKIN_REMINDER]: () => ({ name: 'schedule' }),
  [NotificationType.NO_SHOW_ALERT]: () => ({ name: 'schedule' }),
  // 출근 예정 시각 변경(트리거 Case 2-B)은 applicationId 를 실어 보낸다. 스케줄 상세 모달로
  // 정밀 착지해야 그 화면의 '취소 요청' 버튼에 바로 닿는다 — 무음 변경 금지의 짝은 거부 경로다.
  [NotificationType.SCHEDULE_CHANGE]: (data) =>
    data?.applicationId
      ? { name: 'schedule', params: { applicationId: data.applicationId } }
      : { name: 'schedule' },
  [NotificationType.SCHEDULE_CREATED]: () => ({ name: 'schedule' }),
  [NotificationType.SCHEDULE_CANCELLED]: () => ({ name: 'schedule' }),

  [NotificationType.SETTLEMENT_COMPLETED]: () => ({ name: 'schedule' }),
  [NotificationType.SETTLEMENT_REQUESTED]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/settlement', params: { jobId: data.jobPostingId } }
      : { name: 'employer/my-postings' },

  [NotificationType.JOB_UPDATED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },
  [NotificationType.JOB_CANCELLED]: () => ({ name: 'schedule' }),
  [NotificationType.JOB_CLOSED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },
  [NotificationType.FIXED_POSTING_EXPIRED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },
  [NotificationType.WORK_DATE_EXPIRED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },

  [NotificationType.ANNOUNCEMENT]: (data) =>
    data?.announcementId
      ? { name: 'notice', params: { id: data.announcementId } }
      : { name: 'notices' },
  [NotificationType.MAINTENANCE]: () => ({ name: 'notices' }),
  [NotificationType.APP_UPDATE]: () => ({ name: 'settings' }),
  [NotificationType.BOARD_COMMENT]: (data) =>
    data?.postId ? { name: 'board/post', params: { postId: data.postId } } : { name: 'board' },
  [NotificationType.BOARD_REPLY]: (data) =>
    data?.postId ? { name: 'board/post', params: { postId: data.postId } } : { name: 'board' },
  [NotificationType.BOARD_MENTION]: (data) =>
    data?.postId ? { name: 'board/post', params: { postId: data.postId } } : { name: 'board' },
  [NotificationType.BOARD_LOCKED]: (data) =>
    data?.postId ? { name: 'board/post', params: { postId: data.postId } } : { name: 'board' },

  [NotificationType.INQUIRY_ANSWERED]: (data) =>
    data?.inquiryId
      ? { name: 'support/inquiry', params: { id: data.inquiryId } }
      : { name: 'support/my-inquiries' },
  [NotificationType.REPORT_RESOLVED]: () => ({ name: 'notifications' }),
  [NotificationType.NEW_REPORT]: (data) =>
    data?.reportId
      ? { name: 'admin/report', params: { id: data.reportId } }
      : { name: 'admin/reports' },
  [NotificationType.NEW_INQUIRY]: (data) =>
    data?.inquiryId
      ? { name: 'admin/inquiry', params: { id: data.inquiryId } }
      : { name: 'admin/inquiries' },
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: () => ({ name: 'admin/tournaments' }),
  [NotificationType.NEGATIVE_SETTLEMENT_ALERT]: () => ({ name: 'admin/dashboard' }),
  [NotificationType.EMPLOYER_APP_SUBMITTED]: () => ({ name: 'employer-application-status' }),
  [NotificationType.EMPLOYER_APP_APPROVED]: () => ({ name: 'employer-application-status' }),
  [NotificationType.EMPLOYER_APP_REJECTED]: () => ({ name: 'employer-application-status' }),
  [NotificationType.NEW_EMPLOYER_APPLICATION]: (data) =>
    data?.applicationId
      ? { name: 'admin/employer-application', params: { id: data.applicationId } }
      : { name: 'admin/employer-applications' },
  // 설정 화면에는 역할이 어디에도 표기되지 않는다 — 무엇이 바뀌었는지 확인할 수 없는
  // 도착지였다. 역할 배지는 프로필 탭 헤더에 있다(app/(app)/(tabs)/profile.tsx).
  // ⚠️ DB RPC(update_user_role)는 여전히 link='/settings' 를 심는다. 이미 발송된 알림은
  //    되돌릴 수 없으므로 getRouteFromNotification 의 ROUTE_MAP_PRIORITY_TYPES 가
  //    이 타입만은 link 보다 이 매핑을 우선하도록 흡수한다.
  [NotificationType.ROLE_CHANGED]: () => ({ name: 'profile' }),

  [NotificationType.REVIEW_REQUEST]: () => ({ name: 'reviews/pending' }),
  [NotificationType.REVIEW_RECEIVED]: () => ({ name: 'reviews/pending' }),
  [NotificationType.REVIEW_REMINDER]: () => ({ name: 'reviews/pending' }),

  // 워크스페이스 협업 (PR #2)
  [NotificationType.WORKSPACE_INVITATION]: (data): DeepLinkRoute =>
    data?.invitationId
      ? { name: 'workspace/invitations', params: { invitationId: data.invitationId } }
      : { name: 'workspace/invitations' },
};

export function getRouteForNotificationType(
  type: NotificationType,
  data?: Record<string, string>
): DeepLinkRoute {
  return NOTIFICATION_ROUTE_MAP[type](data);
}

export function isAdminOnlyNotification(type: NotificationType): boolean {
  const adminTypes: NotificationType[] = [
    NotificationType.NEW_REPORT,
    NotificationType.NEW_INQUIRY,
    NotificationType.TOURNAMENT_APPROVAL_REQUEST,
    NotificationType.NEGATIVE_SETTLEMENT_ALERT,
    NotificationType.NEW_EMPLOYER_APPLICATION,
  ];

  return adminTypes.includes(type);
}

export function isEmployerOnlyNotification(type: NotificationType): boolean {
  const employerTypes: NotificationType[] = [
    NotificationType.NEW_APPLICATION,
    NotificationType.APPLICATION_CANCELLED,
    NotificationType.STAFF_CHECKED_IN,
    NotificationType.STAFF_CHECKED_OUT,
    NotificationType.SETTLEMENT_REQUESTED,
    NotificationType.CANCELLATION_REQUESTED,
  ];

  return employerTypes.includes(type);
}
