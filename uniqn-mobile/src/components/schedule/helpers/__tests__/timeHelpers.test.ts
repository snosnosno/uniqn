/**
 * UNIQN Mobile - ScheduleCard timeHelpers Tests
 *
 * @description Unit tests for time formatting helpers
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { formatTime, formatTimeRange, calculateDuration, formatDate } from '../timeHelpers';

// ============================================================================
// formatTime Tests
// ============================================================================

describe('formatTime', () => {
  it('should return "--:--" for null timestamp', () => {
    expect(formatTime(null)).toBe('--:--');
  });

  it('should format timestamp to HH:mm', () => {
    // Create a timestamp for 14:30
    const date = new Date('2024-01-15T14:30:00');
    const timestamp = Timestamp.fromDate(date);
    expect(formatTime(timestamp)).toBe('14:30');
  });

  it('should format midnight correctly', () => {
    const date = new Date('2024-01-15T00:00:00');
    const timestamp = Timestamp.fromDate(date);
    expect(formatTime(timestamp)).toBe('00:00');
  });

  it('should format late night time correctly', () => {
    const date = new Date('2024-01-15T23:59:00');
    const timestamp = Timestamp.fromDate(date);
    expect(formatTime(timestamp)).toBe('23:59');
  });
});

// ============================================================================
// formatTimeRange Tests
// ============================================================================

describe('formatTimeRange', () => {
  it('should format time range with valid timestamps', () => {
    const start = Timestamp.fromDate(new Date('2024-01-15T09:00:00'));
    const end = Timestamp.fromDate(new Date('2024-01-15T18:00:00'));
    expect(formatTimeRange(start, end)).toBe('09:00 - 18:00');
  });

  it('should handle null start time', () => {
    const end = Timestamp.fromDate(new Date('2024-01-15T18:00:00'));
    expect(formatTimeRange(null, end)).toBe('--:-- - 18:00');
  });

  it('should handle null end time', () => {
    const start = Timestamp.fromDate(new Date('2024-01-15T09:00:00'));
    expect(formatTimeRange(start, null)).toBe('09:00 - --:--');
  });

  it('should handle both null times', () => {
    expect(formatTimeRange(null, null)).toBe('--:-- - --:--');
  });
});

// ============================================================================
// calculateDuration Tests
// ============================================================================

describe('calculateDuration', () => {
  it('should return "-" for null start', () => {
    const end = Timestamp.fromDate(new Date('2024-01-15T18:00:00'));
    expect(calculateDuration(null, end)).toBe('-');
  });

  it('should return "-" for null end', () => {
    const start = Timestamp.fromDate(new Date('2024-01-15T09:00:00'));
    expect(calculateDuration(start, null)).toBe('-');
  });

  it('should calculate hours only', () => {
    const start = Timestamp.fromDate(new Date('2024-01-15T09:00:00'));
    const end = Timestamp.fromDate(new Date('2024-01-15T17:00:00'));
    expect(calculateDuration(start, end)).toBe('8시간');
  });

  it('should calculate hours and minutes', () => {
    const start = Timestamp.fromDate(new Date('2024-01-15T09:00:00'));
    const end = Timestamp.fromDate(new Date('2024-01-15T17:30:00'));
    expect(calculateDuration(start, end)).toBe('8시간 30분');
  });

  it('should calculate minutes only', () => {
    const start = Timestamp.fromDate(new Date('2024-01-15T09:00:00'));
    const end = Timestamp.fromDate(new Date('2024-01-15T09:45:00'));
    expect(calculateDuration(start, end)).toBe('45분');
  });

  it('should handle overnight shifts (crossing midnight)', () => {
    const start = Timestamp.fromDate(new Date('2024-01-15T22:00:00'));
    const end = Timestamp.fromDate(new Date('2024-01-15T02:00:00')); // Next day but same date object
    expect(calculateDuration(start, end)).toBe('4시간');
  });
});

// ============================================================================
// formatDate Tests
// ============================================================================

describe('formatDate', () => {
  it('should return "-" for empty string', () => {
    expect(formatDate('')).toBe('-');
  });

  it('should return original string for invalid date', () => {
    expect(formatDate('invalid-date')).toBe('invalid-date');
  });

  it('should format date with day of week', () => {
    // 2024-01-15 is Monday
    expect(formatDate('2024-01-15')).toBe('1/15(월)');
  });

  it('should format different days correctly', () => {
    expect(formatDate('2024-01-14')).toBe('1/14(일)'); // Sunday
    expect(formatDate('2024-01-16')).toBe('1/16(화)'); // Tuesday
    expect(formatDate('2024-01-20')).toBe('1/20(토)'); // Saturday
  });

  it('should handle different months', () => {
    expect(formatDate('2024-12-25')).toBe('12/25(수)');
    expect(formatDate('2024-02-29')).toBe('2/29(목)'); // Leap year
  });
});
