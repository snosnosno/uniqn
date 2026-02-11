/**
 * UNIQN Mobile - date/formatting.ts 테스트
 *
 * @description 날짜 포맷팅 유틸리티 함수들의 단위 테스트
 */

import { Timestamp } from 'firebase/firestore';

import {
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
  formatAppliedDate,
} from '../formatting';

// ============================================================================
// formatDateKorean
// ============================================================================

describe('formatDateKorean', () => {
  it('Date 객체를 한국식 날짜로 포맷한다', () => {
    const date = new Date(2025, 0, 28); // 2025년 1월 28일
    expect(formatDateKorean(date)).toBe('2025년 1월 28일');
  });

  it('ISO 문자열을 한국식 날짜로 포맷한다', () => {
    expect(formatDateKorean('2025-01-28')).toBe('2025년 1월 28일');
  });

  it('Timestamp를 한국식 날짜로 포맷한다', () => {
    const ts = Timestamp.fromDate(new Date(2025, 0, 28));
    expect(formatDateKorean(ts)).toBe('2025년 1월 28일');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatDateKorean(null)).toBe('');
  });

  it('12월 31일을 올바르게 포맷한다', () => {
    const date = new Date(2025, 11, 31);
    expect(formatDateKorean(date)).toBe('2025년 12월 31일');
  });
});

// ============================================================================
// formatDateShort
// ============================================================================

describe('formatDateShort', () => {
  it('Date 객체를 짧은 날짜로 포맷한다', () => {
    const date = new Date(2025, 0, 28);
    expect(formatDateShort(date)).toBe('1/28');
  });

  it('ISO 문자열을 짧은 날짜로 포맷한다', () => {
    expect(formatDateShort('2025-03-05')).toBe('3/5');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatDateShort(null)).toBe('');
  });

  it('12월 1일을 올바르게 포맷한다', () => {
    const date = new Date(2025, 11, 1);
    expect(formatDateShort(date)).toBe('12/1');
  });
});

// ============================================================================
// formatDateWithDay
// ============================================================================

describe('formatDateWithDay', () => {
  it('Date 객체를 요일 포함 날짜로 포맷한다', () => {
    const date = new Date(2025, 0, 28); // 화요일
    expect(formatDateWithDay(date)).toBe('1월 28일 (화)');
  });

  it('ISO 문자열을 요일 포함 날짜로 포맷한다', () => {
    // 2025-01-26은 일요일
    expect(formatDateWithDay('2025-01-26')).toBe('1월 26일 (일)');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatDateWithDay(null)).toBe('');
  });
});

// ============================================================================
// formatDateTime
// ============================================================================

describe('formatDateTime', () => {
  it('Date 객체를 전체 날짜/시간으로 포맷한다', () => {
    const date = new Date(2025, 0, 28, 18, 0);
    expect(formatDateTime(date)).toBe('2025.01.28 18:00');
  });

  it('Timestamp를 전체 날짜/시간으로 포맷한다', () => {
    const ts = Timestamp.fromDate(new Date(2025, 0, 28, 9, 30));
    expect(formatDateTime(ts)).toBe('2025.01.28 09:30');
  });

  it('ISO 문자열을 전체 날짜/시간으로 포맷한다', () => {
    const result = formatDateTime('2025-01-28T18:00:00');
    expect(result).toBe('2025.01.28 18:00');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatDateTime(null)).toBe('');
  });
});

// ============================================================================
// formatTime
// ============================================================================

describe('formatTime', () => {
  it('Date 객체에서 시간만 추출한다', () => {
    const date = new Date(2025, 0, 28, 18, 30);
    expect(formatTime(date)).toBe('18:30');
  });

  it('Timestamp에서 시간만 추출한다', () => {
    const ts = Timestamp.fromDate(new Date(2025, 0, 28, 9, 5));
    expect(formatTime(ts)).toBe('09:05');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatTime(null)).toBe('');
  });

  it('자정을 올바르게 포맷한다', () => {
    const date = new Date(2025, 0, 28, 0, 0);
    expect(formatTime(date)).toBe('00:00');
  });
});

// ============================================================================
// formatRelativeDate
// ============================================================================

describe('formatRelativeDate', () => {
  it('오늘이면 "오늘"을 반환한다', () => {
    const today = new Date();
    expect(formatRelativeDate(today)).toBe('오늘');
  });

  it('내일이면 "내일"을 반환한다', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatRelativeDate(tomorrow)).toBe('내일');
  });

  it('어제이면 "어제"를 반환한다', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDate(yesterday)).toBe('어제');
  });

  it('3일 후면 "3일 후"를 반환한다', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    expect(formatRelativeDate(future)).toBe('3일 후');
  });

  it('5일 전이면 "5일 전"을 반환한다', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(formatRelativeDate(past)).toBe('5일 전');
  });

  it('7일 이내 미래는 "N일 후"를 반환한다', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(formatRelativeDate(future)).toBe('7일 후');
  });

  it('7일 이내 과거는 "N일 전"을 반환한다', () => {
    const past = new Date();
    past.setDate(past.getDate() - 7);
    expect(formatRelativeDate(past)).toBe('7일 전');
  });

  it('8일 이상 차이나면 한국식 날짜를 반환한다', () => {
    const far = new Date();
    far.setDate(far.getDate() + 10);
    const result = formatRelativeDate(far);
    expect(result).toContain('년');
    expect(result).toContain('월');
    expect(result).toContain('일');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatRelativeDate(null)).toBe('');
  });

  it('ISO 문자열도 처리한다', () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(formatRelativeDate(todayStr)).toBe('오늘');
  });
});

// ============================================================================
// getWeekdayKo
// ============================================================================

