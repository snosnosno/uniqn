import { normalizeToIsoString } from '../core';
import {
  formatDateKoreanWithDay,
  formatDateShort,
  formatDateWithDay,
  formatRelativeTime,
} from '../formatting';

describe('date/formatting regression', () => {
  // Task 2/4 이후: formatDate* 함수는 Firebase shape를 직접 받지 않음.
  // Firebase legacy 입력은 normalizeToIsoString을 거쳐 ISO string으로 정규화된 뒤 포맷 함수에 전달됨.

  it('returns safe fallbacks for invalid inputs', () => {
    expect(() => formatDateShort('invalid-date')).not.toThrow();
    expect(() => formatDateWithDay('invalid-date')).not.toThrow();
    expect(() => formatRelativeTime('invalid-date')).not.toThrow();

    expect(formatDateShort('invalid-date')).toBe('');
    expect(formatDateWithDay('invalid-date')).toBe('');
    expect(formatRelativeTime('invalid-date')).toBe('');
  });

  it('formats serialized timestamp inputs after normalization', () => {
    const value = { seconds: 1738022400, nanoseconds: 0 };
    const iso = normalizeToIsoString(value);

    expect(formatDateShort(iso)).toBe('1/28');
    expect(formatDateWithDay(iso)).toContain('1');
  });

  it('preserves the legacy space before weekday parentheses', () => {
    expect(formatDateWithDay('2025-01-28')).toBe('1월 28일 (화)');
    expect(formatDateKoreanWithDay('2025-01-28')).toBe('2025년 1월 28일 (화)');
  });
});
