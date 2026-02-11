/**
 * UNIQN Mobile - dateUtils 테스트
 *
 * @description dateUtils.ts re-export 경로를 통한 날짜 유틸리티 테스트
 * Core: toDate, toISODateString, getTodayString, toDateString, parseDateString
 * Formatting: formatDateKorean, formatDateShort, formatDateWithDay, formatDateTime,
 *   formatTime, formatRelativeDate, getWeekdayKo, formatDate, formatRelativeTime,
 *   formatDateShortWithDay, formatDateKoreanWithDay
 * Validation: dateChecks
 * Ranges: getDateRange, getMonthRange, parseTimeSlot, parseTimeSlotToDate,
 *   calculateWorkDuration, minutesToHoursMinutes
 */

import { Timestamp } from 'firebase/firestore';
import {
  // Core
  toDate,
  toISODateString,
  getTodayString,
  toDateString,
  parseDateString,
  // Formatting
  formatDateKorean,
  formatDateShort,
  formatDateWithDay,
  formatDateTime,
  formatTime,
  formatRelativeDate,
  getWeekdayKo,
  formatDate,
  formatRelativeTime,
  formatDateShortWithDay,
  formatDateKoreanWithDay,
  // Validation
  dateChecks,
  // Ranges
  getDateRange,
  getMonthRange,
  parseTimeSlot,
  parseTimeSlotToDate,
  calculateWorkDuration,
  minutesToHoursMinutes,
} from '../dateUtils';

// =============================================================================
// Core
// =============================================================================

