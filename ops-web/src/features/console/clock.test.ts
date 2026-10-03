import { describe, expect, it } from 'vitest';
import type { OpsBlindLevel } from '@/core/types/ops';
import { clockView, shouldSyncClock } from './clock';

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

describe('shouldSyncClock — 끝난 레벨 자동 전환 요청 시점', () => {
  const base = {
    isRunning: true,
    isExpired: true,
    hasNext: true,
    online: true,
    nowMs: 10_000,
    lastAttemptMs: null,
  };

  it('진행 중 + 시간 끝 + 다음 레벨 있음 → 바로 요청', () => {
    expect(shouldSyncClock(base)).toBe(true);
  });

  it.each([
    ['시간이 남았으면', { isExpired: false }],
    ['일시정지면', { isRunning: false }],
    ['마지막 레벨이면', { hasNext: false }],
    ['오프라인이면', { online: false }],
  ])('%s 요청하지 않는다', (_label, patch) => {
    expect(shouldSyncClock({ ...base, ...patch })).toBe(false);
  });

  it('처음 두 번의 재시도는 1초 뒤(시계 오차는 대개 1초 안쪽)', () => {
    expect(shouldSyncClock({ ...base, lastAttemptMs: 9_500, attempts: 1 })).toBe(false);
    expect(shouldSyncClock({ ...base, lastAttemptMs: 9_000, attempts: 1 })).toBe(true);
    expect(shouldSyncClock({ ...base, lastAttemptMs: 9_000, attempts: 2 })).toBe(true);
  });

  it('그래도 안 넘어가면 3초 간격으로 늦춘다(요청 폭주 방지)', () => {
    expect(shouldSyncClock({ ...base, lastAttemptMs: 8_000, attempts: 3 })).toBe(false);
    expect(shouldSyncClock({ ...base, lastAttemptMs: 7_000, attempts: 3 })).toBe(true);
  });

  it('앞 요청이 돌아오기 전에는 다시 보내지 않는다', () => {
    expect(shouldSyncClock({ ...base, lastAttemptMs: 1_000, attempts: 5, inFlight: true })).toBe(
      false
    );
  });
});
