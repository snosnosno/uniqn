/**
 * 공개(anon) 폴링 화면의 실패 정책 — 모니터(전광판)·플레이어뷰 공용.
 *
 * ## 왜 필요한가 (감사 monitor-01)
 * 종전 두 훅은 `refetchInterval: (q) => q.state.status === 'error' ? false : 4000` +
 * `retry: false` 였다. 그래서 **네트워크가 1초 끊긴 것만으로 폴링이 영구 정지**하고,
 * 화면은 그 상태를 "유효하지 않은 링크"로 표시했다. 전광판은 무인 운영이라
 * 아무도 새로고침하지 않는다 — 한 번 끊기면 대회가 끝날 때까지 멈춘 화면이 남는다.
 *
 * ## 두 실패를 갈라야 한다
 * - **토큰 무효**: 서버 RPC 가 `P0001`(OPS_MONITOR_TOKEN_INVALID / OPS_VIEW_TOKEN_INVALID)로
 *   던지고 `mapOpsRpcError` 가 `BusinessError` 로 바꾼다. 재시도해도 절대 살아나지 않으므로
 *   **즉시 영구 정지**가 맞다.
 * - **그 외(네트워크·서버 일시장애)**: 저절로 회복될 수 있다. 폴링을 유지하되
 *   **연속 실패 횟수에 비례해 간격을 늘려** 죽은 서버를 4초마다 두드리지 않는다.
 *   성공하면 TanStack 이 fetchFailureCount 를 0 으로 되돌려 자동으로 4초 주기로 복귀한다.
 */
import { isAppError } from '@/errors';

/** 정상 폴링 주기(≥3s 하한 — ops 설계문서 §0.5). */
export const PUBLIC_POLL_INTERVAL_MS = 4000;

/** 연속 실패 시 상한. 60s 를 넘기면 무인 전광판의 복귀가 체감상 "안 돌아온다"가 된다. */
export const PUBLIC_POLL_MAX_INTERVAL_MS = 60_000;

/** 네트워크 실패에 한해 허용하는 즉시 재시도 횟수(전역 shouldRetry 를 이 화면에서만 좁힌다). */
export const PUBLIC_POLL_RETRY_LIMIT = 2;

/**
 * 이 에러가 "토큰 자체가 무효"인가.
 *
 * 🔑 `isError` 불리언이 아니라 **에러 코드**로 판정한다. 두 값은 이미 서로 다른 클래스로
 * 만들어지고 있었는데(BusinessError E6119/E6120 vs NetworkError E1xxx) 소비처가
 * 구분을 버리고 있었다.
 */
export function isTokenInvalidError(error: unknown, tokenInvalidCode: string): boolean {
  return isAppError(error) && error.code === tokenInvalidCode;
}

/**
 * 연속 실패 횟수 → 다음 폴링 간격(ms). 4s → 8 → 16 → 32 → 60(상한).
 * @param failureCount TanStack `query.state.fetchFailureCount` (성공 시 0 으로 리셋)
 */
export function publicPollInterval(failureCount: number): number {
  if (failureCount <= 0) return PUBLIC_POLL_INTERVAL_MS;
  const backoff = PUBLIC_POLL_INTERVAL_MS * 2 ** Math.min(failureCount, 4);
  return Math.min(backoff, PUBLIC_POLL_MAX_INTERVAL_MS);
}

/**
 * useQuery 의 `refetchInterval` 콜백 값. 토큰 무효만 `false`(영구 정지).
 */
export function publicRefetchInterval(
  error: unknown,
  failureCount: number,
  tokenInvalidCode: string
): number | false {
  if (isTokenInvalidError(error, tokenInvalidCode)) return false;
  return publicPollInterval(failureCount);
}

/**
 * useQuery 의 `retry` 콜백 값. 토큰 무효는 재시도 0회.
 */
export function publicShouldRetry(
  failureCount: number,
  error: unknown,
  tokenInvalidCode: string
): boolean {
  if (isTokenInvalidError(error, tokenInvalidCode)) return false;
  return failureCount < PUBLIC_POLL_RETRY_LIMIT;
}
