/**
 * UNIQN Mobile - date/validation.ts 테스트
 *
 * @description 날짜 검증 유틸리티 함수들의 단위 테스트
 */

import {
  isValidTimeFormat,
  isValidDateFormat,
  parseDate,
  isWithinUrgentDateLimit,
  validateDateCount,
  isDuplicateDate,
  dateChecks,
  getDateAfterDays,
} from '../validation';

// ============================================================================
// isValidTimeFormat
// ============================================================================

describe('isValidTimeFormat', () => {
  it('유효한 시간 형식을 허용한다', () => {
    expect(isValidTimeFormat('00:00')).toBe(true);
    expect(isValidTimeFormat('09:00')).toBe(true);
    expect(isValidTimeFormat('12:30')).toBe(true);
    expect(isValidTimeFormat('18:00')).toBe(true);
    expect(isValidTimeFormat('23:59')).toBe(true);
  });

  it('유효하지 않은 시간 형식을 거부한다', () => {
    expect(isValidTimeFormat('24:00')).toBe(false);
    expect(isValidTimeFormat('25:00')).toBe(false);
    expect(isValidTimeFormat('12:60')).toBe(false);
    expect(isValidTimeFormat('9:00')).toBe(false); // 두 자리 필수
    expect(isValidTimeFormat('abc')).toBe(false);
    expect(isValidTimeFormat('')).toBe(false);
    expect(isValidTimeFormat('12')).toBe(false);
    expect(isValidTimeFormat('12:0')).toBe(false);
  });

  it('경계값을 올바르게 검증한다', () => {
    expect(isValidTimeFormat('00:00')).toBe(true);
    expect(isValidTimeFormat('23:59')).toBe(true);
    expect(isValidTimeFormat('19:00')).toBe(true);
  });
});

// ============================================================================
// isValidDateFormat
// ============================================================================

describe('isValidDateFormat', () => {
  it('유효한 날짜 형식을 허용한다', () => {
    expect(isValidDateFormat('2025-01-28')).toBe(true);
    expect(isValidDateFormat('2024-02-29')).toBe(true);
    expect(isValidDateFormat('2025-12-31')).toBe(true);
  });

  it('유효하지 않은 날짜 형식을 거부한다', () => {
    expect(isValidDateFormat('2025/01/28')).toBe(false);
    expect(isValidDateFormat('2025.01.28')).toBe(false);
    expect(isValidDateFormat('28-01-2025')).toBe(false);
    expect(isValidDateFormat('abc')).toBe(false);
    expect(isValidDateFormat('')).toBe(false);
    expect(isValidDateFormat('2025-1-28')).toBe(false);
    expect(isValidDateFormat('2025-01-8')).toBe(false);
  });
});

// ============================================================================
// parseDate
// ============================================================================

describe('parseDate', () => {
  it('유효한 날짜 문자열을 Date로 변환한다', () => {
    const result = parseDate('2025-01-28');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(0); // 0-indexed
    expect(result!.getDate()).toBe(28);
  });

  it('유효하지 않은 형식은 null을 반환한다', () => {
    expect(parseDate('abc')).toBeNull();
    expect(parseDate('2025/01/28')).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('윤년 2월 29일을 올바르게 변환한다', () => {
    const result = parseDate('2024-02-29');
    expect(result).toBeInstanceOf(Date);
  });
});

// ============================================================================
// isWithinUrgentDateLimit
// ============================================================================

describe('isWithinUrgentDateLimit', () => {
  it('오늘은 긴급 날짜 제한 내에 있다', () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(isWithinUrgentDateLimit(todayStr)).toBe(true);
  });

  it('내일은 긴급 날짜 제한 내에 있다', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const str = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    expect(isWithinUrgentDateLimit(str)).toBe(true);
  });

  it('6일 후는 긴급 날짜 제한 내에 있다', () => {
    const date = new Date();
    date.setDate(date.getDate() + 6);
    const str = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    expect(isWithinUrgentDateLimit(str)).toBe(true);
  });

  it('8일 후는 긴급 날짜 제한을 초과한다', () => {
    const date = new Date();
    date.setDate(date.getDate() + 8);
    const str = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    expect(isWithinUrgentDateLimit(str)).toBe(false);
  });

  it('어제는 긴급 날짜 제한을 초과한다 (과거)', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const str = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    expect(isWithinUrgentDateLimit(str)).toBe(false);
  });

  it('유효하지 않은 날짜는 false를 반환한다', () => {
    expect(isWithinUrgentDateLimit('abc')).toBe(false);
    expect(isWithinUrgentDateLimit('')).toBe(false);
  });
});

// ============================================================================
// validateDateCount
// ============================================================================

