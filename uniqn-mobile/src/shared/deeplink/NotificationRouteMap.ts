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

  // ⚠️ 레거시 2종은 반드시 **0 파라미터**로 둔다. 이 값들은 스태프(link '/schedule/{id}')와
  //    구인자(link '/jobs/{id}')에게 같은 타입으로 발송됐던 기간의 이력이라 타입만으로는
  //    방향을 알 수 없다. 파라미터를 실으면 deepLinkNavigationExecutor 의 "더 구체적인 쪽"
  //    비교에서 스태프 수신분이 매핑에 끌려가 엉뚱한 화면으로 간다.
  //    0 이면 양쪽 모두 각자의 DB link 대로 착지한다.
  [NotificationType.WORK_LOG_CHECK_IN]: () => ({ name: 'schedule' }),
  [NotificationType.WORK_LOG_CHECK_OUT]: () => ({ name: 'schedule' }),

  [NotificationType.SETTLEMENT_COMPLETED]: () => ({ name: 'schedule' }),
  [NotificationType.SETTLEMENT_REVERTED]: () => ({ name: 'schedule' }),

  [NotificationType.JOB_UPDATED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },
  [NotificationType.JOB_CANCELLED]: () => ({ name: 'schedule' }),
  [NotificationType.JOB_CLOSED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },
  [NotificationType.FIXED_POSTING_EXPIRED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },
  [NotificationType.WORK_DATE_EXPIRED]: (data) =>
    data?.jobPostingId ? { name: 'job', params: { id: data.jobPostingId } } : { name: 'jobs' },

  // 트리거가 심는 link 와 같은 목적지로 맞춘다(added='/my-postings/{id}', removed='/my-postings').
  // 제외 알림에는 jobPostingId 가 data 에만 있고 link 에는 없다 — 이미 권한을 잃은 공고
  // 상세로 보내면 접근 거부를 만나므로 목록으로 되돌린다.
  [NotificationType.JOB_POSTING_COLLABORATOR_ADDED]: (data) =>
    data?.jobPostingId
      ? { name: 'employer/posting', params: { id: data.jobPostingId } }
      : { name: 'employer/my-postings' },
  [NotificationType.JOB_POSTING_COLLABORATOR_REMOVED]: () => ({ name: 'employer/my-postings' }),

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

  // ops (라이브 운영 대회) — ops 결함⑦-1.
  // 🔴 의도적으로 알림함에 머문다(선례: REPORT_RESOLVED). ops 화면으로 보내면 안 된다 —
  //    is_ops_member(마이그 baseline:3543)는 대회 owner 와 연결 공고 workspace 멤버만
  //    멤버로 보고 ops_staff 는 포함하지 않는다. 수동 추가된 스태프는 ops_tournaments 조차
  //    SELECT 하지 못하므로 어떤 ops 라우트로 보내도 RLS 가 막는 빈 화면에 도착한다.
  //    /schedule 도 목적지가 아니다 — source='manual' 스태프는 work_log 가 0건이다.
  //    배정 정보는 알림 본문이 전부 싣는다(대회명·담당·날짜·장소).
  [NotificationType.OPS_STAFF_ASSIGNED]: () => ({ name: 'notifications' }),
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
    NotificationType.CANCELLATION_REQUESTED,
  ];

  return employerTypes.includes(type);
}
