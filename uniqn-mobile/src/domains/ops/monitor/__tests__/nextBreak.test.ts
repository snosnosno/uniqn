/** 다음 브레이크 카운트다운(C1) — 서버 산식 등가 + 클럭 앵커 드리프트 0 계약. */
import { computeNextBreakRemaining, findNextBreakFromLevels, formatHms } from '../nextBreak';

// 시드: 600s(레벨1) → 900s(레벨2) → 브레이크 300s(레벨3) → 900s(레벨4)
const LEVELS = [
  { sort: 1, level: 1, isBreak: false, durationSec: 600 },
  { sort: 2, level: 2, isBreak: false, durationSec: 900 },
  { sort: 3, level: 3, isBreak: true, durationSec: 300 },
  { sort: 4, level: 4, isBreak: false, durationSec: 900 },
];

describe('findNextBreakFromLevels — 운영자 표면(서버 산식 등가)', () => {
  it('레벨1 기준: 600+900=1500초 뒤 브레이크(sort 3)', () => {
    expect(findNextBreakFromLevels(LEVELS, 1)).toEqual({
      level: 3,
      sort: 3,
      secondsFromLevelStart: 1500,
    });
  });

  it('레벨2 기준: 900초', () => {
    expect(findNextBreakFromLevels(LEVELS, 2)?.secondsFromLevelStart).toBe(900);
  });

  it('브레이크(sort 3) 진행 중: 그 뒤 브레이크 없음 → null', () => {
    expect(findNextBreakFromLevels(LEVELS, 3)).toBeNull();
  });

  it('currentLevelSort null(클럭 미초기화) → null', () => {
    expect(findNextBreakFromLevels(LEVELS, null)).toBeNull();
  });

  it('정렬 비보장 입력도 sort 순으로 계산', () => {
    const shuffled = [LEVELS[2]!, LEVELS[0]!, LEVELS[3]!, LEVELS[1]!];
    expect(findNextBreakFromLevels(shuffled, 1)?.secondsFromLevelStart).toBe(1500);
  });
});

describe('computeNextBreakRemaining — 클럭 동일 앵커 카운트다운', () => {
  const anchor = '2026-07-17T05:00:00.000Z';
  const anchorMs = Date.parse(anchor);
  const base = {
    nextBreak: { level: 3, sort: 3, secondsFromLevelStart: 1500 },
    currentLevelIsBreak: false,
    currentLevelDurationSec: 600,
    levelStartedAt: anchor,
    isRunning: true,
    pausedRemainingSec: null,
    serverOffsetMs: 0,
  };

  it('running: 60초 경과 → 1440초 남음', () => {
    const r = computeNextBreakRemaining({ ...base, nowMs: anchorMs + 60_000 });
    expect(r).toEqual({ kind: 'until', remainingSec: 1440 });
  });

  it('serverOffsetMs 보정 반영(기기 시계 30초 느림 → 서버 기준 경과 사용)', () => {
    const r = computeNextBreakRemaining({
      ...base,
      nowMs: anchorMs + 30_000,
      serverOffsetMs: 30_000,
    });
    expect(r).toEqual({ kind: 'until', remainingSec: 1440 });
  });

  it('일시정지: 저장 잔여 300/600 → 경과 300 → 1200초 남음(틱 없이 정적)', () => {
    const r = computeNextBreakRemaining({
      ...base,
      isRunning: false,
      pausedRemainingSec: 300,
      nowMs: anchorMs + 999_999, // 시계가 흘러도 무시
    });
    expect(r).toEqual({ kind: 'until', remainingSec: 1200 });
  });

  it('시작 전(정지+잔여 없음): 경과 0 → 전체 1500초', () => {
    const r = computeNextBreakRemaining({
      ...base,
      isRunning: false,
      pausedRemainingSec: null,
      nowMs: anchorMs,
    });
    expect(r).toEqual({ kind: 'until', remainingSec: 1500 });
  });

  it('현재 레벨이 브레이크 → inBreak(잔여는 메인 클럭이 표시)', () => {
    const r = computeNextBreakRemaining({
      ...base,
      currentLevelIsBreak: true,
      nowMs: anchorMs,
    });
    expect(r).toEqual({ kind: 'inBreak' });
  });

  it('남은 브레이크 없음 → none(모듈 자동 숨김)', () => {
    const r = computeNextBreakRemaining({ ...base, nextBreak: null, nowMs: anchorMs });
    expect(r).toEqual({ kind: 'none' });
  });

  it('경과가 누적 초를 넘어도 0 클램프(폴링 지연 경계)', () => {
    const r = computeNextBreakRemaining({ ...base, nowMs: anchorMs + 2_000_000 });
    expect(r).toEqual({ kind: 'until', remainingSec: 0 });
  });
});

describe('formatHms', () => {
  it('전광판 관례 HH:MM:SS', () => {
    expect(formatHms(2530)).toBe('00:42:10');
    expect(formatHms(3661)).toBe('01:01:01');
    expect(formatHms(0)).toBe('00:00:00');
    expect(formatHms(-5)).toBe('00:00:00');
  });
});
