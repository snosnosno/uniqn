import type { PrizeCurveResult } from './prizeCurve.types';

const UNITS = [1_000, 100] as const;
const PERCENT_SUM_TOLERANCE = 0.01;

/**
 * % 곡선 → 원화 환산(D1: 서버는 % 를 모름 — 클라 전용 순수함수).
 * 불변식: ok=true 면 amounts 합계 = pool 정확 일치.
 * 알고리즘: 각 floor(pool×pct/100/unit)×unit → 잔여(pool−합)를 1위에 전액 가산.
 * 강등: 1,000원 단위에서 0원 행이 생기면 100원 재시도 → 그래도 0원 행이면 POOL_TOO_SMALL.
 */
export function computeAmountsFromPercents(pool: number, percents: number[]): PrizeCurveResult {
  const sum = percents.reduce((acc, p) => acc + p, 0);
  if (
    percents.length === 0 ||
    percents.some((p) => p <= 0) ||
    Math.abs(sum - 100) > PERCENT_SUM_TOLERANCE
  ) {
    return { ok: false, reason: 'INVALID_PERCENTS' };
  }
  if (!Number.isInteger(pool) || pool <= 0) {
    return { ok: false, reason: 'POOL_TOO_SMALL' };
  }
  for (const unit of UNITS) {
    const floors = percents.map((p) => Math.floor((pool * p) / 100 / unit) * unit);
    if (floors.every((a) => a > 0)) {
      const remainder = pool - floors.reduce((acc, a) => acc + a, 0);
      const amounts = floors.map((a, i) => (i === 0 ? a + remainder : a));
      return { ok: true, amounts };
    }
  }
  return { ok: false, reason: 'POOL_TOO_SMALL' };
}
