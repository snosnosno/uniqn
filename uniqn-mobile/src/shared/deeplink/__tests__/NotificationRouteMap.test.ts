import { NotificationType } from '@/types/notification';
import {
  NOTIFICATION_ROUTE_MAP,
  getRouteForNotificationType,
  isAdminOnlyNotification,
  isEmployerOnlyNotification,
} from '../NotificationRouteMap';

describe('NotificationRouteMap', () => {
  it('covers every NotificationType', () => {
    const allNotificationTypes = Object.values(NotificationType) as NotificationType[];

    expect(allNotificationTypes.length).toBe(37);

    allNotificationTypes.forEach((type) => {
      expect(NOTIFICATION_ROUTE_MAP[type]).toBeDefined();
      expect(typeof NOTIFICATION_ROUTE_MAP[type]).toBe('function');

      const route = NOTIFICATION_ROUTE_MAP[type]();
      expect(route).toBeDefined();
      expect(typeof route.name).toBe('string');
    });
  });

  it('maps employer-facing application events to employer routes', () => {
    const applied = NOTIFICATION_ROUTE_MAP[NotificationType.NEW_APPLICATION]({
      jobPostingId: 'job-123',
    });
    const cancelled = NOTIFICATION_ROUTE_MAP[NotificationType.APPLICATION_CANCELLED]({
      jobPostingId: 'job-123',
    });

    expect(applied).toEqual({ name: 'employer/applicants', params: { jobId: 'job-123' } });
    expect(cancelled).toEqual({ name: 'employer/applicants', params: { jobId: 'job-123' } });
  });

  it('falls back employer application events to the employer root when ids are missing', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.NEW_APPLICATION]()).toEqual({
      name: 'employer/my-postings',
    });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.SETTLEMENT_REQUESTED]()).toEqual({
      name: 'employer/my-postings',
    });
  });

  it('keeps schedule-based staff events on the schedule screen', () => {
    const scheduleTypes = [
      NotificationType.APPLICATION_CONFIRMED,
      NotificationType.CONFIRMATION_CANCELLED,
      NotificationType.APPLICATION_REJECTED,
      NotificationType.CANCELLATION_APPROVED,
      NotificationType.CANCELLATION_REJECTED,
      NotificationType.CHECK_IN_CONFIRMED,
      NotificationType.CHECK_OUT_CONFIRMED,
      NotificationType.CHECKIN_REMINDER,
      NotificationType.NO_SHOW_ALERT,
      NotificationType.SCHEDULE_CHANGE,
      NotificationType.SCHEDULE_CREATED,
      NotificationType.SCHEDULE_CANCELLED,
      NotificationType.SETTLEMENT_COMPLETED,
    ] as const;

    scheduleTypes.forEach((type) => {
      expect(NOTIFICATION_ROUTE_MAP[type]()).toEqual({ name: 'schedule' });
    });
  });

  it('maps job events to the public job detail or jobs list', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.JOB_UPDATED]({ jobPostingId: 'job-1' })).toEqual(
      { name: 'job', params: { id: 'job-1' } }
    );
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.JOB_CLOSED]()).toEqual({ name: 'jobs' });
  });

  it('routes announcement notifications to notices and notice detail', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.ANNOUNCEMENT]()).toEqual({ name: 'notices' });
    expect(
      NOTIFICATION_ROUTE_MAP[NotificationType.ANNOUNCEMENT]({ announcementId: 'notice-123' })
    ).toEqual({
      name: 'notice',
      params: { id: 'notice-123' },
    });
  });

  it('routes maintenance and app update notifications to real screens', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.MAINTENANCE]()).toEqual({ name: 'notices' });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.APP_UPDATE]()).toEqual({ name: 'settings' });
  });

  it('routes board activity notifications to the board surface or exact post', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.BOARD_COMMENT]()).toEqual({ name: 'board' });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.BOARD_REPLY]()).toEqual({ name: 'board' });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.BOARD_MENTION]()).toEqual({ name: 'board' });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.BOARD_LOCKED]()).toEqual({ name: 'board' });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.BOARD_COMMENT]({ postId: 'post-1' })).toEqual({
      name: 'board/post',
      params: { postId: 'post-1' },
    });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.BOARD_MENTION]({ postId: 'post-2' })).toEqual({
      name: 'board/post',
      params: { postId: 'post-2' },
    });
  });

  it('routes answered inquiries to my inquiries or the exact inquiry detail', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.INQUIRY_ANSWERED]()).toEqual({
      name: 'support/my-inquiries',
    });
    expect(
      NOTIFICATION_ROUTE_MAP[NotificationType.INQUIRY_ANSWERED]({ inquiryId: 'inq-123' })
    ).toEqual({
      name: 'support/inquiry',
      params: { id: 'inq-123' },
    });
  });

  it('keeps report resolved notifications on an existing fallback screen', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.REPORT_RESOLVED]()).toEqual({
      name: 'notifications',
    });
  });

  it('maps admin routes to canonical admin detail screens', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.NEW_REPORT]({ reportId: 'report-1' })).toEqual({
      name: 'admin/report',
      params: { id: 'report-1' },
    });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.NEW_INQUIRY]({ inquiryId: 'inq-1' })).toEqual({
      name: 'admin/inquiry',
      params: { id: 'inq-1' },
    });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.TOURNAMENT_APPROVAL_REQUEST]()).toEqual({
      name: 'admin/tournaments',
    });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.NEGATIVE_SETTLEMENT_ALERT]()).toEqual({
      name: 'admin/dashboard',
    });
  });

  it('maps review notifications to review detail or pending', () => {
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.REVIEW_REQUEST]({ workLogId: 'wl-1' })).toEqual({
      name: 'reviews/detail',
      params: { workLogId: 'wl-1' },
    });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.REVIEW_REQUEST]()).toEqual({
      name: 'reviews/pending',
    });
    expect(NOTIFICATION_ROUTE_MAP[NotificationType.REVIEW_RECEIVED]()).toEqual({
      name: 'schedule',
    });
  });

  it('returns routes through the helper', () => {
    expect(
      getRouteForNotificationType(NotificationType.NEW_APPLICATION, {
        jobPostingId: 'job-1',
      })
    ).toEqual({
      name: 'employer/applicants',
      params: { jobId: 'job-1' },
    });
  });

  it('identifies admin-only notification types', () => {
    expect(isAdminOnlyNotification(NotificationType.NEW_REPORT)).toBe(true);
    expect(isAdminOnlyNotification(NotificationType.NEW_INQUIRY)).toBe(true);
    expect(isAdminOnlyNotification(NotificationType.TOURNAMENT_APPROVAL_REQUEST)).toBe(true);
    expect(isAdminOnlyNotification(NotificationType.NEGATIVE_SETTLEMENT_ALERT)).toBe(true);
    expect(isAdminOnlyNotification(NotificationType.ANNOUNCEMENT)).toBe(false);
  });

  it('identifies employer-only notification types', () => {
    expect(isEmployerOnlyNotification(NotificationType.NEW_APPLICATION)).toBe(true);
    expect(isEmployerOnlyNotification(NotificationType.APPLICATION_CANCELLED)).toBe(true);
    expect(isEmployerOnlyNotification(NotificationType.STAFF_CHECKED_IN)).toBe(true);
    expect(isEmployerOnlyNotification(NotificationType.STAFF_CHECKED_OUT)).toBe(true);
    expect(isEmployerOnlyNotification(NotificationType.SETTLEMENT_REQUESTED)).toBe(true);
    expect(isEmployerOnlyNotification(NotificationType.APP_UPDATE)).toBe(false);
  });
});
