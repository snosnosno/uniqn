/**
 * StatusConfig 테스트
 *
 * @description Phase 1.2 - 상태 설정 통합 테스트
 */

import {
  APPLICATION_STATUS,
  SCHEDULE_STATUS,
  ATTENDANCE_STATUS,
  PAYROLL_STATUS,
  JOB_POSTING_STATUS,
  INQUIRY_STATUS,
  ANNOUNCEMENT_PRIORITY,
  getStatusConfig,
  getStatusLabel,
  getStatusHexColor,
  getStatusVariant,
  type ApplicationStatusType,
  type ScheduleStatusType,
} from '../statusConfig';

describe('StatusConfig', () => {
  // ==========================================================================
  // APPLICATION_STATUS
  // ==========================================================================
  describe('APPLICATION_STATUS', () => {
    it('should have all expected status types', () => {
      const expectedStatuses: ApplicationStatusType[] = [
        'applied',
        'pending',
        'confirmed',
        'rejected',
        'cancelled',
        'completed',
        'cancellation_pending',
      ];

      expectedStatuses.forEach((status) => {
        expect(APPLICATION_STATUS[status]).toBeDefined();
        expect(APPLICATION_STATUS[status].label).toBeTruthy();
        expect(APPLICATION_STATUS[status].variant).toBeTruthy();
        expect(APPLICATION_STATUS[status].hexColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should have correct label for applied status', () => {
      expect(APPLICATION_STATUS.applied.label).toBe('지원완료');
    });

    it('should have correct variant for confirmed status', () => {
      expect(APPLICATION_STATUS.confirmed.variant).toBe('success');
    });
  });

  // ==========================================================================
  // SCHEDULE_STATUS
  // ==========================================================================
  describe('SCHEDULE_STATUS', () => {
    it('should have all expected status types', () => {
      const expectedStatuses: ScheduleStatusType[] = [
        'applied',
        'confirmed',
        'completed',
        'cancelled',
      ];

      expectedStatuses.forEach((status) => {
        expect(SCHEDULE_STATUS[status]).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // ATTENDANCE_STATUS
  // ==========================================================================
  describe('ATTENDANCE_STATUS', () => {
    it('should have all expected attendance statuses', () => {
      expect(ATTENDANCE_STATUS.not_started).toBeDefined();
      expect(ATTENDANCE_STATUS.checked_in).toBeDefined();
      expect(ATTENDANCE_STATUS.checked_out).toBeDefined();
    });

    it('should have bgColor property for attendance statuses', () => {
      expect(ATTENDANCE_STATUS.not_started.bgColor).toBeTruthy();
      expect(ATTENDANCE_STATUS.checked_in.bgColor).toBeTruthy();
      expect(ATTENDANCE_STATUS.checked_out.bgColor).toBeTruthy();
    });
  });

  // ==========================================================================
  // PAYROLL_STATUS
  // ==========================================================================
  describe('PAYROLL_STATUS', () => {
    it('should have pending and completed statuses', () => {
      expect(PAYROLL_STATUS.pending).toBeDefined();
      expect(PAYROLL_STATUS.completed).toBeDefined();
    });

    it('should have correct colors', () => {
      expect(PAYROLL_STATUS.pending.variant).toBe('warning');
      expect(PAYROLL_STATUS.completed.variant).toBe('success');
    });
  });

  // ==========================================================================
  // JOB_POSTING_STATUS
  // ==========================================================================
  describe('JOB_POSTING_STATUS', () => {
    it('should have all posting statuses', () => {
      expect(JOB_POSTING_STATUS.draft).toBeDefined();
      expect(JOB_POSTING_STATUS.active).toBeDefined();
      expect(JOB_POSTING_STATUS.closed).toBeDefined();
      expect(JOB_POSTING_STATUS.cancelled).toBeDefined();
    });
  });

  // ==========================================================================
  // INQUIRY_STATUS
  // ==========================================================================
  describe('INQUIRY_STATUS', () => {
    it('should have all inquiry statuses', () => {
      expect(INQUIRY_STATUS.open).toBeDefined();
      expect(INQUIRY_STATUS.in_progress).toBeDefined();
      expect(INQUIRY_STATUS.closed).toBeDefined();
    });
  });

  // ==========================================================================
  // ANNOUNCEMENT_PRIORITY
  // ==========================================================================
  describe('ANNOUNCEMENT_PRIORITY', () => {
    it('should have all priority levels', () => {
      expect(ANNOUNCEMENT_PRIORITY.urgent).toBeDefined();
      expect(ANNOUNCEMENT_PRIORITY.important).toBeDefined();
      expect(ANNOUNCEMENT_PRIORITY.normal).toBeDefined();
    });
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================
  describe('getStatusConfig', () => {
    it('should return correct config for valid status', () => {
      const config = getStatusConfig(APPLICATION_STATUS, 'confirmed');
      expect(config).toEqual(APPLICATION_STATUS.confirmed);
    });

    it('should return default config for invalid status', () => {
      const config = getStatusConfig(APPLICATION_STATUS, 'invalid' as ApplicationStatusType);
      expect(config.label).toBe('알 수 없음');
      expect(config.variant).toBe('default');
    });
  });

  describe('getStatusLabel', () => {
    it('should return label for valid status', () => {
      expect(getStatusLabel(APPLICATION_STATUS, 'applied')).toBe('지원완료');
      expect(getStatusLabel(APPLICATION_STATUS, 'confirmed')).toBe('확정');
    });

    it('should return "알 수 없음" for invalid status', () => {
      expect(getStatusLabel(APPLICATION_STATUS, 'invalid' as ApplicationStatusType)).toBe(
        '알 수 없음'
      );
    });
  });

  describe('getStatusHexColor', () => {
    it('should return hex color for valid status', () => {
      const color = getStatusHexColor(APPLICATION_STATUS, 'confirmed');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should return gray for invalid status', () => {
      const color = getStatusHexColor(APPLICATION_STATUS, 'invalid' as ApplicationStatusType);
      expect(color).toBe('#6B7280'); // gray-500
    });
  });

  describe('getStatusVariant', () => {
    it('should return variant for valid status', () => {
      expect(getStatusVariant(APPLICATION_STATUS, 'confirmed')).toBe('success');
      expect(getStatusVariant(APPLICATION_STATUS, 'rejected')).toBe('error');
    });

    it('should return "default" for invalid status', () => {
      expect(getStatusVariant(APPLICATION_STATUS, 'invalid' as ApplicationStatusType)).toBe(
        'default'
      );
    });
  });
});
