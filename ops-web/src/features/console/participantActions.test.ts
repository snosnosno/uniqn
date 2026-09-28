import { describe, expect, it } from 'vitest';
import {
  bustResultMessage,
  eliminatorCandidates,
  isBountyTournament,
  participantActions,
  predictBust,
} from './participantActions';

const base = {
  status: 'active' as const,
  rebuys: 0,
  addOns: 0,
  reentries: 0,
  knockouts: 0,
  prizeAmount: null,
  playerUserId: null,
};
const active = { status: 'active' as const };

describe('participantActions — 모바일 액션시트와 같은 노출 조건', () => {
  it('진행 중 참가자: 리바이·애드온·칩·탈락·수정', () => {
    expect(participantActions(base, active)).toEqual(['rebuy', 'addon', 'chips', 'bust', 'edit']);
  });

  it('대기(checked_in, 플레이 이력 0): 칩·노쇼·수정·등록 취소', () => {
    expect(participantActions({ ...base, status: 'checked_in' }, active)).toEqual([
      'chips',
      'noShow',
      'edit',
      'delete',
    ]);
  });

  it('리바이 이력이 있으면 등록 취소 불가', () => {
    expect(participantActions({ ...base, status: 'checked_in', rebuys: 1 }, active)).not.toContain(
      'delete'
    );
  });

  it('노쇼: 노쇼 취소·수정·등록 취소', () => {
    expect(participantActions({ ...base, status: 'no_show' }, active)).toEqual([
      'undoNoShow',
      'edit',
      'delete',
    ]);
  });

  it('탈락(진행 중 대회, ITM): 재진입·탈락 취소·상금 보기', () => {
    expect(participantActions({ ...base, status: 'busted', prizeAmount: 100_000 }, active)).toEqual(
      ['reenter', 'undoBust', 'openPayouts', 'edit']
    );
  });

  it('완료 대회에선 탈락 취소 숨김', () => {
    expect(
      participantActions({ ...base, status: 'busted' }, { status: 'completed' })
    ).not.toContain('undoBust');
  });

  it('플레이어 계정이 연결돼 있으면 연결 해제', () => {
    expect(participantActions({ ...base, playerUserId: 'u' }, active)).toContain('unclaim');
  });
});

describe('바운티·KO', () => {
  it('bountyCost 가 있으면 바운티 대회', () => {
    expect(isBountyTournament({ bountyCost: 10_000 })).toBe(true);
    expect(isBountyTournament({ bountyCost: null })).toBe(false);
  });

  it('KO 후보 = 진행 중인 다른 참가자', () => {
    const list = [
      { id: 'a', status: 'active' as const },
      { id: 'b', status: 'busted' as const },
      { id: 'c', status: 'active' as const },
    ];
    expect(eliminatorCandidates(list, 'a').map((c) => c.id)).toEqual(['c']);
  });
});

describe('bustResultMessage', () => {
  it('우승 확정', () => {
    expect(
      bustResultMessage({
        finishPosition: 2,
        prizeAmount: 50_000,
        winnerFinalized: true,
        winner: { prizeAmount: 100_000 },
      })
    ).toEqual({ title: '우승 확정', body: '1위 · 상금 100,000' });
  });

  it('ITM · 일반', () => {
    expect(
      bustResultMessage({
        finishPosition: 5,
        prizeAmount: 20_000,
        winnerFinalized: false,
        winner: null,
      })
    ).toEqual({ title: 'ITM 종료', body: '5위 · 상금 20,000' });
    expect(
      bustResultMessage({
        finishPosition: 30,
        prizeAmount: null,
        winnerFinalized: false,
        winner: null,
      })
    ).toEqual({ title: '탈락 처리 완료', body: '30위' });
  });
});

describe('predictBust — 서버 ops_bust_participant 산식', () => {
  const p = (status: 'active' | 'busted' | 'checked_in', finishPosition: number | null = null) => ({
    status,
    finishPosition,
  });

  it('생존 5명이면 5위', () => {
    expect(predictBust([p('active'), p('active'), p('active'), p('active'), p('active')])).toEqual({
      rank: 5,
      winnerFinalized: false,
    });
  });

  it('이미 쓰인 순위는 건너뛴다(늦은 등록·재진입 뒤)', () => {
    const list = [p('active'), p('active'), p('active'), p('busted', 3), p('busted', 4)];
    expect(predictBust(list).rank).toBe(5);
  });

  it('2명 남으면 탈락과 동시에 우승 확정(대기 0명일 때만)', () => {
    expect(predictBust([p('active'), p('active')])).toEqual({ rank: 2, winnerFinalized: true });
    expect(predictBust([p('active'), p('active'), p('checked_in')]).winnerFinalized).toBe(false);
  });
});
