/**
 * NotificationRouteMap 테스트
 *
 * @description 29개 알림 타입 전체 딥링크 매핑 테스트
 */

import { NotificationType } from '@/types/notification';
import {
  NOTIFICATION_ROUTE_MAP,
  getRouteForNotificationType,
  isAdminOnlyNotification,
  isEmployerOnlyNotification,
} from '../NotificationRouteMap';

describe('NotificationRouteMap', () => {
  describe('모든 NotificationType 커버리지', () => {
    // NotificationType의 모든 값을 배열로 가져오기
    const allNotificationTypes = Object.values(NotificationType) as NotificationType[];

    it('29개 알림 타입이 모두 매핑되어 있어야 함', () => {
      expect(allNotificationTypes.length).toBe(29);

      allNotificationTypes.forEach((type) => {
        expect(NOTIFICATION_ROUTE_MAP[type]).toBeDefined();
        expect(typeof NOTIFICATION_ROUTE_MAP[type]).toBe('function');
      });
    });

    it('모든 매핑 함수가 유효한 라우트를 반환해야 함', () => {
      allNotificationTypes.forEach((type) => {
        const route = NOTIFICATION_ROUTE_MAP[type]();
        expect(route).toBeDefined();
        expect(route.name).toBeDefined();
        expect(typeof route.name).toBe('string');
      });
    });
  });

  describe('지원 관련 알림 (7개)', () => {
    it('NEW_APPLICATION → employer/applicants', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.NEW_APPLICATION]({
        jobPostingId: 'job123',
      });
      expect(route.name).toBe('employer/applicants');
      if (route.name === 'employer/applicants') {
        expect(route.params.jobId).toBe('job123');
      }
    });

    it('NEW_APPLICATION (데이터 없음) → employer/my-postings', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.NEW_APPLICATION]();
      expect(route.name).toBe('employer/my-postings');
    });

    it('APPLICATION_CONFIRMED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.APPLICATION_CONFIRMED]();
      expect(route.name).toBe('schedule');
    });

    it('APPLICATION_REJECTED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.APPLICATION_REJECTED]();
      expect(route.name).toBe('schedule');
    });

    it('APPLICATION_CANCELLED → employer/applicants', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.APPLICATION_CANCELLED]({
        jobPostingId: 'job123',
      });
      expect(route.name).toBe('employer/applicants');
    });

    it('CONFIRMATION_CANCELLED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.CONFIRMATION_CANCELLED]();
      expect(route.name).toBe('schedule');
    });

    it('CANCELLATION_APPROVED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.CANCELLATION_APPROVED]();
      expect(route.name).toBe('schedule');
    });

    it('CANCELLATION_REJECTED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.CANCELLATION_REJECTED]();
      expect(route.name).toBe('schedule');
    });
  });

  describe('출퇴근/스케줄 관련 알림 (9개)', () => {
    it('STAFF_CHECKED_IN → employer/applicants', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.STAFF_CHECKED_IN]({
        jobPostingId: 'job123',
      });
      expect(route.name).toBe('employer/applicants');
    });

    it('STAFF_CHECKED_OUT → employer/applicants', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.STAFF_CHECKED_OUT]({
        jobPostingId: 'job123',
      });
      expect(route.name).toBe('employer/applicants');
    });

    it('CHECK_IN_CONFIRMED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.CHECK_IN_CONFIRMED]();
      expect(route.name).toBe('schedule');
    });

    it('CHECK_OUT_CONFIRMED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.CHECK_OUT_CONFIRMED]();
      expect(route.name).toBe('schedule');
    });

    it('CHECKIN_REMINDER → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.CHECKIN_REMINDER]();
      expect(route.name).toBe('schedule');
    });

    it('NO_SHOW_ALERT → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.NO_SHOW_ALERT]();
      expect(route.name).toBe('schedule');
    });

    it('SCHEDULE_CHANGE → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.SCHEDULE_CHANGE]();
      expect(route.name).toBe('schedule');
    });

    it('SCHEDULE_CREATED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.SCHEDULE_CREATED]();
      expect(route.name).toBe('schedule');
    });

    it('SCHEDULE_CANCELLED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.SCHEDULE_CANCELLED]();
      expect(route.name).toBe('schedule');
    });
  });

  describe('정산 관련 알림 (2개)', () => {
    it('SETTLEMENT_COMPLETED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.SETTLEMENT_COMPLETED]();
      expect(route.name).toBe('schedule');
    });

    it('SETTLEMENT_REQUESTED → employer/settlement', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.SETTLEMENT_REQUESTED]({
        jobPostingId: 'job123',
      });
      expect(route.name).toBe('employer/settlement');
      if (route.name === 'employer/settlement') {
        expect(route.params.jobId).toBe('job123');
      }
    });
  });

  describe('공고 관련 알림 (3개)', () => {
    it('JOB_UPDATED → job', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.JOB_UPDATED]({
        jobPostingId: 'job123',
      });
      expect(route.name).toBe('job');
      if (route.name === 'job') {
        expect(route.params.id).toBe('job123');
      }
    });

    it('JOB_CANCELLED → schedule', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.JOB_CANCELLED]();
      expect(route.name).toBe('schedule');
    });

    it('JOB_CLOSED → job', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.JOB_CLOSED]({
        jobPostingId: 'job123',
      });
      expect(route.name).toBe('job');
    });
  });

  describe('시스템 알림 (3개)', () => {
    it('ANNOUNCEMENT → notifications', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.ANNOUNCEMENT]();
      expect(route.name).toBe('notifications');
    });

    it('MAINTENANCE → notifications', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.MAINTENANCE]();
      expect(route.name).toBe('notifications');
    });

    it('APP_UPDATE → notifications', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.APP_UPDATE]();
      expect(route.name).toBe('notifications');
    });
  });

  describe('관리자 알림 (5개)', () => {
    it('INQUIRY_ANSWERED → support', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.INQUIRY_ANSWERED]();
      expect(route.name).toBe('support');
    });

    it('REPORT_RESOLVED → notifications', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.REPORT_RESOLVED]();
      expect(route.name).toBe('notifications');
    });

    it('NEW_REPORT → admin/report', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.NEW_REPORT]({
        reportId: 'report123',
      });
      expect(route.name).toBe('admin/report');
      if (route.name === 'admin/report') {
        expect(route.params.id).toBe('report123');
      }
    });

    it('NEW_INQUIRY → admin/inquiry', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.NEW_INQUIRY]({
        inquiryId: 'inquiry123',
      });
      expect(route.name).toBe('admin/inquiry');
      if (route.name === 'admin/inquiry') {
        expect(route.params.id).toBe('inquiry123');
      }
    });

    it('TOURNAMENT_APPROVAL_REQUEST → admin/tournaments', () => {
      const route = NOTIFICATION_ROUTE_MAP[NotificationType.TOURNAMENT_APPROVAL_REQUEST]();
      expect(route.name).toBe('admin/tournaments');
    });
  });

  describe('getRouteForNotificationType', () => {
    it('타입과 데이터로 라우트 반환', () => {
      const route = getRouteForNotificationType(NotificationType.NEW_APPLICATION, {
        jobPostingId: 'job123',
      });
      expect(route.name).toBe('employer/applicants');
    });
  });

  describe('isAdminOnlyNotification', () => {
    it('관리자 전용 알림 식별', () => {
      expect(isAdminOnlyNotification(NotificationType.NEW_REPORT)).toBe(true);
      expect(isAdminOnlyNotification(NotificationType.NEW_INQUIRY)).toBe(true);
      expect(isAdminOnlyNotification(NotificationType.TOURNAMENT_APPROVAL_REQUEST)).toBe(true);
    });

    it('일반 알림은 false', () => {
      expect(isAdminOnlyNotification(NotificationType.NEW_APPLICATION)).toBe(false);
      expect(isAdminOnlyNotification(NotificationType.ANNOUNCEMENT)).toBe(false);
    });
  });

  describe('isEmployerOnlyNotification', () => {
    it('구인자 전용 알림 식별', () => {
      expect(isEmployerOnlyNotification(NotificationType.NEW_APPLICATION)).toBe(true);
      expect(isEmployerOnlyNotification(NotificationType.APPLICATION_CANCELLED)).toBe(true);
      expect(isEmployerOnlyNotification(NotificationType.STAFF_CHECKED_IN)).toBe(true);
      expect(isEmployerOnlyNotification(NotificationType.STAFF_CHECKED_OUT)).toBe(true);
      expect(isEmployerOnlyNotification(NotificationType.SETTLEMENT_REQUESTED)).toBe(true);
    });

    it('일반 알림은 false', () => {
      expect(isEmployerOnlyNotification(NotificationType.APPLICATION_CONFIRMED)).toBe(false);
      expect(isEmployerOnlyNotification(NotificationType.ANNOUNCEMENT)).toBe(false);
    });
  });
});
