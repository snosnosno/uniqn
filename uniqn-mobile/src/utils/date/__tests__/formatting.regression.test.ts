import {
  formatDateKoreanWithDay,
  formatDateShort,
  formatDateWithDay,
  formatRelativeTime,
} from '../formatting';

describe('date/formatting regression', () => {
  it('returns safe fallbacks for invalid inputs', () => {
    expect(() => formatDateShort('invalid-date')).not.toThrow();
    expect(() => formatDateWithDay('invalid-date')).not.toThrow();
    expect(() => formatRelativeTime({ toDate: () => new Date('invalid-date') })).not.toThrow();

    expect(formatDateShort('invalid-date')).toBe('');
    expect(formatDateWithDay('invalid-date')).toBe('');
    expect(formatRelativeTime({ toDate: () => new Date('invalid-date') })).toBe('');
  });

  it('formats serialized timestamp inputs through the shared parser', () => {
    const value = { seconds: 1738022400, nanoseconds: 0 };

    expect(formatDateShort(value)).toBe('1/28');
    expect(formatDateWithDay(value)).toContain('1');
  });

  it('preserves the legacy space before weekday parentheses', () => {
    expect(formatDateWithDay('2025-01-28')).toBe('1월 28일 (화)');
    expect(formatDateKoreanWithDay('2025-01-28')).toBe('2025년 1월 28일 (화)');
  });
});
