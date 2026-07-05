import type { ItmRatio } from './prizeCurve.types';

/** 표준 페이아웃 곡선표(스펙 §6.2 — ITM 1~10, 각 행 합계 100 고정. jest 가 전 행 단언). */
export const PAYOUT_CURVES: Readonly<Record<number, readonly number[]>> = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
  4: [44, 27, 17, 12],
  5: [40, 25, 16, 11, 8],
  6: [37, 23, 15, 10, 8, 7],
  7: [35, 22, 14, 10, 8, 6, 5],
  8: [33.5, 21, 13.5, 9.5, 7.5, 6, 5, 4],
  9: [32, 20, 13, 9.5, 7.5, 6, 5, 4, 3],
  10: [31, 19.5, 12.5, 9, 7, 5.5, 4.75, 4, 3.5, 3.25],
};

const ITM_CAP = 10;

/**
 * 엔트리 수 × ITM 비율 → 추천 곡선. cap 10(초과 구간은 수동 편집 안내 — Out).
 * ⚠️ 부동소수 함정: 20×0.15=3.0000000000000004 → ceil 오탈. 정수 % 로 환산 후 나눗셈
 *   (정수/100 의 몫이 정수면 IEEE754 정확) 으로 회피.
 */
export function recommendPayoutCurve(entries: number, itmRatio: ItmRatio): number[] {
  const pct = Math.round(itmRatio * 100);
  const itm = Math.max(1, Math.min(ITM_CAP, Math.ceil((entries * pct) / 100)));
  return [...PAYOUT_CURVES[itm]];
}
