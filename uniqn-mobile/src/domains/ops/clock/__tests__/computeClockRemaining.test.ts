import { computeClockRemaining, type ClockComputeInput } from '../computeClockRemaining';

const ANCHOR = '2026-06-27T10:00:00.000Z';
const ANCHOR_MS = Date.parse(ANCHOR);

/** 기본 입력(10분 레벨, running, offset 0) — 케이스별로 일부만 덮어쓴다 */
const base = (over: Partial<ClockComputeInput> = {}): ClockComputeInput => ({
  levelStartedAt: ANCHOR,
  durationSec: 600,
  isRunning: true,
  pausedRemainingSec: null,
  serverOffsetMs: 0,
  nowMs: ANCHOR_MS,
  ...over,
});

describe('computeClockRemaining', () => {
  it('running·앵커 2분 전 → 남은 480초(=8:00), 만료 아님', () => {
    const r = computeClockRemaining(base({ nowMs: ANCHOR_MS + 120_000 }));
    expect(r).toEqual({ remainingSec: 480, isExpired: false, levelMissing: false });
  });

  it('running·앵커가 바로 지금(경과 0) → 레벨 전체 600초', () => {
    const r = computeClockRemaining(base({ nowMs: ANCHOR_MS }));
    expect(r.remainingSec).toBe(600);
    expect(r.isExpired).toBe(false);
  });

  it('일시정지 → 저장된 잔여(120초) 그대로, 똑딱 영향 없음', () => {
    const r = computeClockRemaining(
      base({ isRunning: false, pausedRemainingSec: 120, nowMs: ANCHOR_MS + 999_000 })
    );
    expect(r).toEqual({ remainingSec: 120, isExpired: false, levelMissing: false });
  });

  it('running·앵커 11분 전(만료) → 0초, isExpired', () => {
    const r = computeClockRemaining(base({ nowMs: ANCHOR_MS + 660_000 }));
    expect(r).toEqual({ remainingSec: 0, isExpired: true, levelMissing: false });
  });

  it('기기 시계 3분 빠름(offset -180000)을 보정 → 여전히 480초(300 아님)', () => {
    // 기기는 자기 시계로 앵커+5분이라 믿지만, 서버 기준 실제 경과는 2분
    const r = computeClockRemaining(
      base({ nowMs: ANCHOR_MS + 120_000 + 180_000, serverOffsetMs: -180_000 })
    );
    expect(r.remainingSec).toBe(480);
  });

  it('미시작(levelStartedAt null, !running, pausedRemaining null) → 레벨 전체 길이', () => {
    const r = computeClockRemaining(
      base({ isRunning: false, levelStartedAt: null, pausedRemainingSec: null })
    );
    expect(r.remainingSec).toBe(600);
    expect(r.levelMissing).toBe(false);
  });

  it('레벨 미존재(durationSec null, 스케줄 축소 고아) → 00:00 안전폴백 + levelMissing', () => {
    const r = computeClockRemaining(base({ durationSec: null }));
    expect(r).toEqual({ remainingSec: 0, isExpired: false, levelMissing: true });
  });

  it('경과 부분초(120.3s) → ceil 로 480초 유지(8:00 이 만 1초 표시)', () => {
    const r = computeClockRemaining(base({ nowMs: ANCHOR_MS + 120_300 }));
    expect(r.remainingSec).toBe(480);
  });

  it('기기 시계가 앵커보다 뒤(음수 경과) → 레벨 길이로 상한 clamp', () => {
    const r = computeClockRemaining(base({ nowMs: ANCHOR_MS - 5_000 }));
    expect(r.remainingSec).toBe(600);
    expect(r.isExpired).toBe(false);
  });
});
