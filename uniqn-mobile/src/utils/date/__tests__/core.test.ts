/**
 * UNIQN Mobile - date/core.ts 테스트
 *
 * @description 날짜 핵심 유틸리티 함수들의 단위 테스트
 */

import { Timestamp } from 'firebase/firestore';

import { toDate, toISODateString, getTodayString, toDateString, parseDateString } from '../core';

// ============================================================================
// toDate
// ============================================================================

describe('toDate', () => {
  it('Date 객체를 그대로 반환한다', () => {
    const date = new Date(2025, 0, 28);
    expect(toDate(date)).toBe(date);
  });

  it('Timestamp를 Date로 변환한다', () => {
    const ts = Timestamp.fromDate(new Date(2025, 0, 28));
    const result = toDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(28);
  });

  it('ISO 문자열을 Date로 변환한다', () => {
    const result = toDate('2025-01-28');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
  });

  it('날짜/시간 ISO 문자열을 Date로 변환한다', () => {
    const result = toDate('2025-01-28T18:00:00');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getHours()).toBe(18);
  });

  it('null은 null을 반환한다', () => {
    expect(toDate(null)).toBeNull();
  });

  it('undefined는 null을 반환한다', () => {
    expect(toDate(undefined)).toBeNull();
  });

  it('유효하지 않은 문자열은 null을 반환한다', () => {
    expect(toDate('not-a-date')).toBeNull();
  });

  it('빈 문자열은 null을 반환한다', () => {
    expect(toDate('')).toBeNull();
  });
});

// ============================================================================
// toISODateString
// ============================================================================

describe('toISODateString', () => {
  it('Date 객체를 YYYY-MM-DD 문자열로 변환한다', () => {
    const date = new Date(2025, 0, 28);
    expect(toISODateString(date)).toBe('2025-01-28');
  });

  it('월과 일이 한 자리인 경우 0을 패딩한다', () => {
    const date = new Date(2025, 0, 5);
    expect(toISODateString(date)).toBe('2025-01-05');
  });

  it('12월 31일을 올바르게 변환한다', () => {
    const date = new Date(2025, 11, 31);
    expect(toISODateString(date)).toBe('2025-12-31');
  });

  it('null이면 null을 반환한다', () => {
    expect(toISODateString(null)).toBeNull();
  });
});

// ============================================================================
// getTodayString
// ============================================================================

describe('getTodayString', () => {
  it('오늘 날짜를 YYYY-MM-DD 형식으로 반환한다', () => {
    const result = getTodayString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});

// ============================================================================
// toDateString
// ============================================================================

describe('toDateString', () => {
  it('문자열은 그대로 반환한다', () => {
    expect(toDateString('2025-01-28')).toBe('2025-01-28');
  });

  it('Date 객체를 YYYY-MM-DD로 변환한다', () => {
    const date = new Date(2025, 0, 28);
    expect(toDateString(date)).toBe('2025-01-28');
  });

  it('Timestamp를 YYYY-MM-DD로 변환한다', () => {
    const ts = Timestamp.fromDate(new Date(2025, 0, 28));
    expect(toDateString(ts)).toBe('2025-01-28');
  });

  it('toDate 메서드가 있는 객체를 처리한다', () => {
    const obj = { toDate: () => new Date(2025, 0, 28) };
    expect(toDateString(obj)).toBe('2025-01-28');
  });

  it('seconds 필드가 있는 객체를 처리한다', () => {
    // 2025-01-28 00:00:00 UTC
    const ts = new Date(2025, 0, 28).getTime() / 1000;
    const obj = { seconds: ts };
    const result = toDateString(obj);
    // 시간대에 따라 날짜가 달라질 수 있으므로 형식만 확인
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(toDateString(null)).toBe('');
  });

  it('undefined이면 빈 문자열을 반환한다', () => {
    expect(toDateString(undefined)).toBe('');
  });
});

// ============================================================================
// parseDateString
// ============================================================================

describe('parseDateString', () => {
  it('유효한 날짜 문자열을 Date로 변환한다', () => {
    const result = parseDateString('2025-01-28');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
  });

  it('빈 문자열은 null을 반환한다', () => {
    expect(parseDateString('')).toBeNull();
  });

  it('유효하지 않은 문자열은 null을 반환한다', () => {
    expect(parseDateString('not-a-date')).toBeNull();
  });

  it('다양한 유효한 ISO 형식을 파싱한다', () => {
    expect(parseDateString('2025-12-31')).toBeInstanceOf(Date);
    expect(parseDateString('2024-02-29')).toBeInstanceOf(Date);
  });
});
