/**
 * formatters canonical 배럴 — impeccable v2 §19 스펙 검증
 */

import {
  formatCurrency,
  formatCurrencyCompact,
  formatDuration,
  formatDurationFromMinutes,
  formatISODate,
  formatNumber,
  formatPhoneNumber,
  formatRelative,
  formatShortDate,
  formatTimeOfDay,
  toE164,
} from '../index';

// ─── currency ────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('prefixes with ₩ and uses ko-KR grouping', () => {
    expect(formatCurrency(1234567)).toBe('₩1,234,567');
    expect(formatCurrency(100000)).toBe('₩100,000');
    expect(formatCurrency(1000)).toBe('₩1,000');
  });

  it('returns "₩0" for null/undefined/NaN', () => {
    expect(formatCurrency(null)).toBe('₩0');
    expect(formatCurrency(undefined)).toBe('₩0');
    expect(formatCurrency(Number.NaN)).toBe('₩0');
  });

  it('truncates fractional values (원 단위 절삭)', () => {
    expect(formatCurrency(1000.75)).toBe('₩1,000');
  });

  it('handles zero and negatives', () => {
    expect(formatCurrency(0)).toBe('₩0');
    expect(formatCurrency(-500)).toBe('₩-500');
  });
});

describe('formatCurrencyCompact', () => {
  it('uses 원 suffix without 만 below 10000', () => {
    expect(formatCurrencyCompact(5000)).toBe('5,000원');
    expect(formatCurrencyCompact(9999)).toBe('9,999원');
  });

  it('uses "N만원" for exact multiples of 10000', () => {
    expect(formatCurrencyCompact(10000)).toBe('1만원');
    expect(formatCurrencyCompact(100000)).toBe('10만원');
    expect(formatCurrencyCompact(5000000)).toBe('500만원');
  });

  it('uses "N만 M,MMM원" for partial', () => {
    expect(formatCurrencyCompact(53000)).toBe('5만 3,000원');
    expect(formatCurrencyCompact(123456)).toBe('12만 3,456원');
  });

  it('returns "0원" for null/undefined', () => {
    expect(formatCurrencyCompact(null)).toBe('0원');
    expect(formatCurrencyCompact(undefined)).toBe('0원');
  });
});

describe('formatNumber', () => {
  it('uses ko-KR grouping with no currency symbol', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
  it('returns "0" for null/undefined/NaN', () => {
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
    expect(formatNumber(Number.NaN)).toBe('0');
  });
});

// ─── date ────────────────────────────────────────────────────────────────

describe('formatRelative', () => {
  const now = new Date('2026-04-17T12:00:00+09:00');

  it('"방금 전" within 1 minute', () => {
    expect(formatRelative(new Date(now.getTime() - 30_000), now)).toBe('방금 전');
  });

  it('"N분 전" under 1 hour', () => {
    expect(formatRelative(new Date(now.getTime() - 3 * 60_000), now)).toBe('3분 전');
    expect(formatRelative(new Date(now.getTime() - 59 * 60_000), now)).toBe('59분 전');
  });

  it('"N시간 전" under 24 hours', () => {
    expect(formatRelative(new Date(now.getTime() - 3 * 3600_000), now)).toBe('3시간 전');
    expect(formatRelative(new Date(now.getTime() - 23 * 3600_000), now)).toBe('23시간 전');
  });

  it('"N일 전" within 7 days', () => {
    expect(formatRelative(new Date(now.getTime() - 2 * 86400_000), now)).toBe('2일 전');
    expect(formatRelative(new Date(now.getTime() - 7 * 86400_000), now)).toBe('7일 전');
  });

  it('absolute "M월 D일" beyond 7 days', () => {
    const past = new Date('2026-04-05T12:00:00+09:00');
    expect(formatRelative(past, now)).toBe('4월 5일');
  });

  it('future dates fall back to absolute short date', () => {
    const future = new Date(now.getTime() + 3 * 3600_000);
    expect(formatRelative(future, now)).toMatch(/^\d+월 \d+일$/);
  });

  it('returns empty string for invalid input', () => {
    expect(formatRelative('not-a-date', now)).toBe('');
  });
});

describe('formatShortDate / formatISODate', () => {
  it('formats "M월 D일"', () => {
    expect(formatShortDate(new Date('2026-04-13T00:00:00+09:00'))).toBe('4월 13일');
  });

  it('formats "YYYY-MM-DD"', () => {
    expect(formatISODate(new Date('2026-04-13T00:00:00+09:00'))).toBe('2026-04-13');
  });

  it('returns empty string for invalid input', () => {
    expect(formatShortDate('garbage')).toBe('');
    expect(formatISODate(NaN)).toBe('');
  });
});

describe('formatTimeOfDay', () => {
  it('morning uses 오전', () => {
    const d = new Date();
    d.setHours(9, 5, 0, 0);
    expect(formatTimeOfDay(d)).toBe('오전 9시 05분');
  });

  it('afternoon uses 오후', () => {
    const d = new Date();
    d.setHours(14, 30, 0, 0);
    expect(formatTimeOfDay(d)).toBe('오후 2시 30분');
  });

  it('midnight is 오전 12시 00분', () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    expect(formatTimeOfDay(d)).toBe('오전 12시 00분');
  });

  it('noon is 오후 12시 00분', () => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    expect(formatTimeOfDay(d)).toBe('오후 12시 00분');
  });

  it('returns empty string for invalid input', () => {
    expect(formatTimeOfDay('bad')).toBe('');
  });
});

// ─── duration ────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats hour+minute combos', () => {
    expect(formatDuration(3.5)).toBe('3시간 30분');
    expect(formatDuration(4.25)).toBe('4시간 15분');
  });

  it('drops 0 minutes for whole hours', () => {
    expect(formatDuration(2)).toBe('2시간');
  });

  it('drops hour portion when under 1', () => {
    expect(formatDuration(0.25)).toBe('15분');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0분');
  });

  it('handles null/undefined/NaN → "0분"', () => {
    expect(formatDuration(null)).toBe('0분');
    expect(formatDuration(undefined)).toBe('0분');
    expect(formatDuration(Number.NaN)).toBe('0분');
  });

  it('signs negatives', () => {
    expect(formatDuration(-1.5)).toBe('-1시간 30분');
  });
});

describe('formatDurationFromMinutes', () => {
  it('converts minutes to hour+minute', () => {
    expect(formatDurationFromMinutes(90)).toBe('1시간 30분');
    expect(formatDurationFromMinutes(60)).toBe('1시간');
    expect(formatDurationFromMinutes(15)).toBe('15분');
  });
});

// ─── phone ──────────────────────────────────────────────────────────────

describe('phone re-export', () => {
  it('formatPhoneNumber inserts hyphens for mobile', () => {
    expect(formatPhoneNumber('01012345678')).toBe('010-1234-5678');
  });

  it('formatPhoneNumber handles partial input (live-formatting)', () => {
    expect(formatPhoneNumber('010')).toBe('010');
    expect(formatPhoneNumber('0101234')).toBe('010-1234');
  });

  it('toE164 converts local 010 → +8210', () => {
    expect(toE164('010-1234-5678')).toBe('+821012345678');
  });
});