describe('dateUtils - Core', () => {
  describe('toDate', () => {
    it('should return null for null/undefined', () => {
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
    });

    it('should return the same Date for Date input', () => {
      const date = new Date(2025, 2, 1);
      expect(toDate(date)).toBe(date);
    });

    it('should convert Timestamp to Date', () => {
      const ts = Timestamp.fromDate(new Date(2025, 2, 1));
      const result = toDate(ts);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
    });

    it('should parse ISO string', () => {
      const result = toDate('2025-03-01');
      expect(result).toBeInstanceOf(Date);
    });

    it('should return null for invalid string', () => {
      expect(toDate('not-a-date')).toBeNull();
    });
  });

  describe('toISODateString', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date(2025, 2, 1);
      expect(toISODateString(date)).toBe('2025-03-01');
    });

    it('should return null for null', () => {
      expect(toISODateString(null)).toBeNull();
    });
  });

  describe('getTodayString', () => {
    it('should return today in YYYY-MM-DD format', () => {
      const result = getTodayString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('toDateString', () => {
    it('should pass through string dates', () => {
      expect(toDateString('2025-03-01')).toBe('2025-03-01');
    });

    it('should format Date objects', () => {
      const date = new Date(2025, 2, 15);
      expect(toDateString(date)).toBe('2025-03-15');
    });

    it('should return empty string for null/undefined', () => {
      expect(toDateString(null)).toBe('');
      expect(toDateString(undefined)).toBe('');
    });

    it('should handle Timestamp', () => {
      const ts = Timestamp.fromDate(new Date(2025, 2, 1));
      expect(toDateString(ts)).toBe('2025-03-01');
    });

    it('should handle objects with seconds property', () => {
      const obj = { seconds: 1740787200 };
      const result = toDateString(obj);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle objects with toDate method', () => {
      const obj = { toDate: () => new Date(2025, 2, 15) };
      expect(toDateString(obj)).toBe('2025-03-15');
    });
  });

  describe('parseDateString', () => {
    it('should parse valid date string', () => {
      const result = parseDateString('2025-03-01');
      expect(result).toBeInstanceOf(Date);
    });

    it('should return null for empty string', () => {
      expect(parseDateString('')).toBeNull();
    });

    it('should return null for invalid date string', () => {
      expect(parseDateString('not-a-date')).toBeNull();
    });
  });
});

// =============================================================================
// Formatting
// =============================================================================

describe('dateUtils - Formatting', () => {
  describe('formatDateKorean', () => {
    it('should format date in Korean style', () => {
      const result = formatDateKorean(new Date(2025, 0, 28));
      expect(result).toBe('2025년 1월 28일');
    });

    it('should return empty string for null', () => {
      expect(formatDateKorean(null)).toBe('');
    });

    it('should accept Timestamp', () => {
      const ts = Timestamp.fromDate(new Date(2025, 0, 28));
      const result = formatDateKorean(ts);
      expect(result).toBe('2025년 1월 28일');
    });

    it('should accept string date', () => {
      const result = formatDateKorean('2025-01-28');
      expect(result).toBe('2025년 1월 28일');
    });
  });

  describe('formatDateShort', () => {
    it('should format to M/d', () => {
      expect(formatDateShort(new Date(2025, 0, 28))).toBe('1/28');
      expect(formatDateShort(new Date(2025, 11, 5))).toBe('12/5');
    });

    it('should accept string date', () => {
      expect(formatDateShort('2025-01-28')).toBe('1/28');
    });

    it('should return empty string for null', () => {
      expect(formatDateShort(null)).toBe('');
    });
  });

  describe('formatDateWithDay', () => {
    it('should format with day of week', () => {
      const result = formatDateWithDay(new Date(2025, 0, 28));
      // January 28, 2025 is Tuesday = 화
      expect(result).toMatch(/1월 28일 \(화\)/);
    });

    it('should return empty string for null', () => {
      expect(formatDateWithDay(null)).toBe('');
    });
  });

  describe('formatDateTime', () => {
    it('should format as yyyy.MM.dd HH:mm', () => {
      const date = new Date(2025, 0, 28, 18, 30);
      const result = formatDateTime(date);
      expect(result).toBe('2025.01.28 18:30');
    });

    it('should return empty string for null', () => {
      expect(formatDateTime(null)).toBe('');
    });
  });

  describe('formatTime', () => {
    it('should format as HH:mm', () => {
      const date = new Date(2025, 0, 1, 9, 5);
      expect(formatTime(date)).toBe('09:05');
    });

    it('should return empty string for null', () => {
      expect(formatTime(null)).toBe('');
    });
  });

  describe('formatRelativeDate', () => {
    it('should return empty string for null', () => {
      expect(formatRelativeDate(null)).toBe('');
    });

    it('should return "오늘" for today', () => {
      const today = new Date();
      expect(formatRelativeDate(today)).toBe('오늘');
    });

    it('should return "내일" for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = formatRelativeDate(tomorrow);
      expect(result).toBe('내일');
    });

    it('should return "어제" for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatRelativeDate(yesterday)).toBe('어제');
    });

    it('should return "N일 후" for near future', () => {
      const future = new Date();
      future.setDate(future.getDate() + 3);
      expect(formatRelativeDate(future)).toBe('3일 후');
    });

    it('should return "N일 전" for recent past', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      expect(formatRelativeDate(past)).toBe('5일 전');
    });

    it('should return full date for distant dates', () => {
      const distant = new Date();
      distant.setDate(distant.getDate() + 30);
      const result = formatRelativeDate(distant);
      // Should fall through to formatDateKorean format
      expect(result).toMatch(/\d+년 \d+월 \d+일/);
    });
  });

  describe('getWeekdayKo', () => {
    it('should return Korean weekday', () => {
      // 2025-01-28 is Tuesday
      expect(getWeekdayKo(new Date(2025, 0, 28))).toBe('화');
      // 2025-01-26 is Sunday
      expect(getWeekdayKo(new Date(2025, 0, 26))).toBe('일');
    });

    it('should accept string date', () => {
      expect(getWeekdayKo('2025-01-28')).toBe('화');
    });

    it('should return empty string for null', () => {
      expect(getWeekdayKo(null)).toBe('');
    });
  });

  describe('formatDate', () => {
    it('should format as yyyy.MM.dd', () => {
      const date = new Date(2025, 0, 28);
      expect(formatDate(date)).toBe('2025.01.28');
    });

    it('should return empty string for null', () => {
      expect(formatDate(null)).toBe('');
    });
  });

  describe('formatRelativeTime', () => {
    it('should return empty string for null', () => {
      expect(formatRelativeTime(null)).toBe('');
    });

    it('should return "방금" for very recent time', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('방금');
    });

    it('should return "N분 전" for minutes ago', () => {
      const minutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeTime(minutesAgo);
      expect(result).toMatch(/\d+분 전/);
    });

    it('should return "N시간 전" for hours ago', () => {
      const hoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = formatRelativeTime(hoursAgo);
      expect(result).toMatch(/\d+시간 전/);
    });

    it('should return "N일 전" for days ago', () => {
      const daysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(daysAgo);
      expect(result).toMatch(/\d+일 전/);
    });

    it('should return "N주 전" for weeks ago', () => {
      const weeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(weeksAgo);
      expect(result).toMatch(/\d+주 전/);
    });

    it('should return "N개월 전" for months ago', () => {
      const monthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(monthsAgo);
      expect(result).toMatch(/\d+개월 전/);
    });
  });

  describe('formatDateShortWithDay', () => {
    it('should format as M/d(E)', () => {
      const result = formatDateShortWithDay(new Date(2025, 0, 28));
      // 1/28(화)
      expect(result).toMatch(/1\/28\(화\)/);
    });

    it('should return "-" for null', () => {
      expect(formatDateShortWithDay(null)).toBe('-');
    });

    it('should return "-" for invalid date string', () => {
      expect(formatDateShortWithDay('invalid')).toBe('-');
    });
  });

  describe('formatDateKoreanWithDay', () => {
    it('should format as yyyy년 M월 d일 (E)', () => {
      const result = formatDateKoreanWithDay(new Date(2025, 0, 28));
      expect(result).toMatch(/2025년 1월 28일 \(화\)/);
    });

    it('should return empty string for null', () => {
      expect(formatDateKoreanWithDay(null)).toBe('');
    });

    it('should return empty string for invalid string', () => {
      expect(formatDateKoreanWithDay('invalid')).toBe('');
    });
  });
});

