// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/domains/ops/clock/shouldSyncClock.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
/**
 * 레벨 자동 전환 요청 시점(순수) — 웹 콘솔과 모바일 콘솔이 같은 간격·같은 조건으로 서버에 묻도록 정본에 둔다.
 * 서버 쪽 주체는 fn_ops_clock_roll_forward(마이그 20261004100000)이고, 화면은 00:00 을 보는 즉시
 * ops_clock_sync 로 "끝난 레벨을 따라잡아 달라"고 요청할 뿐이다(크론·전광판 폴링이 안전망).
 */

/**
 * 자동 전환을 다시 요청하기까지 기다리는 시간 — 서버가 아직 "안 끝났다"고 본 경우의 재시도 간격.
 * 화면 시계가 서버보다 조금 앞서면 첫 요청이 0 을 받는다. 그 오차는 대개 1초 안쪽이라 처음 두 번은
 * 1초 뒤에 다시 묻고, 그래도 안 넘어가면(시계가 크게 어긋났거나 서버 장애) 3초 간격으로 늦춘다.
 *
 * 그래도 계속 안 넘어가면 20초 간격까지 늦춘다. 기기 시계가 서버보다 크게 앞서 있으면(수동으로 틀어 둔 기기)
 * 화면은 매 레벨 끝마다 "끝났다"고 보는데 서버는 아니라서, 상한이 없으면 콘솔이 켜진 내내 3초마다 쓰기 RPC 를
 * 보낸다. 이 구간에서는 어차피 매분 크론이 넘기므로 화면 요청을 줄여도 전환이 늦어지지 않는다.
 */
export const CLOCK_SYNC_RETRY_MS = 3000;
export const CLOCK_SYNC_FAST_RETRY_MS = 1000;
export const CLOCK_SYNC_FAST_RETRIES = 2;
/** 이 횟수를 넘겨도 안 넘어가면 느린 간격으로 — 2회(1초) + 8회(3초) ≈ 26초를 빠르게 물은 뒤다. */
export const CLOCK_SYNC_SLOW_AFTER = 10;
export const CLOCK_SYNC_SLOW_RETRY_MS = 20_000;

/**
 * 끝난 레벨을 서버에 따라잡게 할 때인지 — 레벨 시간이 0 이 되면 다음 레벨로 **자동으로** 넘어간다
 * (서버 fn_ops_clock_roll_forward). 콘솔은 00:00 을 보는 즉시 요청하고, 안 넘어갔으면 간격을 두고 다시 묻는다.
 * 마지막 레벨은 넘어갈 곳이 없어 요청하지 않는다(00:00 에서 멈춘다).
 */
export function shouldSyncClock(input: {
  isRunning: boolean;
  isExpired: boolean;
  hasNext: boolean;
  online: boolean;
  nowMs: number;
  lastAttemptMs: number | null;
  /** 이 레벨에서 이미 요청한 횟수 */
  attempts?: number;
  /** 앞 요청이 아직 돌아오지 않았다 */
  inFlight?: boolean;
}): boolean {
  if (!input.isRunning || !input.isExpired || !input.hasNext || !input.online) return false;
  if (input.inFlight) return false;
  if (input.lastAttemptMs === null) return true;
  const attempts = input.attempts ?? 0;
  const wait =
    attempts <= CLOCK_SYNC_FAST_RETRIES
      ? CLOCK_SYNC_FAST_RETRY_MS
      : attempts <= CLOCK_SYNC_SLOW_AFTER
        ? CLOCK_SYNC_RETRY_MS
        : CLOCK_SYNC_SLOW_RETRY_MS;
  return input.nowMs - input.lastAttemptMs >= wait;
}
