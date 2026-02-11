/**
 * UNIQN Mobile - dateRangeUtils 테스트
 *
 * @description dateRangeUtils.ts re-export 경로를 통한 날짜 범위 유틸리티 테스트
 * - toDateString, areDatesConsecutive, areAllDatesConsecutive,
 *   groupConsecutiveDates, formatDateRange, getDayCount,
 *   formatDateRangeWithCount, isSingleDate, getDateListFromRange
 */

import {
  toDateString,
  areDatesConsecutive,
  areAllDatesConsecutive,
  groupConsecutiveDates,
  formatDateRange,
  getDayCount,
  formatDateRangeWithCount,
  isSingleDate,
  getDateListFromRange,
} from '../dateRangeUtils';
import type { DateRangeGroup } from '../dateRangeUtils';

// =============================================================================
// Helper
// =============================================================================

const createDateRangeGroup = (overrides: Partial<DateRangeGroup> = {}): DateRangeGroup => ({
  id: 'group-1',
  startDate: '2025-03-01',
  endDate: '2025-03-03',
  timeSlots: [],
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe('dateRangeUtils', () => {
  // ===========================================================================
  // toDateString
  // ===========================================================================
  describe('toDateString', () => {
    it('should pass through string dates', () => {
      expect(toDateString('2025-03-01')).toBe('2025-03-01');
    });

    it('should format Date objects to YYYY-MM-DD', () => {
      const date = new Date(2025, 2, 1); // March 1, 2025
      expect(toDateString(date)).toBe('2025-03-01');
    });

    it('should return empty string for null/undefined', () => {
      expect(toDateString(null)).toBe('');
      expect(toDateString(undefined)).toBe('');
    });

    it('should handle objects with seconds property', () => {
      const timestamp = { seconds: 1740787200 }; // 2025-03-01 UTC (approx)
      const result = toDateString(timestamp);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle objects with toDate method', () => {
      const obj = { toDate: () => new Date(2025, 2, 15) };
      expect(toDateString(obj)).toBe('2025-03-15');
    });
  });

  // ===========================================================================
  // areDatesConsecutive
  // ===========================================================================
  describe('areDatesConsecutive', () => {
    it('should return true for consecutive dates', () => {
      expect(areDatesConsecutive('2025-03-01', '2025-03-02')).toBe(true);
      expect(areDatesConsecutive('2025-03-02', '2025-03-01')).toBe(true); // reverse order also consecutive
    });

    it('should return false for non-consecutive dates', () => {
      expect(areDatesConsecutive('2025-03-01', '2025-03-03')).toBe(false);
      expect(areDatesConsecutive('2025-03-01', '2025-03-10')).toBe(false);
    });

    it('should return false for same date', () => {
      expect(areDatesConsecutive('2025-03-01', '2025-03-01')).toBe(false);
    });

    it('should handle month boundaries', () => {
      expect(areDatesConsecutive('2025-01-31', '2025-02-01')).toBe(true);
      expect(areDatesConsecutive('2025-02-28', '2025-03-01')).toBe(true);
    });

    it('should return false for invalid dates', () => {
      expect(areDatesConsecutive('invalid', '2025-03-01')).toBe(false);
      expect(areDatesConsecutive('2025-03-01', 'invalid')).toBe(false);
    });
  });

  // ===========================================================================
  // areAllDatesConsecutive
  // ===========================================================================
  describe('areAllDatesConsecutive', () => {
    it('should return true for consecutive date array', () => {
      expect(areAllDatesConsecutive(['2025-03-01', '2025-03-02', '2025-03-03'])).toBe(true);
    });

    it('should return false when there is a gap', () => {
      expect(areAllDatesConsecutive(['2025-03-01', '2025-03-02', '2025-03-04'])).toBe(false);
    });

    it('should return true for single date', () => {
      expect(areAllDatesConsecutive(['2025-03-01'])).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(areAllDatesConsecutive([])).toBe(true);
    });

    it('should sort dates before checking (order does not matter)', () => {
      expect(areAllDatesConsecutive(['2025-03-03', '2025-03-01', '2025-03-02'])).toBe(true);
    });
  });

  // ===========================================================================
  // groupConsecutiveDates
  // ===========================================================================
  describe('groupConsecutiveDates', () => {
    it('should group consecutive dates together', () => {
      const dates = ['2025-03-01', '2025-03-02', '2025-03-04', '2025-03-05'];
      const groups = groupConsecutiveDates(dates);

      expect(groups).toHaveLength(2);
      expect(groups[0]).toEqual(['2025-03-01', '2025-03-02']);
      expect(groups[1]).toEqual(['2025-03-04', '2025-03-05']);
    });

    it('should handle single date', () => {
      const groups = groupConsecutiveDates(['2025-03-01']);
      expect(groups).toEqual([['2025-03-01']]);
    });

    it('should handle empty array', () => {
      expect(groupConsecutiveDates([])).toEqual([]);
    });

    it('should handle all consecutive dates as single group', () => {
      const dates = ['2025-03-01', '2025-03-02', '2025-03-03'];
      const groups = groupConsecutiveDates(dates);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual(['2025-03-01', '2025-03-02', '2025-03-03']);
    });

    it('should handle all non-consecutive dates as individual groups', () => {
      const dates = ['2025-03-01', '2025-03-05', '2025-03-10'];
      const groups = groupConsecutiveDates(dates);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual(['2025-03-01']);
      expect(groups[1]).toEqual(['2025-03-05']);
      expect(groups[2]).toEqual(['2025-03-10']);
    });

    it('should sort dates before grouping', () => {
      const dates = ['2025-03-03', '2025-03-01', '2025-03-02'];
      const groups = groupConsecutiveDates(dates);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual(['2025-03-01', '2025-03-02', '2025-03-03']);
    });
  });

  // ===========================================================================
  // formatDateRange
  // ===========================================================================
  describe('formatDateRange', () => {
    it('should format single date (start === end)', () => {
      const result = formatDateRange('2025-03-01', '2025-03-01');
      // Should be like "3/1(토)"
      expect(result).toMatch(/3\/1/);
    });

    it('should format date range with tilde', () => {
      const result = formatDateRange('2025-03-01', '2025-03-03');
      expect(result).toContain('~');
      expect(result).toMatch(/3\/1/);
      expect(result).toMatch(/3\/3/);
    });

    it('should return empty string for invalid start date', () => {
      expect(formatDateRange('invalid', '2025-03-03')).toBe('');
    });

    it('should handle null end date (treats as single date)', () => {
      const result = formatDateRange('2025-03-01', '');
      // parseDateString('') returns null, so treated as single date
      expect(result).toMatch(/3\/1/);
    });
  });

  // ===========================================================================
  // getDayCount
  // ===========================================================================
  describe('getDayCount', () => {
    it('should return 1 for same date', () => {
      expect(getDayCount('2025-03-01', '2025-03-01')).toBe(1);
    });

    it('should return correct day count', () => {
      expect(getDayCount('2025-03-01', '2025-03-03')).toBe(3);
      expect(getDayCount('2025-03-01', '2025-03-10')).toBe(10);
    });

    it('should handle month boundaries', () => {
      expect(getDayCount('2025-01-30', '2025-02-02')).toBe(4);
    });

    it('should return 1 for invalid dates', () => {
      expect(getDayCount('invalid', '2025-03-03')).toBe(1);
      expect(getDayCount('2025-03-01', 'invalid')).toBe(1);
    });
  });

  // ===========================================================================
  // formatDateRangeWithCount
  // ===========================================================================
  describe('formatDateRangeWithCount', () => {
    it('should not include count for single date', () => {
      const result = formatDateRangeWithCount('2025-03-01', '2025-03-01');
      expect(result).not.toContain('일)');
    });

    it('should include day count for multi-day range', () => {
      const result = formatDateRangeWithCount('2025-03-01', '2025-03-03');
      expect(result).toContain('3일');
    });
  });

  // ===========================================================================
  // isSingleDate
  // ===========================================================================
  describe('isSingleDate', () => {
    it('should return true when startDate equals endDate', () => {
      const group = createDateRangeGroup({ startDate: '2025-03-01', endDate: '2025-03-01' });
      expect(isSingleDate(group)).toBe(true);
    });

    it('should return false when startDate differs from endDate', () => {
      const group = createDateRangeGroup({ startDate: '2025-03-01', endDate: '2025-03-03' });
      expect(isSingleDate(group)).toBe(false);
    });
  });

  // ===========================================================================
  // getDateListFromRange
  // ===========================================================================
  describe('getDateListFromRange', () => {
    it('should return all dates in range', () => {
      const group = createDateRangeGroup({ startDate: '2025-03-01', endDate: '2025-03-03' });
      const dates = getDateListFromRange(group);

      expect(dates).toEqual(['2025-03-01', '2025-03-02', '2025-03-03']);
    });

    it('should return single date for same start/end', () => {
      const group = createDateRangeGroup({ startDate: '2025-03-01', endDate: '2025-03-01' });
      const dates = getDateListFromRange(group);

      expect(dates).toEqual(['2025-03-01']);
    });

    it('should return empty array for invalid start date', () => {
      const group = createDateRangeGroup({ startDate: 'invalid', endDate: '2025-03-03' });
      const dates = getDateListFromRange(group);

      expect(dates).toEqual([]);
    });

    it('should handle month boundary ranges', () => {
      const group = createDateRangeGroup({ startDate: '2025-01-30', endDate: '2025-02-02' });
      const dates = getDateListFromRange(group);

      expect(dates).toEqual(['2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02']);
    });
  });
});
