import { describe, expect, it } from 'vitest';
import { EMPTY_ROW_ERROR } from '@/core/components/ops/payoutMessages';
import { prizeStructureSchema } from '@/core/schemas/opsPrize.schema';
import { buildPayload, displaySum } from './payoutDraft';

describe('payoutDraft — 모바일 PayoutStructureEditor 규칙', () => {
  it('금액 모드: 쉼표 허용, rank 1..N 연속, 서버 스키마 통과', () => {
    const r = buildPayload('amount', ['500,000', '300000', '200000'], [], 0);
    expect(r).toEqual({
      ok: true,
      payload: [
        { rank: 1, amount: 500000 },
        { rank: 2, amount: 300000 },
        { rank: 3, amount: 200000 },
      ],
    });
    if (r.ok) expect(prizeStructureSchema.safeParse(r.payload).success).toBe(true);
  });

  it('금액 모드: 빈/0 행이 있으면 오류', () => {
    expect(buildPayload('amount', ['100', ''], [], 0)).toEqual({
      ok: false,
      error: EMPTY_ROW_ERROR,
    });
    expect(buildPayload('amount', [], [], 0)).toEqual({ ok: false, error: EMPTY_ROW_ERROR });
  });

  it('% 모드: 현재 풀 기준 환산, 합이 100 이 아니면 오류', () => {
    const ok = buildPayload('percent', [], ['50', '30', '20'], 1_000_000);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.payload.reduce((s, p) => s + p.amount, 0)).toBeLessThanOrEqual(1_000_000);
    expect(buildPayload('percent', [], ['50', '30'], 1_000_000).ok).toBe(false);
  });

  it('합계', () => {
    expect(displaySum('amount', ['1,000', '500'], [], 0)).toBe(1500);
  });
});