// =============================================================================
// Validation
// =============================================================================

describe('dateUtils - Validation', () => {
  describe('dateChecks', () => {
    describe('isToday', () => {
      it('should return true for today', () => {
        expect(dateChecks.isToday(new Date())).toBe(true);
      });

      it('should return false for yesterday', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        expect(dateChecks.isToday(yesterday)).toBe(false);
      });

      it('should return false for null', () => {
        expect(dateChecks.isToday(null)).toBe(false);
      });

      it('should accept string date', () => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        expect(dateChecks.isToday(todayStr)).toBe(true);
      });
    });

    describe('isPast', () => {
      it('should return true for past date', () => {
        const past = new Date('2020-01-01');
        expect(dateChecks.isPast(past)).toBe(true);
      });

      it('should return false for future date', () => {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        expect(dateChecks.isPast(future)).toBe(false);
      });

      it('should return false for null', () => {
        expect(dateChecks.isPast(null)).toBe(false);
      });
    });

    describe('isFuture', () => {
      it('should return true for future date', () => {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        expect(dateChecks.isFuture(future)).toBe(true);
      });

      it('should return false for past date', () => {
        const past = new Date('2020-01-01');
        expect(dateChecks.isFuture(past)).toBe(false);
      });

      it('should return false for null', () => {
        expect(dateChecks.isFuture(null)).toBe(false);
      });
    });

    describe('isWithinDays', () => {
      it('should return true for date within range', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        expect(dateChecks.isWithinDays(tomorrow, 7)).toBe(true);
      });

      it('should return false for date beyond range', () => {
        const farFuture = new Date();
        farFuture.setDate(farFuture.getDate() + 30);
        expect(dateChecks.isWithinDays(farFuture, 7)).toBe(false);
      });

      it('should return false for past date', () => {
        const past = new Date('2020-01-01');
        expect(dateChecks.isWithinDays(past, 7)).toBe(false);
      });

      it('should return false for null', () => {
        expect(dateChecks.isWithinDays(null, 7)).toBe(false);
      });
    });
  });
});

// =============================================================================
// Ranges
// =============================================================================

