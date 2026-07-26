/**
 * UNIQN Mobile - ScheduleCard timeHelpers Tests
 *
 * @description Unit tests for time formatting helpers
 * @version 1.0.0
 */

import { formatTime, formatDate } from '../timeHelpers';

// ============================================================================
// formatTime Tests
// ============================================================================

describe('formatTime', () => {
  it('should return "--:--" for null timestamp', () => {
    expect(formatTime(null)).toBe('--:--');
  });

  it('should format plain HH:mm strings', () => {
    expect(formatTime('09:00')).toBe('09:00');
  });

  it('should format Date to HH:mm', () => {
    // Create a Date for 14:30
    const date = new Date('2024-01-15T14:30:00');
    expect(formatTime(date)).toBe('14:30');
  });

  it('should format midnight correctly', () => {
    const date = new Date('2024-01-15T00:00:00');
    expect(formatTime(date)).toBe('00:00');
  });

  it('should format late night time correctly', () => {
    const date = new Date('2024-01-15T23:59:00');
    expect(formatTime(date)).toBe('23:59');
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
