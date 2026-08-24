/**
 * 실패 상황 문구 팩토리
 *
 * @description 같은 상황을 화면마다 다르게 말하던 것을 한 곳으로 모은다
 * (감사 2026-08-24 P1-2: "불러오기 실패" 39변이 · "찾을 수 없" 25변이).
 *
 * 문자열 상수를 나열하면 축이 다시 갈라지므로 **함수**로 둔다. 고정하는 축은 넷:
 * | 축 | 결정 |
 * |---|---|
 * | 동사 | 불러오지 못했어요 / 찾을 수 없어요 / 저장하지 못했어요 |
 * | 종결어미 | 해요체 |
 * | 마침표 | 붙이지 않음(토스트·인라인이 주 소비처 — v1 룰 10) |
 * | 후속안내 | `RETRY_HINT` 단일 소스, `{ retry: true }` 로만 붙임 |
 *
 * 대상 이름의 조사는 `josa` 가 고른다 — 호출부에서 '을/를' 을 손으로 쓰지 말 것.
 */
import { josa } from '@/utils/text/josa';

/** 재시도 안내 — 여러 문구가 각자 변주하지 않도록 여기서만 정의한다. */
export const RETRY_HINT = '잠시 후 다시 시도해주세요';

interface FailureOptions {
  /** 재시도 안내를 덧붙일지. 사용자가 다시 눌러 볼 여지가 있을 때만 true. */
  retry?: boolean;
}

function withRetry(message: string, options?: FailureOptions): string {
  return options?.retry ? `${message}. ${RETRY_HINT}` : message;
}

/**
 * 조회 실패.
 *
 * @example loadFailed('공고') // '공고를 불러오지 못했어요'
 * @example loadFailed('스케줄', { retry: true }) // '스케줄을 불러오지 못했어요. 잠시 후 다시 시도해주세요'
 */
export function loadFailed(what: string, options?: FailureOptions): string {
  return withRetry(`${josa(what, '을/를')} 불러오지 못했어요`, options);
}

/**
 * 대상 없음.
 *
 * @example notFound('공고') // '공고를 찾을 수 없어요'
 */
export function notFound(what: string, options?: FailureOptions): string {
  return withRetry(`${josa(what, '을/를')} 찾을 수 없어요`, options);
}

/**
 * 저장 실패.
 *
 * @example saveFailed('정산') // '정산을 저장하지 못했어요'
 */
export function saveFailed(what: string, options?: FailureOptions): string {
  return withRetry(`${josa(what, '을/를')} 저장하지 못했어요`, options);
}
