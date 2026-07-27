/**
 * UNIQN Mobile - ScheduleCard timeHelpers Tests
 *
 * @description Unit tests for time formatting helpers
 * @version 1.0.0
 */

import {
  formatTime,
  formatDate,
  describeNextShiftCountdown,
  formatWorkTimeRange,
} from '../timeHelpers';

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

describe('describeNextShiftCountdown', () => {
  const now = new Date('2026-07-27T09:00:00');

  it('출근 처리된 근무는 "근무 중"으로 표시한다', () => {
    expect(
      describeNextShiftCountdown('2026-07-27', new Date('2026-07-27T08:00:00'), now, true)
    ).toEqual({ label: '근무 중', urgency: 'working' });
  });

  it('미래 근무는 D-N 으로 센다', () => {
    expect(describeNextShiftCountdown('2026-07-30', null, now, false)).toEqual({
      label: 'D-3',
      urgency: 'upcoming',
    });
  });

  // 날짜 경계로 세야 한다 — 시각 차이로 세면 '내일 새벽 근무'가 D-0 으로 접힌다.
  it('내일 근무는 시작 시각과 무관하게 D-1 이다', () => {
    expect(
      describeNextShiftCountdown('2026-07-28', new Date('2026-07-28T02:00:00'), now, false)
    ).toEqual({ label: 'D-1', urgency: 'upcoming' });
  });

  it('오늘 근무가 1시간 안이면 분 단위로 알린다', () => {
    expect(
      describeNextShiftCountdown('2026-07-27', new Date('2026-07-27T09:40:00'), now, false)
    ).toEqual({ label: '40분 후 출근', urgency: 'imminent' });
  });

  it('오늘 근무가 몇 시간 뒤면 시간 단위로 알리고 3시간 이내는 임박으로 본다', () => {
    expect(
      describeNextShiftCountdown('2026-07-27', new Date('2026-07-27T12:00:00'), now, false).urgency
    ).toBe('imminent');
    expect(
      describeNextShiftCountdown('2026-07-27', new Date('2026-07-27T20:00:00'), now, false)
    ).toEqual({ label: '11시간 후 출근', urgency: 'today' });
  });

  it('시작 시각이 지났으면 출근을 재촉한다', () => {
    expect(
      describeNextShiftCountdown('2026-07-27', new Date('2026-07-27T08:00:00'), now, false)
    ).toEqual({ label: '출근 시간이에요', urgency: 'imminent' });
  });

  it('시간이 미정이면 날짜만으로 안내한다', () => {
    expect(describeNextShiftCountdown('2026-07-27', null, now, false)).toEqual({
      label: '오늘 근무',
      urgency: 'today',
    });
  });
});

describe('formatWorkTimeRange', () => {
  const info = (overrides: Record<string, unknown> = {}) => ({
    effectiveStart: '18:00',
    effectiveEnd: '23:00',
    scheduledStart: '18:00',
    scheduledEnd: '23:00',
    isEndNextDay: false,
    ...overrides,
  });

  it('시작–종료 범위로 표기한다', () => {
    expect(formatWorkTimeRange(info())).toBe('18:00 – 23:00');
  });

  // 자정 넘김 표기는 그룹 카드에만 있고 단일 카드·상세에는 없었다.
  it('자정을 넘으면 익일을 병기한다', () => {
    expect(formatWorkTimeRange(info({ effectiveEnd: '02:00', isEndNextDay: true }))).toBe(
      '18:00 – 익일 02:00'
    );
  });

  it('둘 다 미정이면 시간 협의로 표기한다', () => {
    expect(formatWorkTimeRange(info({ effectiveStart: '미정', effectiveEnd: '미정' }))).toBe(
      '시간 협의'
    );
  });

  // '--:--' 는 formatTime 의 파싱 실패 폴백이다 — 사용자에게 그대로 보이면 고장으로 읽힌다.
  it("'--:--' 를 사용자에게 노출하지 않는다", () => {
    expect(formatWorkTimeRange(info({ effectiveEnd: '--:--' }))).toBe('18:00 시작');
    expect(formatWorkTimeRange(info({ effectiveStart: '--:--' }))).toBe('23:00 종료');
  });

  it('예정 시각만 보고 싶으면 useEffective=false 로 고른다', () => {
    expect(
      formatWorkTimeRange(
        info({ effectiveStart: '18:07', scheduledStart: '18:00', scheduledEnd: '23:00' }),
        false
      )
    ).toBe('18:00 – 23:00');
  });
});
