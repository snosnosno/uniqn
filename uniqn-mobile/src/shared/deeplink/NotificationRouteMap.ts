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
  [NotificationType.APPLICATION_CONFIRMED]: () => ({ name: 'schedule' }),
  [NotificationType.CONFIRMATION_CANCELLED]: () => ({ name: 'schedule' }),
  [NotificationType.APPLICATION_REJECTED]: () => ({ name: 'schedule' }),
  [NotificationType.CANCELLATION_APPROVED]: () => ({ name: 'schedule' }),
  [NotificationType.CANCELLATION_REJECTED]: () => ({ name: 'schedule' }),

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
  [NotificationType.SCHEDULE_CHANGE]: () => ({ name: 'schedule' }),
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

  [NotificationType.ANNOUNCEMENT]: (data) =>
    data?.announcementId
      ? { name: 'notice', params: { id: data.announcementId } }
      : { name: 'notices' },
  [NotificationType.MAINTENANCE]: () => ({ name: 'notices' }),
  [NotificationType.APP_UPDATE]: () => ({ name: 'settings' }),

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

  [NotificationType.REVIEW_REQUEST]: (data) =>
    data?.workLogId
      ? { name: 'reviews/detail', params: { workLogId: data.workLogId } }
      : { name: 'reviews/pending' },
  [NotificationType.REVIEW_RECEIVED]: (data) =>
    data?.workLogId
      ? { name: 'reviews/detail', params: { workLogId: data.workLogId } }
      : { name: 'schedule' },
  [NotificationType.REVIEW_REMINDER]: (data) =>
    data?.workLogId
      ? { name: 'reviews/detail', params: { workLogId: data.workLogId } }
      : { name: 'reviews/pending' },
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
  ];

  return employerTypes.includes(type);
}
