/**
 * 레벨 자동 전환 요청 시점(순수) — 웹 콘솔과 모바일 콘솔이 같은 간격·같은 조건으로 서버에 묻도록 정본에 둔다.
 * 서버 쪽 주체는 fn_ops_clock_roll_forward(마이그 20261004100000)이고, 화면은 00:00 을 보는 즉시
 * ops_clock_sync 로 "끝난 레벨을 따라잡아 달라"고 요청할 뿐이다(크론·전광판 폴링이 안전망).
 */

/**
 * 자동 전환을 다시 요청하기까지 기다리는 시간 — 서버가 아직 "안 끝났다"고 본 경우의 재시도 간격.
 * 화면 시계가 서버보다 조금 앞서면 첫 요청이 0 을 받는다. 그 오차는 대개 1초 안쪽이라 처음 두 번은
 * 1초 뒤에 다시 묻고, 그래도 안 넘어가면(시계가 크게 어긋났거나 서버 장애) 3초 간격으로 늦춘다.
 */
export const CLOCK_SYNC_RETRY_MS = 3000;
export const CLOCK_SYNC_FAST_RETRY_MS = 1000;
export const CLOCK_SYNC_FAST_RETRIES = 2;

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
  const wait =
    (input.attempts ?? 0) <= CLOCK_SYNC_FAST_RETRIES
      ? CLOCK_SYNC_FAST_RETRY_MS
      : CLOCK_SYNC_RETRY_MS;
  return input.nowMs - input.lastAttemptMs >= wait;
}