describe('dateUtils - Ranges', () => {
  describe('getDateRange', () => {
    it('should generate date array between start and end', () => {
      const start = new Date(2025, 2, 1);
      const end = new Date(2025, 2, 3);
      const result = getDateRange(start, end);

      expect(result).toEqual(['2025-03-01', '2025-03-02', '2025-03-03']);
    });

    it('should return single date if start equals end', () => {
      const date = new Date(2025, 2, 1);
      const result = getDateRange(date, date);

      expect(result).toEqual(['2025-03-01']);
    });

    it('should return empty array if start is after end', () => {
      const start = new Date(2025, 2, 5);
      const end = new Date(2025, 2, 1);
      const result = getDateRange(start, end);

      expect(result).toEqual([]);
    });
  });

  describe('getMonthRange', () => {
    it('should return start and end of given month', () => {
      const date = new Date(2025, 0, 15); // January 15
      const result = getMonthRange(date);

      expect(result.start).toBe('2025-01-01');
      expect(result.end).toBe('2025-01-31');
    });

    it('should handle February', () => {
      const date = new Date(2025, 1, 10); // February 2025
      const result = getMonthRange(date);

      expect(result.start).toBe('2025-02-01');
      expect(result.end).toBe('2025-02-28');
    });

    it('should handle February in leap year', () => {
      const date = new Date(2024, 1, 10); // February 2024 (leap year)
      const result = getMonthRange(date);

      expect(result.start).toBe('2024-02-01');
      expect(result.end).toBe('2024-02-29');
    });

    it('should use current date when no argument provided', () => {
      const result = getMonthRange();
      expect(result.start).toMatch(/^\d{4}-\d{2}-01$/);
      expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('parseTimeSlot', () => {
    it('should parse start~end format', () => {
      expect(parseTimeSlot('09:00~18:00')).toEqual({ start: '09:00', end: '18:00' });
    });

    it('should parse start - end format with spaces', () => {
      expect(parseTimeSlot('09:00 - 18:00')).toEqual({ start: '09:00', end: '18:00' });
    });

    it('should parse start-end format without spaces', () => {
      expect(parseTimeSlot('14:00-22:00')).toEqual({ start: '14:00', end: '22:00' });
    });

    it('should parse single time format', () => {
      expect(parseTimeSlot('19:00')).toEqual({ start: '19:00', end: null });
    });

    it('should return null for invalid format', () => {
      expect(parseTimeSlot('invalid')).toBeNull();
      expect(parseTimeSlot('')).toBeNull();
    });
  });

  describe('parseTimeSlotToDate', () => {
    it('should parse full time slot to Date objects', () => {
      const result = parseTimeSlotToDate('09:00~18:00', '2025-03-01');

      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.startTime!.getHours()).toBe(9);
      expect(result.endTime!.getHours()).toBe(18);
    });

    it('should handle overnight time slots', () => {
      const result = parseTimeSlotToDate('18:00~02:00', '2025-03-01');

      expect(result.startTime!.getHours()).toBe(18);
      // End time should be next day
      expect(result.endTime!.getDate()).toBe(2);
      expect(result.endTime!.getHours()).toBe(2);
    });

    it('should handle single time format', () => {
      const result = parseTimeSlotToDate('19:00', '2025-03-01');

      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeNull();
    });

    it('should return nulls for null/empty inputs', () => {
      expect(parseTimeSlotToDate(null, '2025-03-01')).toEqual({ startTime: null, endTime: null });
      expect(parseTimeSlotToDate('', '2025-03-01')).toEqual({ startTime: null, endTime: null });
      expect(parseTimeSlotToDate('09:00', '')).toEqual({ startTime: null, endTime: null });
    });

    it('should return nulls for invalid format', () => {
      expect(parseTimeSlotToDate('invalid', '2025-03-01')).toEqual({ startTime: null, endTime: null });
    });
  });

  describe('calculateWorkDuration', () => {
    it('should calculate minutes between start and end', () => {
      expect(calculateWorkDuration('09:00', '18:00')).toBe(540); // 9 hours
      expect(calculateWorkDuration('09:00', '17:30')).toBe(510); // 8.5 hours
    });

    it('should handle overnight shifts', () => {
      expect(calculateWorkDuration('18:00', '02:00')).toBe(480); // 8 hours
      expect(calculateWorkDuration('22:00', '06:00')).toBe(480); // 8 hours
    });

    it('should handle same time (full day)', () => {
      expect(calculateWorkDuration('09:00', '09:00')).toBe(0);
    });
  });

  describe('minutesToHoursMinutes', () => {
    it('should convert minutes to hours and minutes', () => {
      expect(minutesToHoursMinutes(540)).toEqual({
        hours: 9,
        minutes: 0,
        display: '9시간',
      });
    });

    it('should include remaining minutes in display', () => {
      expect(minutesToHoursMinutes(510)).toEqual({
        hours: 8,
        minutes: 30,
        display: '8시간 30분',
      });
    });

    it('should handle less than an hour', () => {
      expect(minutesToHoursMinutes(45)).toEqual({
        hours: 0,
        minutes: 45,
        display: '0시간 45분',
      });
    });

    it('should handle zero', () => {
      expect(minutesToHoursMinutes(0)).toEqual({
        hours: 0,
        minutes: 0,
        display: '0시간',
      });
    });
  });
});
