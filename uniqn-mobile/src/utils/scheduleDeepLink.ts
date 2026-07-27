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

// ============================================================================
// 딥링크 처리 게이트
// ============================================================================

/**
 * 스케줄 탭의 딥링크 처리 상태.
 *
 * 스케줄 탭은 `(tabs)` 스크린이라 한 번 마운트되면 앱 수명 동안 언마운트되지 않는다.
 * 그래서 "처리했음"을 boolean 으로 들고 있으면 두 번째 알림부터 앱을 강제 종료할
 * 때까지 영구히 무반응이 된다 — 처리 단위를 **파라미터 값**으로 잡아야 한다.
 */
export interface DeepLinkGate {
  /** 처리 중이거나 처리 완료한 파라미터 조합 */
  key: string;
  /** stale 캐시 대비 refresh 재검증을 이미 1회 소진했는지 */
  retried: boolean;
  /** 최종 처리(상세 오픈·시트 오픈·안내 토스트)까지 끝났는지 */
  done: boolean;
  /** 지원서의 근무월로 이미 한 번 점프했는지 (무한 점프 방지) */
  jumpedMonth?: boolean;
}

export interface ApplicationDeepLinkParams {
  applicationId?: string;
  cancelApplicationId?: string;
}

/**
 * 딥링크 파라미터 → 처리 단위 키. 처리할 파라미터가 없으면 null.
 * cancelApplicationId 를 앞에 두어 두 파라미터가 동시에 오는 경우도 한 키로 접힌다.
 */
export function buildApplicationDeepLinkKey(params: ApplicationDeepLinkParams): string | null {
  const { applicationId, cancelApplicationId } = params;
  if (!applicationId && !cancelApplicationId) {
    return null;
  }
  return `${cancelApplicationId ?? ''}|${applicationId ?? ''}`;
}

/**
 * 새 키가 들어왔을 때 게이트를 어떻게 진행할지 판정한다.
 *
 * - 같은 키를 이미 끝냈으면 통과시키지 않는다(중복 실행 방지).
 * - 키가 바뀌면 retry 기회를 되돌려 새 알림이 온전히 처리되게 한다.
 */
export function advanceDeepLinkGate(
  gate: DeepLinkGate | null,
  key: string
): { next: DeepLinkGate; shouldProcess: boolean } {
  if (gate?.key === key) {
    return { next: gate, shouldProcess: !gate.done };
  }
  return { next: { key, retried: false, done: false }, shouldProcess: true };
}

// ============================================================================
// missing 착지 판정 — 왜 못 찾았는지 구분
// ============================================================================

/** 스케줄 조회에 잡히지 않는 지원 상태. 이 상태면 아무리 찾아도 목록에 없다. */
const INACTIVE_APPLICATION_STATUSES: Record<string, string> = {
  rejected: '이 지원은 아쉽게도 거절되어 일정에 표시되지 않아요.',
  cancelled: '이 지원은 취소되어 일정에서 빠졌어요.',
};

export const DEEP_LINK_APPLICATION_NOT_FOUND_MESSAGE =
  '해당 지원 일정을 찾을 수 없어요. 이미 삭제되었거나 접근 권한이 없을 수 있어요.';

export type MissingApplicationDeepLinkOutcome =
  /** 지원의 근무월이 조회 중인 달과 달라 그 달로 이동해야 한다 */
  | { kind: 'jump-month'; year: number; month: number }
  /** 더 볼 곳이 없다 — 사용자에게 이유를 알린다 */
  | { kind: 'notice'; message: string };

/** 딥링크 판정에 필요한 지원서 최소 형태 */
export interface DeepLinkApplicationLike {
  status?: string;
  jobPostingDate?: string;
  jobPosting?: {
    workDate?: string;
    workDates?: string[];
  };
}

/** 지원서에서 가장 이른 근무일(YYYY-MM-DD)을 뽑는다. 없으면 null. */
function pickEarliestWorkDate(application: DeepLinkApplicationLike): string | null {
  const candidates = [
    ...(application.jobPosting?.workDates ?? []),
    application.jobPostingDate,
    application.jobPosting?.workDate,
  ].filter((date): date is string => typeof date === 'string' && date.length >= 7);

  if (candidates.length === 0) return null;
  return candidates.reduce((earliest, date) => (date < earliest ? date : earliest));
}

/**
 * 월 스코프 조회에서 지원을 못 찾았을 때, 왜 못 찾았는지 판정한다.
 *
 * 기존 동작은 원인과 무관하게 '거절되었거나 취소되어'라는 한 문장을 띄웠다.
 * 다른 달 확정 알림에서 이 문장이 뜨면 **사실과 정반대 안내**가 된다 —
 * 확정됐는데 거절된 줄 알게 되므로 알림의 신뢰를 직접 깎는다.
 */
export function resolveMissingApplicationDeepLink(
  application: DeepLinkApplicationLike | null | undefined,
  currentMonth: { year: number; month: number },
  alreadyJumpedMonth: boolean
): MissingApplicationDeepLinkOutcome {
  if (!application) {
    return { kind: 'notice', message: DEEP_LINK_APPLICATION_NOT_FOUND_MESSAGE };
  }

  const inactiveMessage = application.status
    ? INACTIVE_APPLICATION_STATUSES[application.status]
    : undefined;
  if (inactiveMessage) {
    return { kind: 'notice', message: inactiveMessage };
  }

  const workDate = alreadyJumpedMonth ? null : pickEarliestWorkDate(application);
  if (workDate) {
    const [year, month] = workDate.split('-').map(Number);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      (year !== currentMonth.year || month !== currentMonth.month)
    ) {
      return { kind: 'jump-month', year, month };
    }
  }

  return { kind: 'notice', message: DEEP_LINK_APPLICATION_NOT_FOUND_MESSAGE };
}
