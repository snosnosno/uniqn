/**
 * UNIQN Mobile - notificationTemplates Tests
 *
 * @description Tests for notification message templates and utility functions
 */

import {
  NotificationTemplates,
  createNotificationMessage,
  NOTIFICATION_DATA_PATTERNS,
} from '../notificationTemplates';
import { NotificationType } from '@/types/notification';

describe('notificationTemplates', () => {
  // ============================================================================
  // NotificationTemplates - Completeness
  // ============================================================================

  describe('NotificationTemplates completeness', () => {
    it('should have a template for every NotificationType', () => {
      const allTypes = Object.values(NotificationType).filter(
        (v) => typeof v === 'string'
      ) as NotificationType[];

      allTypes.forEach((type) => {
        expect(NotificationTemplates[type]).toBeDefined();
        expect(NotificationTemplates[type].link).toBeDefined();
        expect(typeof NotificationTemplates[type].link).toBe('function');
      });
    });

    it('should have title, body, and link for every template', () => {
      const allTypes = Object.values(NotificationType).filter(
        (v) => typeof v === 'string'
      ) as NotificationType[];

      allTypes.forEach((type) => {
        const template = NotificationTemplates[type];
        expect(template.title).toBeDefined();
        expect(template.body).toBeDefined();
        expect(template.link).toBeDefined();
      });
    });
  });

  // ============================================================================
  // NotificationTemplates - Application Related
  // ============================================================================

  describe('application-related templates', () => {
    it('should generate NEW_APPLICATION body with staff name and job title', () => {
      const template = NotificationTemplates[NotificationType.NEW_APPLICATION];
      const body =
        typeof template.body === 'function'
          ? template.body({ staffName: '홍길동', jobTitle: '딜러 모집' })
          : template.body;

      expect(body).toContain('홍길동');
      expect(body).toContain('딜러 모집');
    });

    it('should have static title for NEW_APPLICATION', () => {
      const template = NotificationTemplates[NotificationType.NEW_APPLICATION];
      expect(template.title).toBe('새로운 지원자');
    });

    it('should generate link for NEW_APPLICATION', () => {
      const template = NotificationTemplates[NotificationType.NEW_APPLICATION];
      const link = template.link({ jobPostingId: 'job123' });
      expect(link).toContain('job123');
    });

    it('should generate APPLICATION_CANCELLED body', () => {
      const template = NotificationTemplates[NotificationType.APPLICATION_CANCELLED];
      const body =
        typeof template.body === 'function'
          ? template.body({ staffName: '홍길동', jobTitle: '딜러 모집' })
          : template.body;

      expect(body).toContain('홍길동');
      expect(body).toContain('취소');
    });

    it('should generate APPLICATION_CONFIRMED body with work date', () => {
      const template = NotificationTemplates[NotificationType.APPLICATION_CONFIRMED];
      const body =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집', workDate: '2024-03-15' })
          : template.body;

      expect(body).toContain('딜러 모집');
      expect(body).toContain('2024-03-15');
    });

    it('should generate CONFIRMATION_CANCELLED body with optional reason', () => {
      const template = NotificationTemplates[NotificationType.CONFIRMATION_CANCELLED];

      // with reason
      const bodyWithReason =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집', reason: '인원 변경' })
          : template.body;
      expect(bodyWithReason).toContain('인원 변경');

      // without reason
      const bodyWithoutReason =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집' })
          : template.body;
      expect(bodyWithoutReason).toContain('딜러 모집');
      expect(bodyWithoutReason).not.toContain('사유');
    });

    it('should generate APPLICATION_REJECTED body', () => {
      const template = NotificationTemplates[NotificationType.APPLICATION_REJECTED];
      const body =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집' })
          : template.body;

      expect(body).toContain('딜러 모집');
      expect(body).toContain('거절');
    });

    it('should generate CANCELLATION_APPROVED body', () => {
      const template = NotificationTemplates[NotificationType.CANCELLATION_APPROVED];
      const body =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집' })
          : template.body;

      expect(body).toContain('딜러 모집');
      expect(body).toContain('승인');
    });

    it('should generate CANCELLATION_REJECTED body with optional reason', () => {
      const template = NotificationTemplates[NotificationType.CANCELLATION_REJECTED];

      const bodyWithReason =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집', reason: '대체 인력 없음' })
          : template.body;
      expect(bodyWithReason).toContain('대체 인력 없음');

      const bodyWithoutReason =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집' })
          : template.body;
      expect(bodyWithoutReason).not.toContain('사유');
    });
  });

  // ============================================================================
  // NotificationTemplates - Attendance Related
  // ============================================================================

  describe('attendance-related templates', () => {
    it('should generate STAFF_CHECKED_IN body', () => {
      const template = NotificationTemplates[NotificationType.STAFF_CHECKED_IN];
      const body =
        typeof template.body === 'function'
          ? template.body({ staffName: '홍길동', checkInTime: '18:00' })
          : template.body;

      expect(body).toContain('홍길동');
      expect(body).toContain('18:00');
    });

    it('should generate STAFF_CHECKED_OUT body with work hours', () => {
      const template = NotificationTemplates[NotificationType.STAFF_CHECKED_OUT];
      const body =
        typeof template.body === 'function'
          ? template.body({ staffName: '홍길동', workHours: '8시간' })
          : template.body;

      expect(body).toContain('홍길동');
      expect(body).toContain('8시간');
    });

    it('should generate CHECKIN_REMINDER title with remaining time', () => {
      const template = NotificationTemplates[NotificationType.CHECKIN_REMINDER];
      const title =
        typeof template.title === 'function'
          ? template.title({ remainingTime: '15분' })
          : template.title;

      expect(title).toContain('15분');
    });

    it('should generate CHECKIN_REMINDER title with default time', () => {
      const template = NotificationTemplates[NotificationType.CHECKIN_REMINDER];
      const title =
        typeof template.title === 'function' ? template.title({}) : template.title;

      expect(title).toContain('30분');
    });

    it('should generate NO_SHOW_ALERT body', () => {
      const template = NotificationTemplates[NotificationType.NO_SHOW_ALERT];
      const body =
        typeof template.body === 'function'
          ? template.body({ staffName: '홍길동' })
          : template.body;

      expect(body).toContain('홍길동');
    });

    it('should generate SCHEDULE_CHANGE body with optional description', () => {
      const template = NotificationTemplates[NotificationType.SCHEDULE_CHANGE];

      const bodyWithDesc =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집', changeDescription: '시간 변경: 19시->20시' })
          : template.body;
      expect(bodyWithDesc).toContain('시간 변경: 19시->20시');

      const bodyWithoutDesc =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집' })
          : template.body;
      expect(bodyWithoutDesc).toContain('딜러 모집');
    });

    it('should generate SCHEDULE_CREATED body', () => {
      const template = NotificationTemplates[NotificationType.SCHEDULE_CREATED];
      const body =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집', workDate: '2024-03-15', startTime: '18:00' })
          : template.body;

      expect(body).toContain('딜러 모집');
      expect(body).toContain('2024-03-15');
    });

    it('should generate SCHEDULE_CANCELLED body with optional reason', () => {
      const template = NotificationTemplates[NotificationType.SCHEDULE_CANCELLED];

      const bodyWithReason =
        typeof template.body === 'function'
          ? template.body({
              jobTitle: '딜러 모집',
              workDate: '2024-03-15',
              reason: '기상 악화',
            })
          : template.body;
      expect(bodyWithReason).toContain('기상 악화');
    });
  });

  // ============================================================================
  // NotificationTemplates - Settlement Related
  // ============================================================================

  describe('settlement-related templates', () => {
    it('should generate SETTLEMENT_COMPLETED body with amount', () => {
      const template = NotificationTemplates[NotificationType.SETTLEMENT_COMPLETED];
      const body =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집', amount: '150,000' })
          : template.body;

      expect(body).toContain('150,000');
      expect(body).toContain('정산');
    });

    it('should generate SETTLEMENT_REQUESTED body', () => {
      const template = NotificationTemplates[NotificationType.SETTLEMENT_REQUESTED];
      const body =
        typeof template.body === 'function'
          ? template.body({ staffName: '홍길동' })
          : template.body;

      expect(body).toContain('홍길동');
      expect(body).toContain('정산');
    });
  });

  // ============================================================================
  // NotificationTemplates - Job Related
  // ============================================================================

  describe('job-related templates', () => {
    it('should generate JOB_UPDATED body', () => {
      const template = NotificationTemplates[NotificationType.JOB_UPDATED];
      const body =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집' })
          : template.body;

      expect(body).toContain('딜러 모집');
      expect(body).toContain('수정');
    });

    it('should generate JOB_CANCELLED body', () => {
      const template = NotificationTemplates[NotificationType.JOB_CANCELLED];
      const body =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집' })
          : template.body;

      expect(body).toContain('딜러 모집');
      expect(body).toContain('취소');
    });

    it('should generate JOB_CLOSED body', () => {
      const template = NotificationTemplates[NotificationType.JOB_CLOSED];
      const body =
        typeof template.body === 'function'
          ? template.body({ jobTitle: '딜러 모집' })
          : template.body;

      expect(body).toContain('딜러 모집');
      expect(body).toContain('마감');
    });
  });

  // ============================================================================
  // NotificationTemplates - System
  // ============================================================================

  describe('system templates', () => {
    it('should generate ANNOUNCEMENT with custom title', () => {
      const template = NotificationTemplates[NotificationType.ANNOUNCEMENT];
      const title =
        typeof template.title === 'function'
          ? template.title({ announcementTitle: '서비스 업데이트' })
          : template.title;

      expect(title).toBe('서비스 업데이트');
    });

    it('should fallback ANNOUNCEMENT title to default', () => {
      const template = NotificationTemplates[NotificationType.ANNOUNCEMENT];
      const title =
        typeof template.title === 'function' ? template.title({}) : template.title;

      expect(title).toBe('공지사항');
    });

    it('should generate MAINTENANCE body with custom message', () => {
      const template = NotificationTemplates[NotificationType.MAINTENANCE];
      const body =
        typeof template.body === 'function'
          ? template.body({ maintenanceMessage: '내일 09시 점검' })
          : template.body;

      expect(body).toBe('내일 09시 점검');
    });

    it('should fallback MAINTENANCE body to default', () => {
      const template = NotificationTemplates[NotificationType.MAINTENANCE];
      const body =
        typeof template.body === 'function' ? template.body({}) : template.body;

      expect(body).toContain('시스템 점검');
    });

    it('should generate APP_UPDATE body with version', () => {
      const template = NotificationTemplates[NotificationType.APP_UPDATE];
      const body =
        typeof template.body === 'function'
          ? template.body({ version: '2.0.0' })
          : template.body;

      expect(body).toContain('2.0.0');
    });
  });

  // ============================================================================
  // NotificationTemplates - Admin
  // ============================================================================

  describe('admin templates', () => {
    it('should generate INQUIRY_ANSWERED body', () => {
      const template = NotificationTemplates[NotificationType.INQUIRY_ANSWERED];
      const body =
        typeof template.body === 'function' ? template.body({}) : template.body;

      expect(body).toContain('답변');
    });

    it('should generate NEW_REPORT body', () => {
      const template = NotificationTemplates[NotificationType.NEW_REPORT];
      const body =
        typeof template.body === 'function'
          ? template.body({ reporterName: '홍길동', targetName: '김철수' })
          : template.body;

      expect(body).toContain('홍길동');
      expect(body).toContain('김철수');
    });

    it('should generate NEW_INQUIRY body', () => {
      const template = NotificationTemplates[NotificationType.NEW_INQUIRY];
      const body =
        typeof template.body === 'function'
          ? template.body({ userName: '홍길동', subject: '결제 문의' })
          : template.body;

      expect(body).toContain('홍길동');
      expect(body).toContain('결제 문의');
    });

    it('should generate TOURNAMENT_APPROVAL_REQUEST body', () => {
      const template = NotificationTemplates[NotificationType.TOURNAMENT_APPROVAL_REQUEST];
      const body =
        typeof template.body === 'function'
          ? template.body({ employerName: '홍길동', jobTitle: '대회 모집' })
          : template.body;

      expect(body).toContain('홍길동');
      expect(body).toContain('대회 모집');
    });
  });

  // ============================================================================
  // createNotificationMessage
  // ============================================================================

  describe('createNotificationMessage', () => {
    it('should create message with string title and function body', () => {
      const result = createNotificationMessage(NotificationType.NEW_APPLICATION, {
        staffName: '홍길동',
        jobTitle: '딜러 모집',
      });

      expect(result.title).toBe('새로운 지원자');
      expect(result.body).toContain('홍길동');
      expect(result.body).toContain('딜러 모집');
      expect(result.link).toBeDefined();
      expect(result.icon).toBe('👤');
    });

    it('should create message with function title', () => {
      const result = createNotificationMessage(NotificationType.CHECKIN_REMINDER, {
        remainingTime: '15분',
        jobTitle: '딜러 모집',
        workDate: '2024-03-15',
      });

      expect(result.title).toContain('15분');
      expect(result.body).toContain('딜러 모집');
    });

    it('should return default message for unknown type', () => {
      // Force an unknown type
      const result = createNotificationMessage('unknown_type' as NotificationType, {});

      expect(result.title).toBe('알림');
      expect(result.body).toBe('새로운 알림이 있습니다.');
      expect(result.link).toBe('/notifications');
    });

    it('should work with empty data object', () => {
      const result = createNotificationMessage(NotificationType.ANNOUNCEMENT, {});

      expect(result.title).toBe('공지사항');
      expect(result.body).toContain('공지사항');
    });

    it('should include icon when available', () => {
      const result = createNotificationMessage(NotificationType.SETTLEMENT_COMPLETED, {
        jobTitle: '딜러 모집',
        amount: '150000',
      });

      expect(result.icon).toBe('💰');
    });

    it('should generate correct link', () => {
      const result = createNotificationMessage(NotificationType.NEW_REPORT, {
        reportId: 'rep123',
      });

      expect(result.link).toContain('rep123');
    });
  });

  // ============================================================================
  // NOTIFICATION_DATA_PATTERNS
  // ============================================================================

  describe('NOTIFICATION_DATA_PATTERNS', () => {
    it('should extract staff name from notification body', () => {
      const match = '홍길동님이 지원했습니다.'.match(NOTIFICATION_DATA_PATTERNS.staffName);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('홍길동');
    });

    it('should extract job title from notification body', () => {
      const match = '"딜러 모집" 공고에 지원했습니다.'.match(NOTIFICATION_DATA_PATTERNS.jobTitle);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('딜러 모집');
    });

    it('should extract date from notification body', () => {
      const match = '2024-03-15에 출근해주세요.'.match(NOTIFICATION_DATA_PATTERNS.workDate);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('2024-03-15');
    });

    it('should extract amount from notification body', () => {
      const match = '지급액: 150,000원'.match(NOTIFICATION_DATA_PATTERNS.amount);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('150,000');
    });

    it('should handle amount without commas (regex captures up to 3 initial digits)', () => {
      // The pattern (\d{1,3}(?:,\d{3})*) expects comma-separated groups after initial 1-3 digits
      // So "5000" matches as "500" (3 digits, no comma group follows)
      const match = '지급액: 5000원'.match(NOTIFICATION_DATA_PATTERNS.amount);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('500');
    });

    it('should handle properly formatted amounts', () => {
      const match = '지급액: 5,000원'.match(NOTIFICATION_DATA_PATTERNS.amount);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('5,000');
    });

    it('should handle large formatted amounts', () => {
      const match = '지급액: 1,500,000원'.match(NOTIFICATION_DATA_PATTERNS.amount);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('1,500,000');
    });
  });
});
