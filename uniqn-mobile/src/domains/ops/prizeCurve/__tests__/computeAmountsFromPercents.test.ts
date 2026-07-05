import { computeAmountsFromPercents } from '../computeAmountsFromPercents';

describe('computeAmountsFromPercents', () => {
  it('불변식: 반환 amounts 합계 = pool 정확 일치 (property — 다양한 pool×곡선 전수)', () => {
    const pools = [10_000, 123_000, 999_000, 1_234_567, 50_000_000];
    const curves = [[100], [65, 35], [50, 30, 20], [40, 25, 16, 11, 8]];
    for (const pool of pools) {
      for (const percents of curves) {
        const r = computeAmountsFromPercents(pool, percents);
        if (r.ok) {
          expect(r.amounts.reduce((a, b) => a + b, 0)).toBe(pool);
          expect(r.amounts).toHaveLength(percents.length);
        }
      }
    }
  });
  it('1,000원 내림 + 잔여 1위 가산', () => {
    const r = computeAmountsFromPercents(100_500, [65, 35]);
    // floor(65325/1000)*1000=65000, floor(35175/1000)*1000=35000, 잔여 500 → 1위 가산
    expect(r).toEqual({ ok: true, amounts: [65_500, 35_000] });
  });
  it('1,000원 단위에서 0원 행 발생 → 100원 강등 재시도', () => {
    // pool 3000, [50,30,20] → 1000단위: [1000, 0, 0] → 100단위: [1500, 900, 600] 합=3000
    expect(computeAmountsFromPercents(3_000, [50, 30, 20])).toEqual({
      ok: true,
      amounts: [1_500, 900, 600],
    });
  });
  it('100원 강등에도 0원 행 → POOL_TOO_SMALL', () => {
    expect(computeAmountsFromPercents(300, [50, 30, 20])).toEqual({
      ok: false,
      reason: 'POOL_TOO_SMALL',
    });
  });
  it('pool 0/음수/비정수 → POOL_TOO_SMALL', () => {
    expect(computeAmountsFromPercents(0, [100])).toEqual({ ok: false, reason: 'POOL_TOO_SMALL' });
    expect(computeAmountsFromPercents(-1000, [100])).toEqual({
      ok: false,
      reason: 'POOL_TOO_SMALL',
    });
    expect(computeAmountsFromPercents(10000.5, [100])).toEqual({
      ok: false,
      reason: 'POOL_TOO_SMALL',
    });
  });
  it('INVALID_PERCENTS: 빈 배열·0 이하·합계≠100(±0.01 초과)', () => {
    expect(computeAmountsFromPercents(100_000, [])).toEqual({
      ok: false,
      reason: 'INVALID_PERCENTS',
    });
    expect(computeAmountsFromPercents(100_000, [100, 0])).toEqual({
      ok: false,
      reason: 'INVALID_PERCENTS',
    });
    expect(computeAmountsFromPercents(100_000, [60, 30])).toEqual({
      ok: false,
      reason: 'INVALID_PERCENTS',
    });
  });
  it('부동소수 합계 허용(±0.01): 33.5+21+13.5+9.5+7.5+6+5+4 = 100', () => {
    const r = computeAmountsFromPercents(1_000_000, [33.5, 21, 13.5, 9.5, 7.5, 6, 5, 4]);
    expect(r.ok).toBe(true);
  });
});
