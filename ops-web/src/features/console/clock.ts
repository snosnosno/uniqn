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

/**
 * 레벨 알림 — 1분 전 경고·시간 종료·레벨 전환. 진행 중일 때만 울린다(일시정지·시작 전·첫 렌더는 조용히).
 * 레벨은 자동으로 넘어가지 않는다(서버·모바일 모두 운영자가 "다음"을 누른다) — 그래서 00:00 순간의
 * '시간 종료'가 운영자에게 가장 중요한 알림이다.
 */
export type LevelAlert = 'oneMinute' | 'timeUp' | 'levelChange';

export interface ClockSample {
  sort: number;
  remainingSec: number;
  isRunning: boolean;
}

/** 경고를 띄우는 남은 시간(초). */
export const WARN_AT_SEC = 60;

/** 직전 틱 → 이번 틱으로 넘어오며 생긴 알림. 같은 상태가 이어지면 null(한 번만 울린다). */
export function levelAlert(prev: ClockSample | null, next: ClockSample): LevelAlert | null {
  if (!prev || !next.isRunning) return null;
  if (prev.sort !== next.sort) return 'levelChange';
  if (prev.isRunning && prev.remainingSec > 0 && next.remainingSec <= 0) return 'timeUp';
  if (prev.isRunning && prev.remainingSec > WARN_AT_SEC && next.remainingSec <= WARN_AT_SEC) {
    return 'oneMinute';
  }
  return null;
}
