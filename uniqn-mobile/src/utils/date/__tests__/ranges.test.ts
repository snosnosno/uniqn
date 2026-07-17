/**
 * UNIQN Mobile - date/ranges.ts 테스트
 *
 * @description 날짜 범위 유틸리티 함수들의 단위 테스트
 */

import {
  generateDateRange,
  getMonthRange,
  sortDates,
  parseTimeSlot,
  parseTimeSlotToDate,
} from '../ranges';

// ============================================================================
// generateDateRange
// ============================================================================

describe('generateDateRange', () => {
  it('같은 날짜 문자열은 1개의 날짜를 반환한다', () => {
    expect(generateDateRange('2025-01-15', '2025-01-15')).toEqual(['2025-01-15']);
  });

  it('연속 3일 범위를 생성한다', () => {
    expect(generateDateRange('2025-01-15', '2025-01-17')).toEqual([
      '2025-01-15',
      '2025-01-16',
      '2025-01-17',
    ]);
  });

  it('월을 넘어가는 범위를 올바르게 생성한다', () => {
    const result = generateDateRange('2025-01-30', '2025-02-01');
    expect(result).toEqual(['2025-01-30', '2025-01-31', '2025-02-01']);
  });
});

// ============================================================================
// getMonthRange
// ============================================================================

describe('getMonthRange', () => {
  it('1월의 시작/끝 날짜를 반환한다', () => {
    const date = new Date(2025, 0, 15);
    const result = getMonthRange(date);
    expect(result.start).toBe('2025-01-01');
    expect(result.end).toBe('2025-01-31');
  });

  it('2월의 시작/끝 날짜를 반환한다 (평년)', () => {
    const date = new Date(2025, 1, 10);
    const result = getMonthRange(date);
    expect(result.start).toBe('2025-02-01');
    expect(result.end).toBe('2025-02-28');
  });

  it('2월의 시작/끝 날짜를 반환한다 (윤년)', () => {
    const date = new Date(2024, 1, 10);
    const result = getMonthRange(date);
    expect(result.start).toBe('2024-02-01');
    expect(result.end).toBe('2024-02-29');
  });

  it('12월의 시작/끝 날짜를 반환한다', () => {
    const date = new Date(2025, 11, 25);
    const result = getMonthRange(date);
    expect(result.start).toBe('2025-12-01');
    expect(result.end).toBe('2025-12-31');
  });

  it('인자 없이 호출하면 현재 월의 범위를 반환한다', () => {
    const result = getMonthRange();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    expect(result.start).toBe(`${year}-${month}-01`);
  });
});

// ============================================================================
// sortDates
// ============================================================================

describe('sortDates', () => {
  it('날짜를 오름차순으로 정렬한다', () => {
    const dates = ['2025-01-20', '2025-01-15', '2025-01-17'];
    expect(sortDates(dates)).toEqual(['2025-01-15', '2025-01-17', '2025-01-20']);
  });

  it('이미 정렬된 배열은 그대로 반환한다', () => {
    const dates = ['2025-01-15', '2025-01-16', '2025-01-17'];
    expect(sortDates(dates)).toEqual(dates);
  });

  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(sortDates([])).toEqual([]);
  });

  it('단일 요소는 그대로 반환한다', () => {
    expect(sortDates(['2025-01-15'])).toEqual(['2025-01-15']);
  });

  it('원본 배열을 변경하지 않는다', () => {
    const dates = ['2025-01-20', '2025-01-15'];
    sortDates(dates);
    expect(dates).toEqual(['2025-01-20', '2025-01-15']);
  });
});

// ============================================================================
// parseTimeSlot
// ============================================================================

describe('parseTimeSlot', () => {
  it('"09:00~18:00" 형식을 파싱한다', () => {
    const result = parseTimeSlot('09:00~18:00');
    expect(result).toEqual({ start: '09:00', end: '18:00' });
  });

  it('"09:00 - 18:00" 형식을 파싱한다', () => {
    const result = parseTimeSlot('09:00 - 18:00');
    expect(result).toEqual({ start: '09:00', end: '18:00' });
  });

  it('"14:00~22:00" 형식을 파싱한다', () => {
    const result = parseTimeSlot('14:00~22:00');
    expect(result).toEqual({ start: '14:00', end: '22:00' });
  });

  it('"19:00" 단일 시간을 파싱한다', () => {
    const result = parseTimeSlot('19:00');
    expect(result).toEqual({ start: '19:00', end: null });
  });

  it('"9:00" 한 자리 시간도 파싱한다', () => {
    const result = parseTimeSlot('9:00');
    expect(result).toEqual({ start: '9:00', end: null });
  });

  it('"9:00~18:00" 한 자리 시작 시간도 파싱한다', () => {
    const result = parseTimeSlot('9:00~18:00');
    expect(result).toEqual({ start: '9:00', end: '18:00' });
  });

  it('유효하지 않은 형식은 null을 반환한다', () => {
    expect(parseTimeSlot('abc')).toBeNull();
    expect(parseTimeSlot('')).toBeNull();
    expect(parseTimeSlot('19')).toBeNull();
  });
});

// ============================================================================
// parseTimeSlotToDate
// ============================================================================

describe('parseTimeSlotToDate', () => {
  it('시작-종료 시간을 Date 객체로 변환한다', () => {
    const result = parseTimeSlotToDate('09:00~18:00', '2025-01-28');
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.startTime!.getHours()).toBe(9);
    expect(result.endTime!.getHours()).toBe(18);
  });

  it('단일 시간은 startTime만 반환한다', () => {
    const result = parseTimeSlotToDate('19:00', '2025-01-28');
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeNull();
    expect(result.startTime!.getHours()).toBe(19);
  });

  it('자정을 넘어가는 경우 endTime이 다음날이 된다', () => {
    const result = parseTimeSlotToDate('18:00~02:00', '2025-01-28');
    expect(result.startTime!.getDate()).toBe(28);
    expect(result.endTime!.getDate()).toBe(29);
  });

  it('null timeSlot은 null을 반환한다', () => {
    const result = parseTimeSlotToDate(null, '2025-01-28');
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });

  it('빈 dateStr은 null을 반환한다', () => {
    const result = parseTimeSlotToDate('09:00~18:00', '');
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });

  it('파싱 불가능한 timeSlot은 null을 반환한다', () => {
    const result = parseTimeSlotToDate('abc', '2025-01-28');
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });

  it('undefined timeSlot은 null을 반환한다', () => {
    const result = parseTimeSlotToDate(undefined, '2025-01-28');
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });
});
