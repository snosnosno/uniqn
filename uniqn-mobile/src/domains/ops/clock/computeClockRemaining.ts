/**
 * 블라인드 클럭 남은시간 계산 (순수, 1c-1).
 *
 * 타이머 정확도 = 서버 앵커(level_started_at) + 클라 똑딱(nowMs) + 시각 보정(serverOffsetMs).
 * 폴링 주기와 무관하게 정확하다 — 카운트다운은 매 틱 앵커에서 재계산되며 누적 증가가 아니다.
 * serverOffsetMs 로 기기 시계 오차를 보정해 모든 화면이 서버 시각을 추종한다.
 *
 * 설계 §5 / 계획 §0.5 B2(레벨 미존재 안전폴백)·B7(±보정은 RPC가 앵커/잔여를 조정, 여기선 읽기만).
 */

export type ClockComputeInput = {
  /** 현재 레벨 시작 서버 시각(ISO). 미시작/일시정지면 null 가능 */
  levelStartedAt: string | null;
  /** 현재 레벨 길이(초). 레벨 미존재(스케줄 축소 고아 등)면 null */
  durationSec: number | null;
  isRunning: boolean;
  /** 일시정지 시 저장된 남은 초 */
  pausedRemainingSec: number | null;
  /** (서버 server_now ms) - (수신 시점 Date.now()) — 기기 시계 보정량 */
  serverOffsetMs: number;
  /** 현재 시각 ms (Date.now()) — 매 틱 주입(결정적 테스트 위해 외부 주입) */
  nowMs: number;
};

export type ClockRemaining = {
  /** 남은 초(정수, 0..durationSec) */
  remainingSec: number;
  /** 레벨 시간 소진 여부 */
  isExpired: boolean;
  /** 현재 sort 의 블라인드 레벨 행이 없음(스케줄 축소 등) — UI 는 00:00 안전표시 */
  levelMissing: boolean;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function computeClockRemaining(input: ClockComputeInput): ClockRemaining {
  const { levelStartedAt, durationSec, isRunning, pausedRemainingSec, serverOffsetMs, nowMs } =
    input;

  // 레벨 미존재(durationSec null) → 안전폴백 00:00 (NaN/blank 차단, §0.5 B2)
  if (durationSec === null) {
    return { remainingSec: 0, isExpired: false, levelMissing: true };
  }

  // 일시정지/미시작 → 저장된 잔여(없으면 레벨 전체 길이)
  if (!isRunning) {
    const rem = pausedRemainingSec ?? durationSec;
    return {
      remainingSec: clamp(Math.round(rem), 0, durationSec),
      isExpired: rem <= 0,
      levelMissing: false,
    };
  }

  // running 인데 앵커 부재 = 비정상 → 레벨 전체 길이 표시(시작 대기)
  if (levelStartedAt === null) {
    return { remainingSec: durationSec, isExpired: false, levelMissing: false };
  }

  // running: 서버 시각 추종(기기 오차 보정) → 앵커로부터 경과 → 잔여
  const serverNowMs = nowMs + serverOffsetMs;
  const elapsedSec = (serverNowMs - Date.parse(levelStartedAt)) / 1000;
  const raw = durationSec - elapsedSec;

  return {
    // 카운트다운은 ceil: 8:00 이 만 1초 표시된 뒤 7:59 로 내려간다(0 도달 시 정확히 만료)
    remainingSec: clamp(Math.ceil(raw), 0, durationSec),
    isExpired: raw <= 0,
    levelMissing: false,
  };
}