describe('getWeekdayKo', () => {
  it('일요일은 "일"을 반환한다', () => {
    // 2025-01-26은 일요일
    expect(getWeekdayKo(new Date(2025, 0, 26))).toBe('일');
  });

  it('월요일은 "월"을 반환한다', () => {
    expect(getWeekdayKo(new Date(2025, 0, 27))).toBe('월');
  });

  it('화요일은 "화"를 반환한다', () => {
    expect(getWeekdayKo(new Date(2025, 0, 28))).toBe('화');
  });

  it('수요일은 "수"를 반환한다', () => {
    expect(getWeekdayKo(new Date(2025, 0, 29))).toBe('수');
  });

  it('목요일은 "목"을 반환한다', () => {
    expect(getWeekdayKo(new Date(2025, 0, 30))).toBe('목');
  });

  it('금요일은 "금"을 반환한다', () => {
    expect(getWeekdayKo(new Date(2025, 0, 31))).toBe('금');
  });

  it('토요일은 "토"를 반환한다', () => {
    expect(getWeekdayKo(new Date(2025, 1, 1))).toBe('토');
  });

  it('ISO 문자열도 처리한다', () => {
    expect(getWeekdayKo('2025-01-28')).toBe('화');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(getWeekdayKo(null)).toBe('');
  });
});

// ============================================================================
// formatDate
// ============================================================================

describe('formatDate', () => {
  it('Date 객체를 기본 날짜로 포맷한다', () => {
    const date = new Date(2025, 0, 28);
    expect(formatDate(date)).toBe('2025.01.28');
  });

  it('Timestamp를 기본 날짜로 포맷한다', () => {
    const ts = Timestamp.fromDate(new Date(2025, 0, 28));
    expect(formatDate(ts)).toBe('2025.01.28');
  });

  it('ISO 문자열을 기본 날짜로 포맷한다', () => {
    expect(formatDate('2025-01-28')).toBe('2025.01.28');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatDate(null)).toBe('');
  });
});

// ============================================================================
// formatRelativeTime
// ============================================================================

describe('formatRelativeTime', () => {
  it('1분 미만이면 "방금"을 반환한다', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('방금');
  });

  it('5분 전이면 "5분 전"을 반환한다', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe('5분 전');
  });

  it('30분 전이면 "30분 전"을 반환한다', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(formatRelativeTime(thirtyMinAgo)).toBe('30분 전');
  });

  it('2시간 전이면 "2시간 전"을 반환한다', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe('2시간 전');
  });

  it('3일 전이면 "3일 전"을 반환한다', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toBe('3일 전');
  });

  it('2주 전이면 "2주 전"을 반환한다', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoWeeksAgo)).toBe('2주 전');
  });

  it('2개월 전이면 "2개월 전"을 반환한다', () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoMonthsAgo)).toBe('2개월 전');
  });

  it('1년 이상이면 한국식 날짜를 반환한다', () => {
    const oneYearAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(oneYearAgo);
    expect(result).toContain('년');
  });

  it('Timestamp도 처리한다', () => {
    const ts = Timestamp.fromDate(new Date());
    expect(formatRelativeTime(ts)).toBe('방금');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatRelativeTime(null)).toBe('');
  });
});

// ============================================================================
// formatDateShortWithDay
// ============================================================================

describe('formatDateShortWithDay', () => {
  it('Date 객체를 짧은 날짜+요일로 포맷한다', () => {
    const date = new Date(2025, 0, 28); // 화요일
    expect(formatDateShortWithDay(date)).toBe('1/28(화)');
  });

  it('ISO 문자열을 짧은 날짜+요일로 포맷한다', () => {
    expect(formatDateShortWithDay('2025-01-26')).toBe('1/26(일)');
  });

  it('null이면 "-"를 반환한다', () => {
    expect(formatDateShortWithDay(null)).toBe('-');
  });

  it('유효하지 않은 날짜면 "-"를 반환한다', () => {
    expect(formatDateShortWithDay('invalid-date')).toBe('-');
  });
});

// ============================================================================
// formatDateKoreanWithDay
// ============================================================================

describe('formatDateKoreanWithDay', () => {
  it('Date 객체를 전체 한글 날짜+요일로 포맷한다', () => {
    const date = new Date(2025, 0, 28); // 화요일
    expect(formatDateKoreanWithDay(date)).toBe('2025년 1월 28일 (화)');
  });

  it('ISO 문자열을 전체 한글 날짜+요일로 포맷한다', () => {
    expect(formatDateKoreanWithDay('2025-01-26')).toBe('2025년 1월 26일 (일)');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatDateKoreanWithDay(null)).toBe('');
  });

  it('유효하지 않은 날짜면 빈 문자열을 반환한다', () => {
    expect(formatDateKoreanWithDay('not-a-date')).toBe('');
  });
});

// ============================================================================
// formatAppliedDate
// ============================================================================

describe('formatAppliedDate', () => {
  it('ISO 문자열을 지원 날짜 형식으로 포맷한다', () => {
    const result = formatAppliedDate('2025-01-28T12:00:00.000Z');
    expect(result).toMatch(/1\/28\(.+\)/);
  });

  it('날짜 문자열만으로도 포맷한다', () => {
    const result = formatAppliedDate('2025-01-26');
    expect(result).toBe('1/26(일)');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatAppliedDate(null)).toBe('');
  });

  it('undefined이면 빈 문자열을 반환한다', () => {
    expect(formatAppliedDate(undefined)).toBe('');
  });

  it('빈 문자열이면 빈 문자열을 반환한다', () => {
    expect(formatAppliedDate('')).toBe('');
  });

  it('파싱 불가능한 문자열이면 원본을 반환한다', () => {
    expect(formatAppliedDate('not-a-date')).toBe('not-a-date');
  });
});