describe('validateDateCount', () => {
  it('regular 타입은 1개 날짜만 허용한다', () => {
    expect(validateDateCount('regular', 1)).toBe(true);
    expect(validateDateCount('regular', 0)).toBe(false);
    expect(validateDateCount('regular', 2)).toBe(false);
  });

  it('urgent 타입은 1개 날짜만 허용한다', () => {
    expect(validateDateCount('urgent', 1)).toBe(true);
    expect(validateDateCount('urgent', 0)).toBe(false);
    expect(validateDateCount('urgent', 2)).toBe(false);
  });

  it('tournament 타입은 1~30개 날짜를 허용한다', () => {
    expect(validateDateCount('tournament', 1)).toBe(true);
    expect(validateDateCount('tournament', 15)).toBe(true);
    expect(validateDateCount('tournament', 30)).toBe(true);
    expect(validateDateCount('tournament', 0)).toBe(false);
    expect(validateDateCount('tournament', 31)).toBe(false);
  });

  it('fixed 타입은 false를 반환한다', () => {
    expect(validateDateCount('fixed', 0)).toBe(false);
    expect(validateDateCount('fixed', 1)).toBe(false);
  });
});

// ============================================================================
// isDuplicateDate
// ============================================================================

describe('isDuplicateDate', () => {
  it('기존 날짜에 포함되면 true를 반환한다', () => {
    const existing = ['2025-01-15', '2025-01-16', '2025-01-17'];
    expect(isDuplicateDate(existing, '2025-01-16')).toBe(true);
  });

  it('기존 날짜에 포함되지 않으면 false를 반환한다', () => {
    const existing = ['2025-01-15', '2025-01-16'];
    expect(isDuplicateDate(existing, '2025-01-17')).toBe(false);
  });

  it('빈 배열에서는 false를 반환한다', () => {
    expect(isDuplicateDate([], '2025-01-15')).toBe(false);
  });
});

// ============================================================================
// dateChecks
// ============================================================================

describe('dateChecks', () => {
  describe('isToday', () => {
    it('오늘 날짜는 true를 반환한다', () => {
      expect(dateChecks.isToday(new Date())).toBe(true);
    });

    it('어제 날짜는 false를 반환한다', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateChecks.isToday(yesterday)).toBe(false);
    });

    it('null은 false를 반환한다', () => {
      expect(dateChecks.isToday(null)).toBe(false);
    });

    it('오늘 ISO 문자열은 true를 반환한다', () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(dateChecks.isToday(todayStr)).toBe(true);
    });
  });

  describe('isPast', () => {
    it('과거 날짜는 true를 반환한다', () => {
      const past = new Date(2020, 0, 1);
      expect(dateChecks.isPast(past)).toBe(true);
    });

    it('미래 날짜는 false를 반환한다', () => {
      const future = new Date(2030, 0, 1);
      expect(dateChecks.isPast(future)).toBe(false);
    });

    it('null은 false를 반환한다', () => {
      expect(dateChecks.isPast(null)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('미래 날짜는 true를 반환한다', () => {
      const future = new Date(2030, 0, 1);
      expect(dateChecks.isFuture(future)).toBe(true);
    });

    it('과거 날짜는 false를 반환한다', () => {
      const past = new Date(2020, 0, 1);
      expect(dateChecks.isFuture(past)).toBe(false);
    });

    it('null은 false를 반환한다', () => {
      expect(dateChecks.isFuture(null)).toBe(false);
    });

    it('ISO 문자열도 처리한다', () => {
      expect(dateChecks.isFuture('2030-01-01')).toBe(true);
    });
  });

  describe('isWithinDays', () => {
    it('오늘로부터 N일 이내 날짜는 true를 반환한다', () => {
      const inTwoDays = new Date();
      inTwoDays.setDate(inTwoDays.getDate() + 2);
      expect(dateChecks.isWithinDays(inTwoDays, 7)).toBe(true);
    });

    it('N일을 초과한 날짜는 false를 반환한다', () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 10);
      expect(dateChecks.isWithinDays(farFuture, 7)).toBe(false);
    });

    it('과거 날짜는 false를 반환한다', () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      expect(dateChecks.isWithinDays(past, 7)).toBe(false);
    });

    it('null은 false를 반환한다', () => {
      expect(dateChecks.isWithinDays(null, 7)).toBe(false);
    });
  });
});

// ============================================================================
// getDateAfterDays
// ============================================================================

describe('getDateAfterDays', () => {
  it('0일 후는 오늘 날짜를 반환한다', () => {
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(getDateAfterDays(0)).toBe(expected);
  });

  it('1일 후 날짜를 반환한다', () => {
    const result = getDateAfterDays(1);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('7일 후 날짜를 반환한다', () => {
    const result = getDateAfterDays(7);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const resultDate = new Date(result);
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 7);
    expect(resultDate.getDate()).toBe(expectedDate.getDate());
  });

  it('30일 후 날짜를 반환한다', () => {
    const result = getDateAfterDays(30);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
