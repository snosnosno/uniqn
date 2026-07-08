/**
 * PAYOUTS 검증 메시지 — 순수(컴포넌트 밖 추출, jest 단언 대상).
 * PayoutStructureEditor 의 % 모드 에러 문구 선택 로직을 단일 소스로 통합(기존 buildPayload·배너 중복 제거).
 */
import type { PrizeCurveResult } from '@/domains/ops';

export const EMPTY_ROW_ERROR = '금액이 비어 있는 행이 있어요';
export const POOL_TOO_SMALL_MSG = '풀이 작아 1,000원/100원 단위 분배가 불가해요';
export const ZERO_PERCENT_ROW_MSG =
  '0 이하인 순위가 있어요. 모든 순위에 0보다 큰 비율을 입력해 주세요';
export const invalidPercentsMsg = (sum: number): string =>
  `비율 합계가 100이 되어야 해요(현재 ${sum}%)`;

/**
 * % 모드 검증 실패 메시지. curve.ok 면 null(에러 없음).
 * ⚠️ 0%인 순위가 있으면 computeAmountsFromPercents 는 (합계가 100이어도) INVALID_PERCENTS 를 반환하는데,
 *   그때 "합계가 100이 되어야 해요(현재 100%)" 는 모순으로 읽히므로 0값행 전용 문구를 우선한다.
 */
export function percentErrorMessage(
  curve: PrizeCurveResult,
  parsedPercents: number[],
  percentSum: number
): string | null {
  if (curve.ok) return null;
  if (curve.reason === 'POOL_TOO_SMALL') return POOL_TOO_SMALL_MSG;
  if (parsedPercents.length > 0 && parsedPercents.some((p) => p <= 0)) {
    return ZERO_PERCENT_ROW_MSG;
  }
  return invalidPercentsMsg(percentSum);
}
