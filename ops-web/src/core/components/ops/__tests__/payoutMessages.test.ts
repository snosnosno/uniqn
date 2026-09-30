// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/components/ops/__tests__/payoutMessages.test.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import { describe, expect, it } from 'vitest';
import {
  percentErrorMessage,
  POOL_TOO_SMALL_MSG,
  ZERO_PERCENT_ROW_MSG,
  invalidPercentsMsg,
} from '../payoutMessages';
import type { PrizeCurveResult } from '@/core/domains/ops';

const invalid: PrizeCurveResult = { ok: false, reason: 'INVALID_PERCENTS' };
const tooSmall: PrizeCurveResult = { ok: false, reason: 'POOL_TOO_SMALL' };
const okCurve: PrizeCurveResult = { ok: true, amounts: [100] };

describe('percentErrorMessage', () => {
  it('curve.ok 면 null(에러 없음)', () => {
    expect(percentErrorMessage(okCurve, [100], 100)).toBeNull();
  });

  it('POOL_TOO_SMALL 을 최우선으로 반환', () => {
    expect(percentErrorMessage(tooSmall, [60, 40], 100)).toBe(POOL_TOO_SMALL_MSG);
  });

  it('0%인 순위가 있으면 합계가 100이어도 0값행 전용 문구(혼란 방지)', () => {
    expect(percentErrorMessage(invalid, [60, 40, 0], 100)).toBe(ZERO_PERCENT_ROW_MSG);
  });

  it('0값행 없이 합계≠100 이면 합계 문구', () => {
    expect(percentErrorMessage(invalid, [60, 30], 90)).toBe(invalidPercentsMsg(90));
  });

  it('빈 배열은 0값행 아님 → 합계 문구(현재 0%)', () => {
    expect(percentErrorMessage(invalid, [], 0)).toBe(invalidPercentsMsg(0));
  });
});
