/**
 * 알림 딥링크(applicationId) → 스케줄 착지 판정.
 * 거절/취소된 지원은 스케줄 쿼리에서 제외되므로 매치 실패(missing)가 날 수 있다 —
 * 이때 무반응 대신 안내를 띄우기 위한 응급 판정 (근본 해소는 M1: 쿼리에 rejected 포함).
 */
export type ApplicationDeepLinkResult<T> =
  | { kind: 'open'; schedule: T }
  | { kind: 'missing' }
  | { kind: 'defer' };

export function resolveApplicationDeepLink<T extends { applicationId?: string }>(
  schedules: readonly T[],
  applicationId: string,
  isLoading: boolean,
  error: unknown
): ApplicationDeepLinkResult<T> {
  if (isLoading || error) {
    return { kind: 'defer' };
  }

  const schedule = schedules.find((s) => s.applicationId === applicationId);
  return schedule ? { kind: 'open', schedule } : { kind: 'missing' };
}
