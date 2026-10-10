import { describe, expect, it } from 'vitest';
import type { OpsBlindLevel } from '@/core/types/ops';
import { clockView } from './clock';

const lv = (sort: number, isBreak = false, durationSec = 1200): OpsBlindLevel =>
  ({
    id: String(sort),
    tournamentId: 't',
    sort,
    level: isBreak ? 0 : sort,
    smallBlind: sort * 100,
    bigBlind: sort * 200,
    ante: 0,
    durationSec,
    isBreak,
  }) as OpsBlindLevel;

const levels = [lv(1), lv(2), lv(3, true, 600), lv(4)];

describe('clockView — 모바일 ClockControl 규칙', () => {
  it('진행 중: 일시정지 버튼, 다음 브레이크까지 = 남은 시간 + 사이 레벨', () => {
    const v = clockView(
      { isRunning: true, pausedRemainingSec: null, currentLevelSort: 1 },
      levels,
      300,
      false
    );
    expect(v.playLabel).toBe('일시정지');
    expect(v.statusLabel).toBe('진행 중');
    // 레벨1 남은 300 + 레벨2 1200
    expect(v.breakCountdownSec).toBe(1500);
    expect(v.hasPrev).toBe(false);
    expect(v.hasNext).toBe(true);
  });

  it('일시정지: 재개 버튼', () => {
    const v = clockView(
      { isRunning: false, pausedRemainingSec: 100, currentLevelSort: 2 },
      levels,
      100,
      false
    );
    expect(v.playLabel).toBe('재개');
    expect(v.statusLabel).toBe('일시정지');
  });

  it('시작 전: 시작 버튼, 휴식 중엔 브레이크 카운트다운 없음', () => {
    expect(clockView(null, levels, 1200, false).playLabel).toBe('시작');
    expect(
      clockView(
        { isRunning: true, pausedRemainingSec: null, currentLevelSort: 3 },
        levels,
        100,
        false
      ).breakCountdownSec
    ).toBeNull();
  });

  it('마지막 레벨이면 다음 없음', () => {
    expect(
      clockView(
        { isRunning: true, pausedRemainingSec: null, currentLevelSort: 4 },
        levels,
        10,
        false
      ).hasNext
    ).toBe(false);
  });
});
