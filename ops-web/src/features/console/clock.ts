/**
 * 클럭 표시 계산(순수) — 모바일 ClockControl 과 같은 규칙.
 * 다음 브레이크 카운트다운은 클럭과 같은 앵커·오프셋·틱에서 나온다(드리프트 0).
 */
import { findNextBreakFromLevels } from '@/core/domains/ops';
import type { OpsBlindLevel, OpsClock } from '@/core/types/ops';

export interface ClockView {
  isRunning: boolean;
  isPaused: boolean;
  currentSort: number;
  hasPrev: boolean;
  hasNext: boolean;
  nextLevel: OpsBlindLevel | null;
  breakCountdownSec: number | null;
  statusLabel: string;
  playLabel: string;
}

export function clockView(
  clock: Pick<OpsClock, 'isRunning' | 'pausedRemainingSec' | 'currentLevelSort'> | null,
  levels: readonly OpsBlindLevel[],
  remainingSec: number,
  levelMissing: boolean
): ClockView {
  const isRunning = clock?.isRunning ?? false;
  const isPaused = !isRunning && (clock?.pausedRemainingSec ?? null) !== null;
  const currentSort = clock?.currentLevelSort ?? 1;
  const nextLevel = levels.find((l) => l.sort === currentSort + 1) ?? null;
  const nextBreak = findNextBreakFromLevels(levels, clock?.currentLevelSort ?? null);
  const current = levels.find((l) => l.sort === currentSort) ?? null;
  const breakCountdownSec =
    nextBreak && current && !current.isBreak
      ? Math.max(0, nextBreak.secondsFromLevelStart - current.durationSec + remainingSec)
      : null;
  return {
    isRunning,
    isPaused,
    currentSort,
    hasPrev: currentSort > 1,
    hasNext: currentSort < levels.length,
    nextLevel,
    breakCountdownSec,
    statusLabel: isRunning
      ? '진행 중'
      : isPaused
        ? '일시정지'
        : levelMissing
          ? '레벨 정보 없음'
          : '시작 전',
    playLabel: isRunning ? '일시정지' : isPaused ? '재개' : '시작',
  };
}

// 자동 전환 요청 시점 판정은 정본(모바일과 공유)에 있다 — 여기서는 화면 쪽 이름으로 다시 내보낸다.
export {
  CLOCK_SYNC_FAST_RETRIES,
  CLOCK_SYNC_FAST_RETRY_MS,
  CLOCK_SYNC_RETRY_MS,
  shouldSyncClock,
} from '@/core/domains/ops/clock/shouldSyncClock';

/**
 * 레벨 알림 — 1분 전 경고·레벨 전환·시간 종료. 진행 중일 때만 울린다(일시정지·시작 전·첫 렌더는 조용히).
 * 시간이 끝나면 서버가 다음 레벨로 넘기므로, 곧 넘어갈 상황이면 00:00 에는 울리지 않고 이어지는
 * '레벨 전환'만 울린다(두 소리가 겹치지 않게). '시간 종료'는 **곧 넘어가지 못할 때** 울린다 —
 * 마지막 레벨이거나, 인터넷이 끊겨 전환 요청을 보낼 수 없을 때(안 그러면 00:00 이 소리 없이 지나간다).
 */
export type LevelAlert = 'oneMinute' | 'timeUp' | 'levelChange';

export interface ClockSample {
  sort: number;
  remainingSec: number;
  isRunning: boolean;
}

/** 경고를 띄우는 남은 시간(초). */
export const WARN_AT_SEC = 60;

/**
 * 직전 틱 → 이번 틱으로 넘어오며 생긴 알림. 같은 상태가 이어지면 null(한 번만 울린다).
 * @param willAdvance 00:00 에 곧 다음 레벨로 넘어갈 것인지(다음 레벨이 있고 전환 요청을 보낼 수 있다) —
 *   참이면 00:00 의 '시간 종료'를 내지 않는다(자동 전환음이 대신한다).
 */
export function levelAlert(
  prev: ClockSample | null,
  next: ClockSample,
  willAdvance = false
): LevelAlert | null {
  if (!prev || !next.isRunning) return null;
  if (prev.sort !== next.sort) return 'levelChange';
  if (prev.isRunning && prev.remainingSec > 0 && next.remainingSec <= 0) {
    return willAdvance ? null : 'timeUp';
  }
  if (prev.isRunning && prev.remainingSec > WARN_AT_SEC && next.remainingSec <= WARN_AT_SEC) {
    return 'oneMinute';
  }
  return null;
}

/** 시간 맞추기 입력 상한 — 99:59. 그보다 긴 레벨은 블라인드 탭에서 길이를 바꾼다. */
export const SEEK_MAX_SEC = 99 * 60 + 59;

/**
 * 남은 시간 직접 입력 → 초. `12:30`·`2:05`·`12`(분만) 허용. 범위 밖·형식 오류는 null.
 * 레벨 안 초 단위 시크 — 서버 RPC(ops_clock_adjust)는 임의 초 증감을 받으므로 새 RPC 가 필요 없다.
 */
export function parseClockInput(raw: string): number | null {
  const s = raw.trim().replace('：', ':');
  const m = /^(\d{1,2})(?::([0-5]\d))?$/.exec(s);
  if (!m) return null;
  const sec = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  return sec <= SEEK_MAX_SEC ? sec : null;
}
