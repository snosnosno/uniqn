import { computeOpsPartialStats } from '../opsStats';
import type { OpsParticipant, OpsTournament } from '@/types/ops';

function createParticipant(
  overrides: Partial<Pick<OpsParticipant, 'status' | 'chips' | 'rebuys' | 'addOns'>> = {}
): Pick<OpsParticipant, 'status' | 'chips' | 'rebuys' | 'addOns'> {
  return { status: 'active', chips: 30000, rebuys: 0, addOns: 0, ...overrides };
}

const cost: Pick<OpsTournament, 'buyInCost' | 'rebuyCost' | 'addonCost'> = {
  buyInCost: 50000,
  rebuyCost: 50000,
  addonCost: 30000,
};

describe('computeOpsPartialStats', () => {
  it('빈 참가자 → 모두 0, averageStack 은 /0 가드로 0', () => {
    expect(computeOpsPartialStats([], cost)).toEqual({
      playing: 0,
      entries: 0,
      totalChips: 0,
      averageStack: 0,
      prizePool: 0,
    });
  });

  it('playing 은 active 만 카운트, entries 는 전체', () => {
    const ps = [
      createParticipant({ status: 'active', chips: 60000 }),
      createParticipant({ status: 'busted', chips: 0 }),
    ];
    const s = computeOpsPartialStats(ps, cost);
    expect(s.playing).toBe(1);
    expect(s.entries).toBe(2);
    expect(s.totalChips).toBe(60000);
    expect(s.averageStack).toBe(60000); // 60000 / 1 playing
  });

  it('averageStack 은 반올림 (총 20001 / 2 → 10001)', () => {
    const ps = [createParticipant({ chips: 10000 }), createParticipant({ chips: 10001 })];
    expect(computeOpsPartialStats(ps, cost).averageStack).toBe(10001);
  });

  it('prizePool = entries*buyInCost + Σrebuys*rebuyCost + ΣaddOns*addonCost', () => {
    const ps = [createParticipant({ rebuys: 1, addOns: 1 }), createParticipant({ rebuys: 2 })];
    // entries 2*50000=100000 + rebuys 3*50000=150000 + addOns 1*30000=30000 = 280000
    expect(computeOpsPartialStats(ps, cost).prizePool).toBe(280000);
  });
});
