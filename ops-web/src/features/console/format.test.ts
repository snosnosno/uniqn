import { describe, expect, it } from 'vitest';
import { chipDeltaLabel, formatBb, formatMmSs, seatLabel } from './format';

describe('console format', () => {
  it('mm:ss · 음수 clamp', () => {
    expect(formatMmSs(754)).toBe('12:34');
    expect(formatMmSs(-3)).toBe('00:00');
  });

  it('BB 소수 1자리', () => {
    expect(formatBb(12.345)).toBe('12.3');
    expect(formatBb(150)).toBe('150');
  });

  it('좌석 표기', () => {
    expect(seatLabel(3, 7)).toBe('T3-7');
  });

  it('칩 증감 — 모바일 ChipCountSheet 와 같은 문구', () => {
    expect(chipDeltaLabel(30000, 45000)).toBe('30,000 → 45,000 · +15,000 (+50%)');
    expect(chipDeltaLabel(30000, 30000)).toBeNull();
    expect(chipDeltaLabel(30000, 0)).toBeNull();
    expect(chipDeltaLabel(0, 1000)).toBe('0 → 1,000 · +1,000');
  });
});
