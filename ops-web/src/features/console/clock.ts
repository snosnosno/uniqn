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
