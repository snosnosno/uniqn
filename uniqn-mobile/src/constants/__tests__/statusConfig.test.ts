import { SECONDARY_PALETTE } from '@/constants/colors';
import {
  ANNOUNCEMENT_PRIORITY,
  APPLICATION_STATUS,
  ATTENDANCE_STATUS,
  getStatusConfig,
  getStatusHexColor,
  getStatusLabel,
  getStatusVariant,
  INQUIRY_STATUS,
  JOB_POSTING_STATUS,
  PAYROLL_STATUS,
  SCHEDULE_STATUS,
  type ApplicationStatusType,
  type ScheduleStatusType,
} from '../statusConfig';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';

describe('StatusConfig', () => {
  describe('APPLICATION_STATUS', () => {
    it('should have all expected status types', () => {
      const expectedStatuses: ApplicationStatusType[] = [
        'applied',
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

    it('uses the canonical shared label for applied status', () => {
      expect(APPLICATION_STATUS.applied.label).toBe(APPLICATION_STATUS_LABELS.applied);
    });

    it('should have correct variant for confirmed status', () => {
      expect(APPLICATION_STATUS.confirmed.variant).toBe('success');
    });
  });

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

  describe('JOB_POSTING_STATUS', () => {
    it('should have all posting statuses', () => {
      expect(JOB_POSTING_STATUS.active).toBeDefined();
      expect(JOB_POSTING_STATUS.closed).toBeDefined();
      expect(JOB_POSTING_STATUS.cancelled).toBeDefined();
    });
  });

  describe('INQUIRY_STATUS', () => {
    it('should have all inquiry statuses', () => {
      expect(INQUIRY_STATUS.open).toBeDefined();
      expect(INQUIRY_STATUS.in_progress).toBeDefined();
      expect(INQUIRY_STATUS.closed).toBeDefined();
    });
  });

  describe('ANNOUNCEMENT_PRIORITY', () => {
    it('should have all priority levels', () => {
      expect(ANNOUNCEMENT_PRIORITY.urgent).toBeDefined();
      expect(ANNOUNCEMENT_PRIORITY.important).toBeDefined();
      expect(ANNOUNCEMENT_PRIORITY.normal).toBeDefined();
    });
  });

  describe('getStatusConfig', () => {
    it('should return correct config for valid status', () => {
      const config = getStatusConfig(APPLICATION_STATUS, 'confirmed');
      expect(config).toEqual(APPLICATION_STATUS.confirmed);
    });

    it('should return default config for invalid status', () => {
      const config = getStatusConfig(APPLICATION_STATUS, 'invalid' as ApplicationStatusType);
      expect(config.label).toBe('상태 없음');
      expect(config.variant).toBe('default');
    });
  });

  describe('getStatusLabel', () => {
    it('should return labels from the canonical config map', () => {
      expect(getStatusLabel(APPLICATION_STATUS, 'applied')).toBe(APPLICATION_STATUS_LABELS.applied);
      expect(getStatusLabel(APPLICATION_STATUS, 'confirmed')).toBe(
        APPLICATION_STATUS_LABELS.confirmed
      );
    });

    it('should return fallback for invalid status', () => {
      expect(getStatusLabel(APPLICATION_STATUS, 'invalid' as ApplicationStatusType)).toBe(
        '상태 없음'
      );
    });
  });

  describe('getStatusHexColor', () => {
    it('should return hex color for valid status', () => {
      const color = getStatusHexColor(APPLICATION_STATUS, 'confirmed');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should return fallback color for invalid status', () => {
      const color = getStatusHexColor(APPLICATION_STATUS, 'invalid' as ApplicationStatusType);
      expect(color).toBe(SECONDARY_PALETTE[500]);
    });
  });

  describe('getStatusVariant', () => {
    it('should return variant for valid status', () => {
      expect(getStatusVariant(APPLICATION_STATUS, 'confirmed')).toBe('success');
      expect(getStatusVariant(APPLICATION_STATUS, 'rejected')).toBe('error');
    });

    it('should return default for invalid status', () => {
      expect(getStatusVariant(APPLICATION_STATUS, 'invalid' as ApplicationStatusType)).toBe(
        'default'
      );
    });
  });
});
