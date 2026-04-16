import { formatCompactCount } from './formatCompactCount';

describe('formatCompactCount', () => {
  it('returns the number as-is when below 1000', () => {
    expect(formatCompactCount(0)).toBe('0');
    expect(formatCompactCount(1)).toBe('1');
    expect(formatCompactCount(999)).toBe('999');
  });

  it('formats 1000+ as "1.2k" with single decimal', () => {
    expect(formatCompactCount(1000)).toBe('1k');
    expect(formatCompactCount(1200)).toBe('1.2k');
    expect(formatCompactCount(1250)).toBe('1.3k');
    expect(formatCompactCount(12345)).toBe('12.3k');
    expect(formatCompactCount(999999)).toBe('1000k');
  });

  it('handles undefined and null safely', () => {
    expect(formatCompactCount(undefined)).toBe('0');
    expect(formatCompactCount(null)).toBe('0');
  });

  it('handles negative numbers as absolute value fallback to 0', () => {
    expect(formatCompactCount(-5)).toBe('0');
  });
});
