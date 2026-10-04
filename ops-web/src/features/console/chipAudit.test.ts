import { describe, expect, it } from 'vitest';
import type { OpsParticipant } from '@/core/types/ops';
import { computeChipAudit } from './chipAudit';

const settings = { startingChips: 30000, rebuyChips: 30000, addonChips: 20000 };

const p = (o: Partial<OpsParticipant>): OpsParticipant => ({
  id: 'id',
  tournamentId: 't',
  entryNumber: 1,
  name: '홍길동',
  viewToken: null,
  status: 'active',
  chips: 30000,
  rebuys: 0,
  addOns: 0,
  reentries: 0,
  knockouts: 0,
  createdAt: '',
  updatedAt: '',
  ...o,
});

describe('computeChipAudit', () => {
  it('참가자가 없으면 전부 0', () => {
    expect(computeChipAudit([], settings)).toEqual({ expected: 0, recorded: 0, diff: 0 });
  });

  it('등록 직후에는 기대와 기록이 같다', () => {
    const audit = computeChipAudit([p({}), p({ status: 'checked_in' })], settings);
    expect(audit).toEqual({ expected: 60000, recorded: 60000, diff: 0 });
  });

  it('리바이·애드온·재진입은 발행 칩에 더한다', () => {
    const audit = computeChipAudit(
      [p({ rebuys: 2, addOns: 1, reentries: 1, chips: 140000 })],
      settings
    );
    // 시작 30000 × (1 + 재진입 1) + 리바이 30000 × 2 + 애드온 20000 × 1
    expect(audit.expected).toBe(140000);
    expect(audit.diff).toBe(0);
  });

  it('탈락자의 칩을 옮겨 적기 전에는 기록이 모자란다', () => {
    const audit = computeChipAudit([p({}), p({ status: 'busted', chips: 0 })], settings);
    expect(audit).toEqual({ expected: 60000, recorded: 30000, diff: -30000 });
  });

  it('탈락자의 칩을 이긴 사람에게 옮겨 적으면 맞는다', () => {
    const audit = computeChipAudit(
      [p({ chips: 60000 }), p({ status: 'busted', chips: 0 })],
      settings
    );
    expect(audit.diff).toBe(0);
  });

  it('노쇼는 기대와 기록 양쪽에서 뺀다', () => {
    const audit = computeChipAudit([p({}), p({ status: 'no_show' })], settings);
    expect(audit).toEqual({ expected: 30000, recorded: 30000, diff: 0 });
  });
});
