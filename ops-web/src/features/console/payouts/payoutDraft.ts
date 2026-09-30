/**
 * 상금 구조 편집(순수) — 모바일 PayoutStructureEditor 의 buildPayload·합계 규칙.
 * 금액 모드: 0/빈 행은 오류, rank 는 항상 1..N 연속 재부여. % 모드: 현재 풀 기준 환산.
 */
import { EMPTY_ROW_ERROR, percentErrorMessage } from '@/core/components/ops/payoutMessages';
import { parseAmount, reindexRows } from '@/core/components/ops/payoutRows';
import { computeAmountsFromPercents } from '@/core/domains/ops';
import type { PrizeStructureInput } from '@/core/schemas/opsPrize.schema';

export type PayoutMode = 'amount' | 'percent';

export function percentPreview(pool: number, percents: readonly string[]) {
  const parsed = percents.map((p) => parseFloat(p) || 0);
  const sum = Math.round(parsed.reduce((s, p) => s + p, 0) * 100) / 100;
  const curve = computeAmountsFromPercents(pool, parsed);
  return { parsed, sum, curve, error: percentErrorMessage(curve, parsed, sum) };
}

export function buildPayload(
  mode: PayoutMode,
  amounts: readonly string[],
  percents: readonly string[],
  pool: number
): { ok: true; payload: PrizeStructureInput } | { ok: false; error: string } {
  if (mode === 'percent') {
    const { curve, error } = percentPreview(pool, percents);
    if (!curve.ok) return { ok: false, error: error ?? '' };
    return { ok: true, payload: curve.amounts.map((amount, i) => ({ rank: i + 1, amount })) };
  }
  const parsed = amounts.map(parseAmount);
  if (amounts.length === 0 || parsed.some((a) => a <= 0))
    return { ok: false, error: EMPTY_ROW_ERROR };
  return {
    ok: true,
    payload: reindexRows(parsed.map((amount) => ({ amount }))).map((r) => ({
      rank: r.rank,
      amount: r.amount,
    })),
  };
}

/** 화면 합계(참고치 — 저장을 막지 않는다). */
export function displaySum(
  mode: PayoutMode,
  amounts: readonly string[],
  percents: readonly string[],
  pool: number
): number {
  if (mode === 'amount') return amounts.reduce((s, a) => s + parseAmount(a), 0);
  const { curve } = percentPreview(pool, percents);
  return curve.ok ? curve.amounts.reduce((s, a) => s + a, 0) : 0;
}
