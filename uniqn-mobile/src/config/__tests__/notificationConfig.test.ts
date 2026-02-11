/**
 * UNIQN Mobile - notificationConfig Tests
 *
 * @description Tests for notification configuration utilities
 */

import {
  getNotificationConfig,
  generateDeepLink,
  isValidNotificationType,
  parseNotificationType,
  getFCMOptions,
  NOTIFICATION_CONFIG_MAP,
} from '../notificationConfig';
import {
  NotificationType,
  NotificationCategory,
  AndroidChannelId,
  NOTIFICATION_TYPE_TO_CATEGORY,
  NOTIFICATION_DEFAULT_PRIORITY,
  NOTIFICATION_TYPE_TO_CHANNEL,
  NOTIFICATION_TYPE_LABELS,
} from '@/types/notification';

describe('notificationConfig', () => {
  // ============================================================================
  // getNotificationConfig
  // ============================================================================

  describe('getNotificationConfig', () => {
    it('should return correct config for NEW_APPLICATION', () => {
      const config = getNotificationConfig(NotificationType.NEW_APPLICATION);

      expect(config.type).toBe(NotificationType.NEW_APPLICATION);
      expect(config.category).toBe(NotificationCategory.APPLICATION);
      expect(config.priority).toBe('high');
      expect(config.channelId).toBe(AndroidChannelId.APPLICATIONS);
      expect(config.label).toBe(NOTIFICATION_TYPE_LABELS[NotificationType.NEW_APPLICATION]);
      expect(typeof config.generateLink).toBe('function');
    });

    it('should return correct config for CHECKIN_REMINDER (urgent priority)', () => {
      const config = getNotificationConfig(NotificationType.CHECKIN_REMINDER);

      expect(config.type).toBe(NotificationType.CHECKIN_REMINDER);
      expect(config.category).toBe(NotificationCategory.ATTENDANCE);
      expect(config.priority).toBe('urgent');
      expect(config.channelId).toBe(AndroidChannelId.REMINDERS);
    });

    it('should return correct config for SETTLEMENT_COMPLETED', () => {
      const config = getNotificationConfig(NotificationType.SETTLEMENT_COMPLETED);

      expect(config.type).toBe(NotificationType.SETTLEMENT_COMPLETED);
      expect(config.category).toBe(NotificationCategory.SETTLEMENT);
      expect(config.channelId).toBe(AndroidChannelId.SETTLEMENT);
    });

    it('should return correct config for ANNOUNCEMENT (system)', () => {
      const config = getNotificationConfig(NotificationType.ANNOUNCEMENT);

      expect(config.type).toBe(NotificationType.ANNOUNCEMENT);
      expect(config.category).toBe(NotificationCategory.SYSTEM);
      expect(config.channelId).toBe(AndroidChannelId.ANNOUNCEMENTS);
    });

    it('should return correct config for NEW_REPORT (admin)', () => {
      const config = getNotificationConfig(NotificationType.NEW_REPORT);

      expect(config.type).toBe(NotificationType.NEW_REPORT);
      expect(config.category).toBe(NotificationCategory.ADMIN);
      expect(config.priority).toBe('high');
    });

    it('should match mappings from notification types', () => {
      const allTypes = Object.values(NotificationType);

      allTypes.forEach((type) => {
        if (typeof type !== 'string') return;
        const config = getNotificationConfig(type as NotificationType);

        expect(config.category).toBe(NOTIFICATION_TYPE_TO_CATEGORY[type as NotificationType]);
        expect(config.priority).toBe(NOTIFICATION_DEFAULT_PRIORITY[type as NotificationType]);
        expect(config.channelId).toBe(NOTIFICATION_TYPE_TO_CHANNEL[type as NotificationType]);
        expect(config.label).toBe(NOTIFICATION_TYPE_LABELS[type as NotificationType]);
      });
    });
  });

  // ============================================================================
  // generateDeepLink - Application-related
  // ============================================================================

  describe('generateDeepLink', () => {
    describe('application-related types', () => {
      it('should generate link for NEW_APPLICATION with data', () => {
        const link = generateDeepLink(NotificationType.NEW_APPLICATION, {
          applicationId: 'app123',
          jobPostingId: 'job456',
        });
        expect(link).toBe('/employer/applicants/job456');
      });

      it('should fallback for NEW_APPLICATION without full data', () => {
        const link = generateDeepLink(NotificationType.NEW_APPLICATION, {});
        expect(link).toBe('/employer/my-postings');
      });

      it('should fallback for NEW_APPLICATION with only applicationId', () => {
        const link = generateDeepLink(NotificationType.NEW_APPLICATION, {
          applicationId: 'app123',
        });
        expect(link).toBe('/employer/my-postings');
      });

      it('should generate link for APPLICATION_CANCELLED with jobPostingId', () => {
        const link = generateDeepLink(NotificationType.APPLICATION_CANCELLED, {
          jobPostingId: 'job456',
        });
        expect(link).toBe('/employer/applicants/job456');
      });

      it('should fallback for APPLICATION_CANCELLED without data', () => {
        const link = generateDeepLink(NotificationType.APPLICATION_CANCELLED);
        expect(link).toBe('/employer/my-postings');
      });

      it('should generate link for APPLICATION_CONFIRMED with applicationId', () => {
        const link = generateDeepLink(NotificationType.APPLICATION_CONFIRMED, {
          applicationId: 'app123',
        });
        expect(link).toBe('/applications/app123');
      });

      it('should fallback for APPLICATION_CONFIRMED without data', () => {
        const link = generateDeepLink(NotificationType.APPLICATION_CONFIRMED);
        expect(link).toBe('/my-applications');
      });

      it('should generate link for CONFIRMATION_CANCELLED', () => {
        const link = generateDeepLink(NotificationType.CONFIRMATION_CANCELLED, {
          applicationId: 'app123',
        });
        expect(link).toBe('/applications/app123');
      });

      it('should generate link for APPLICATION_REJECTED', () => {
        const link = generateDeepLink(NotificationType.APPLICATION_REJECTED, {
          applicationId: 'app123',
        });
        expect(link).toBe('/applications/app123');
      });

      it('should generate link for CANCELLATION_APPROVED', () => {
        const link = generateDeepLink(NotificationType.CANCELLATION_APPROVED, {
          applicationId: 'app123',
        });
        expect(link).toBe('/applications/app123');
      });

      it('should fallback for CANCELLATION_APPROVED without data', () => {
        const link = generateDeepLink(NotificationType.CANCELLATION_APPROVED);
        expect(link).toBe('/schedule');
      });

      it('should generate link for CANCELLATION_REJECTED', () => {
        const link = generateDeepLink(NotificationType.CANCELLATION_REJECTED, {
          applicationId: 'app123',
        });
        expect(link).toBe('/applications/app123');
      });
    });

    describe('attendance/schedule-related types', () => {
      it('should generate link for STAFF_CHECKED_IN with jobPostingId', () => {
        const link = generateDeepLink(NotificationType.STAFF_CHECKED_IN, {
          jobPostingId: 'job456',
        });
        expect(link).toBe('/employer/applicants/job456');
      });

      it('should generate link for CHECK_IN_CONFIRMED with date', () => {
        const link = generateDeepLink(NotificationType.CHECK_IN_CONFIRMED, {
          date: '2024-03-15',
        });
        expect(link).toBe('/schedule/2024-03-15');
      });

      it('should fallback for CHECK_IN_CONFIRMED without date', () => {
        const link = generateDeepLink(NotificationType.CHECK_IN_CONFIRMED);
        expect(link).toBe('/schedule');
      });

      it('should generate link for CHECKIN_REMINDER with date', () => {
        const link = generateDeepLink(NotificationType.CHECKIN_REMINDER, {
          date: '2024-03-15',
        });
        expect(link).toBe('/schedule/2024-03-15');
      });

      it('should generate link for NO_SHOW_ALERT with date', () => {
        const link = generateDeepLink(NotificationType.NO_SHOW_ALERT, {
          date: '2024-03-15',
        });
        expect(link).toBe('/schedule/2024-03-15');
      });

      it('should generate link for SCHEDULE_CHANGE with date', () => {
        const link = generateDeepLink(NotificationType.SCHEDULE_CHANGE, {
          date: '2024-03-15',
        });
        expect(link).toBe('/schedule/2024-03-15');
      });

      it('should generate link for SCHEDULE_CREATED with date', () => {
        const link = generateDeepLink(NotificationType.SCHEDULE_CREATED, {
          date: '2024-03-15',
        });
        expect(link).toBe('/schedule/2024-03-15');
      });

      it('should generate link for SCHEDULE_CANCELLED with date', () => {
        const link = generateDeepLink(NotificationType.SCHEDULE_CANCELLED, {
          date: '2024-03-15',
        });
        expect(link).toBe('/schedule/2024-03-15');
      });
    });

    describe('settlement-related types', () => {
      it('should generate static link for SETTLEMENT_COMPLETED', () => {
        const link = generateDeepLink(NotificationType.SETTLEMENT_COMPLETED);
        expect(link).toBe('/schedule');
      });

      it('should generate link for SETTLEMENT_REQUESTED with jobPostingId', () => {
        const link = generateDeepLink(NotificationType.SETTLEMENT_REQUESTED, {
          jobPostingId: 'job456',
        });
        expect(link).toBe('/employer/settlement/job456');
      });

      it('should fallback for SETTLEMENT_REQUESTED without data', () => {
        const link = generateDeepLink(NotificationType.SETTLEMENT_REQUESTED);
        expect(link).toBe('/employer/my-postings');
      });
    });

    describe('job-related types', () => {
      it('should generate link for JOB_UPDATED with jobPostingId', () => {
        const link = generateDeepLink(NotificationType.JOB_UPDATED, {
          jobPostingId: 'job456',
        });
        expect(link).toBe('/jobs/job456');
      });

      it('should fallback for JOB_UPDATED without data', () => {
        const link = generateDeepLink(NotificationType.JOB_UPDATED);
        expect(link).toBe('/jobs');
      });

      it('should generate static link for JOB_CANCELLED', () => {
        const link = generateDeepLink(NotificationType.JOB_CANCELLED);
        expect(link).toBe('/my-applications');
      });

      it('should generate static link for JOB_CLOSED', () => {
        const link = generateDeepLink(NotificationType.JOB_CLOSED);
        expect(link).toBe('/my-applications');
      });
    });

    describe('system types', () => {
      it('should generate static link for ANNOUNCEMENT', () => {
        const link = generateDeepLink(NotificationType.ANNOUNCEMENT);
        expect(link).toBe('/notifications');
      });

      it('should generate static link for MAINTENANCE', () => {
        const link = generateDeepLink(NotificationType.MAINTENANCE);
        expect(link).toBe('/notifications');
      });

      it('should generate static link for APP_UPDATE', () => {
        const link = generateDeepLink(NotificationType.APP_UPDATE);
        expect(link).toBe('/notifications');
      });
    });

    describe('admin types', () => {
      it('should generate static link for INQUIRY_ANSWERED', () => {
        const link = generateDeepLink(NotificationType.INQUIRY_ANSWERED);
        expect(link).toBe('/support/inquiries');
      });

      it('should generate static link for REPORT_RESOLVED', () => {
        const link = generateDeepLink(NotificationType.REPORT_RESOLVED);
        expect(link).toBe('/notifications');
      });

      it('should generate link for NEW_REPORT with applicationId', () => {
        const link = generateDeepLink(NotificationType.NEW_REPORT, {
          applicationId: 'report123',
        });
        expect(link).toBe('/admin/reports/report123');
      });

      it('should fallback for NEW_REPORT without data', () => {
        const link = generateDeepLink(NotificationType.NEW_REPORT);
        expect(link).toBe('/admin/reports');
      });

      it('should generate link for NEW_INQUIRY with applicationId', () => {
        const link = generateDeepLink(NotificationType.NEW_INQUIRY, {
          applicationId: 'inq123',
        });
        expect(link).toBe('/admin/inquiries/inq123');
      });

      it('should generate link for TOURNAMENT_APPROVAL_REQUEST with jobPostingId', () => {
        const link = generateDeepLink(NotificationType.TOURNAMENT_APPROVAL_REQUEST, {
          jobPostingId: 'tournament789',
        });
        expect(link).toBe('/admin/tournaments/tournament789');
      });

      it('should fallback for TOURNAMENT_APPROVAL_REQUEST without data', () => {
        const link = generateDeepLink(NotificationType.TOURNAMENT_APPROVAL_REQUEST);
        expect(link).toBe('/admin/tournaments');
      });
    });
  });

  // ============================================================================
  // NOTIFICATION_CONFIG_MAP
  // ============================================================================

  describe('NOTIFICATION_CONFIG_MAP', () => {
    it('should contain an entry for every NotificationType', () => {
      const allTypes = Object.values(NotificationType).filter(
        (v) => typeof v === 'string'
      ) as NotificationType[];

      allTypes.forEach((type) => {
        expect(NOTIFICATION_CONFIG_MAP[type]).toBeDefined();
        expect(NOTIFICATION_CONFIG_MAP[type].type).toBe(type);
      });
    });

    it('should have generateLink function for every entry', () => {
      const allTypes = Object.values(NotificationType).filter(
        (v) => typeof v === 'string'
      ) as NotificationType[];

      allTypes.forEach((type) => {
        expect(typeof NOTIFICATION_CONFIG_MAP[type].generateLink).toBe('function');
      });
    });
  });

  // ============================================================================
  // isValidNotificationType
  // ============================================================================

  describe('isValidNotificationType', () => {
    it('should return true for valid notification types', () => {
      expect(isValidNotificationType('new_application')).toBe(true);
      expect(isValidNotificationType('application_confirmed')).toBe(true);
      expect(isValidNotificationType('settlement_completed')).toBe(true);
      expect(isValidNotificationType('announcement')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidNotificationType('invalid_type')).toBe(false);
      expect(isValidNotificationType('')).toBe(false);
      expect(isValidNotificationType('NEW_APPLICATION')).toBe(false); // case-sensitive
      expect(isValidNotificationType('random_string')).toBe(false);
    });
  });

  // ============================================================================
  // parseNotificationType
  // ============================================================================

  describe('parseNotificationType', () => {
    it('should return the type for valid notification types', () => {
      expect(parseNotificationType('new_application')).toBe('new_application');
      expect(parseNotificationType('announcement')).toBe('announcement');
    });

    it('should return null for invalid types', () => {
      expect(parseNotificationType('invalid')).toBeNull();
      expect(parseNotificationType('UPPERCASE')).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(parseNotificationType(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseNotificationType('')).toBeNull();
    });
  });

  // ============================================================================
  // getFCMOptions
  // ============================================================================

  describe('getFCMOptions', () => {
    it('should return high priority for urgent notifications', () => {
      const options = getFCMOptions(NotificationType.CHECKIN_REMINDER);
      expect(options.priority).toBe('high');
      expect(options.channelId).toBe(AndroidChannelId.REMINDERS);
    });

    it('should return high priority for high priority notifications', () => {
      const options = getFCMOptions(NotificationType.NEW_APPLICATION);
      expect(options.priority).toBe('high');
      expect(options.channelId).toBe(AndroidChannelId.APPLICATIONS);
    });

    it('should return normal priority for normal notifications', () => {
      const options = getFCMOptions(NotificationType.APPLICATION_CANCELLED);
      expect(options.priority).toBe('normal');
    });

    it('should return normal priority for low priority notifications', () => {
      const options = getFCMOptions(NotificationType.JOB_UPDATED);
      expect(options.priority).toBe('normal');
    });

    it('should return correct channelId for each category', () => {
      expect(getFCMOptions(NotificationType.SETTLEMENT_COMPLETED).channelId).toBe(
        AndroidChannelId.SETTLEMENT
      );
      expect(getFCMOptions(NotificationType.ANNOUNCEMENT).channelId).toBe(
        AndroidChannelId.ANNOUNCEMENTS
      );
      expect(getFCMOptions(NotificationType.STAFF_CHECKED_IN).channelId).toBe(
        AndroidChannelId.REMINDERS
      );
    });
  });
});
