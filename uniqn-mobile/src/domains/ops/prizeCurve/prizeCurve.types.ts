/** % → 원화 환산 결과. ok=false 면 UI 가 안내(RPC 미도달 — Zod amount≥1 과 정합). */
export type PrizeCurveResult =
  | { ok: true; amounts: number[] }
  | { ok: false; reason: 'POOL_TOO_SMALL' | 'INVALID_PERCENTS' };

/** ITM 비율 프리셋(10/15/20%). */
export type ItmRatio = 0.1 | 0.15 | 0.2;
