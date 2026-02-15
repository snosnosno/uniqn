/**
 * UNIQN Mobile - ConfirmedStaff 타입 유틸리티 테스트
 *
 * @description workLogToConfirmedStaff, groupStaffByDate, calculateStaffStats,
 *   sortStaffByStatus, CONFIRMED_STAFF_STATUS_LABELS/COLORS 테스트
 */

import type { ConfirmedStaff } from '../confirmedStaff';
import {
  CONFIRMED_STAFF_STATUS_LABELS,
  CONFIRMED_STAFF_STATUS_COLORS,
  workLogToConfirmedStaff,
  groupStaffByDate,
  calculateStaffStats,
  sortStaffByStatus,
} from '../confirmedStaff';

// =============================================================================
// Helpers
// =============================================================================

const createMockWorkLog = (overrides = {}) => ({
  id: 'wl-1',
  staffId: 'staff-123',
  jobPostingId: 'job-1',
  date: '2025-03-01',
  role: 'dealer',
  status: 'scheduled',
  scheduledStartTime: undefined,
  scheduledEndTime: undefined,
  payrollStatus: undefined,
  payrollAmount: undefined,
  notes: undefined,
  ...overrides,
});

const createMockConfirmedStaff = (overrides: Partial<ConfirmedStaff> = {}): ConfirmedStaff => ({
  id: 'cs-1',
  staffId: 'staff-1',
  staffName: '테스트 스태프',
  role: 'dealer',
  date: '2025-03-01',
  status: 'scheduled',
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe('confirmedStaff', () => {
  // ===========================================================================
  // Constants
  // ===========================================================================
  describe('CONFIRMED_STAFF_STATUS_LABELS', () => {
    it('should have labels for all statuses', () => {
      expect(CONFIRMED_STAFF_STATUS_LABELS.scheduled).toBe('출근 예정');
      expect(CONFIRMED_STAFF_STATUS_LABELS.checked_in).toBe('근무 중');
      expect(CONFIRMED_STAFF_STATUS_LABELS.checked_out).toBe('퇴근 완료');
      expect(CONFIRMED_STAFF_STATUS_LABELS.completed).toBe('정산 대기');
      expect(CONFIRMED_STAFF_STATUS_LABELS.cancelled).toBe('취소됨');
      expect(CONFIRMED_STAFF_STATUS_LABELS.no_show).toBe('노쇼');
    });
  });

  describe('CONFIRMED_STAFF_STATUS_COLORS', () => {
    it('should have bg and text for all statuses', () => {
      const statuses = [
        'scheduled',
        'checked_in',
        'checked_out',
        'completed',
        'cancelled',
        'no_show',
      ] as const;

      for (const status of statuses) {
        const color = CONFIRMED_STAFF_STATUS_COLORS[status];
        expect(color).toHaveProperty('bg');
        expect(color).toHaveProperty('text');
        expect(typeof color.bg).toBe('string');
        expect(typeof color.text).toBe('string');
      }
    });
  });

  // ===========================================================================
  // workLogToConfirmedStaff
  // ===========================================================================
  describe('workLogToConfirmedStaff', () => {
    it('should convert WorkLog to ConfirmedStaff with provided name', () => {
      const workLog = createMockWorkLog({
        id: 'wl-1',
        staffId: 'staff-abc',
        role: 'dealer',
        date: '2025-03-01',
        status: 'scheduled',
      });

      const result = workLogToConfirmedStaff(workLog as any, '홍길동');

      expect(result.id).toBe('wl-1');
      expect(result.staffId).toBe('staff-abc');
      expect(result.staffName).toBe('홍길동');
      expect(result.role).toBe('dealer');
      expect(result.date).toBe('2025-03-01');
      expect(result.status).toBe('scheduled');
      expect(result.workLog).toBe(workLog);
    });

    it('should use last 4 chars of staffId when no name provided', () => {
      const workLog = createMockWorkLog({ staffId: 'staff-abcdef' });
      const result = workLogToConfirmedStaff(workLog as any);

      expect(result.staffName).toBe('cdef');
    });

    it('should carry over optional fields', () => {
      const workLog = createMockWorkLog({
        timeSlot: '09:00~18:00',
        customRole: '커스텀 역할',
        notes: '비고 내용',
        payrollStatus: 'pending',
        payrollAmount: 150000,
      });

      const result = workLogToConfirmedStaff(workLog as any, '김철수');

      expect(result.timeSlot).toBe('09:00~18:00');
      expect(result.customRole).toBe('커스텀 역할');
      expect(result.notes).toBe('비고 내용');
      expect(result.payrollStatus).toBe('pending');
      expect(result.payrollAmount).toBe(150000);
    });
  });

  // ===========================================================================
  // groupStaffByDate
  // ===========================================================================
  describe('groupStaffByDate', () => {
    it('should group staff by date', () => {
      const staffList: ConfirmedStaff[] = [
        createMockConfirmedStaff({ date: '2025-03-01', id: 'cs-1' }),
        createMockConfirmedStaff({ date: '2025-03-01', id: 'cs-2' }),
        createMockConfirmedStaff({ date: '2025-03-02', id: 'cs-3' }),
      ];

      const groups = groupStaffByDate(staffList);

      expect(groups).toHaveLength(2);
      expect(groups[0]!.date).toBe('2025-03-01');
      expect(groups[0]!.staff).toHaveLength(2);
      expect(groups[1]!.date).toBe('2025-03-02');
      expect(groups[1]!.staff).toHaveLength(1);
    });

    it('should sort groups by date ascending', () => {
      const staffList: ConfirmedStaff[] = [
        createMockConfirmedStaff({ date: '2025-03-03' }),
        createMockConfirmedStaff({ date: '2025-03-01' }),
        createMockConfirmedStaff({ date: '2025-03-02' }),
      ];

      const groups = groupStaffByDate(staffList);

      expect(groups[0]!.date).toBe('2025-03-01');
      expect(groups[1]!.date).toBe('2025-03-02');
      expect(groups[2]!.date).toBe('2025-03-03');
    });

    it('should calculate stats per group', () => {
      const staffList: ConfirmedStaff[] = [
        createMockConfirmedStaff({ date: '2025-03-01', status: 'checked_in' }),
        createMockConfirmedStaff({ date: '2025-03-01', status: 'checked_out' }),
        createMockConfirmedStaff({ date: '2025-03-01', status: 'no_show' }),
        createMockConfirmedStaff({ date: '2025-03-01', status: 'scheduled' }),
      ];

      const groups = groupStaffByDate(staffList);
      const stats = groups[0]!.stats;

      expect(stats.total).toBe(4);
      expect(stats.checkedIn).toBe(1);
      expect(stats.completed).toBe(1); // checked_out counts as completed
      expect(stats.noShow).toBe(1);
    });

    it('should handle empty staff list', () => {
      const groups = groupStaffByDate([]);
      expect(groups).toHaveLength(0);
    });

    it('should have formattedDate in Korean format', () => {
      const staffList: ConfirmedStaff[] = [createMockConfirmedStaff({ date: '2025-03-01' })];

      const groups = groupStaffByDate(staffList);
      // Date(2025-03-01) in local timezone - verify it has Korean format pattern
      expect(groups[0]!.formattedDate).toMatch(/\d+월 \d+일 \(.+\)/);
    });
  });

  // ===========================================================================
  // calculateStaffStats
  // ===========================================================================
  describe('calculateStaffStats', () => {
    it('should count each status correctly', () => {
      const staffList: ConfirmedStaff[] = [
        createMockConfirmedStaff({ status: 'scheduled' }),
        createMockConfirmedStaff({ status: 'scheduled' }),
        createMockConfirmedStaff({ status: 'checked_in' }),
        createMockConfirmedStaff({ status: 'checked_out' }),
        createMockConfirmedStaff({ status: 'completed' }),
        createMockConfirmedStaff({ status: 'cancelled' }),
        createMockConfirmedStaff({ status: 'no_show' }),
      ];

      const stats = calculateStaffStats(staffList);

      expect(stats.total).toBe(7);
      expect(stats.scheduled).toBe(2);
      expect(stats.checkedIn).toBe(1);
      expect(stats.checkedOut).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.noShow).toBe(1);
    });

    it('should count settled staff', () => {
      const staffList: ConfirmedStaff[] = [
        createMockConfirmedStaff({ status: 'completed', payrollStatus: 'completed' }),
        createMockConfirmedStaff({ status: 'completed', payrollStatus: 'pending' }),
      ];

      const stats = calculateStaffStats(staffList);

      expect(stats.settled).toBe(1);
    });

    it('should handle empty list', () => {
      const stats = calculateStaffStats([]);

      expect(stats.total).toBe(0);
      expect(stats.scheduled).toBe(0);
      expect(stats.checkedIn).toBe(0);
      expect(stats.checkedOut).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.noShow).toBe(0);
      expect(stats.settled).toBe(0);
    });
  });

  // ===========================================================================
  // sortStaffByStatus
  // ===========================================================================
  describe('sortStaffByStatus', () => {
    it('should sort by status priority (checked_in first, cancelled last)', () => {
      const staffList: ConfirmedStaff[] = [
        createMockConfirmedStaff({ id: 'cancelled', status: 'cancelled' }),
        createMockConfirmedStaff({ id: 'scheduled', status: 'scheduled' }),
        createMockConfirmedStaff({ id: 'checked_in', status: 'checked_in' }),
        createMockConfirmedStaff({ id: 'no_show', status: 'no_show' }),
        createMockConfirmedStaff({ id: 'checked_out', status: 'checked_out' }),
        createMockConfirmedStaff({ id: 'completed', status: 'completed' }),
      ];

      const sorted = sortStaffByStatus(staffList);

      expect(sorted[0]!.id).toBe('checked_in');
      expect(sorted[1]!.id).toBe('scheduled');
      expect(sorted[2]!.id).toBe('checked_out');
      expect(sorted[3]!.id).toBe('completed');
      expect(sorted[4]!.id).toBe('no_show');
      expect(sorted[5]!.id).toBe('cancelled');
    });

    it('should not mutate original array', () => {
      const staffList: ConfirmedStaff[] = [
        createMockConfirmedStaff({ status: 'cancelled' }),
        createMockConfirmedStaff({ status: 'checked_in' }),
      ];

      const original = [...staffList];
      sortStaffByStatus(staffList);

      expect(staffList[0]!.status).toBe(original[0]!.status);
      expect(staffList[1]!.status).toBe(original[1]!.status);
    });

    it('should handle empty array', () => {
      const sorted = sortStaffByStatus([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single element', () => {
      const staffList = [createMockConfirmedStaff({ status: 'scheduled' })];
      const sorted = sortStaffByStatus(staffList);
      expect(sorted).toHaveLength(1);
    });
  });
});
