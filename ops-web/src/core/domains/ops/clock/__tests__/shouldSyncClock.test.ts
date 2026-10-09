// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/domains/ops/clock/__tests__/shouldSyncClock.test.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import { describe, expect, it } from 'vitest';
import { shouldSyncClock } from '../shouldSyncClock';

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
