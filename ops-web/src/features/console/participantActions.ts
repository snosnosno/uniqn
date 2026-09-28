/**
 * 참가자 액션 노출 규칙 — 모바일 `OpsParticipantActionSheet.tsx` 와 같은 조건(순수 함수로 고정).
 * 서버 게이트와 같은 조건으로만 노출한다 — 눌러도 P0001 이 나는 버튼은 노이즈다.
 */
import type { OpsParticipant, OpsTournament } from '@/core/types/ops';

export type ParticipantAction =
  | 'rebuy'
  | 'addon'
  | 'chips'
  | 'bust'
  | 'noShow'
  | 'undoNoShow'
  | 'reenter'
  | 'undoBust'
  | 'openPayouts'
  | 'edit'
  | 'delete'
  | 'unclaim';

type P = Pick<
  OpsParticipant,
  'status' | 'rebuys' | 'addOns' | 'reentries' | 'knockouts' | 'prizeAmount' | 'playerUserId'
>;

export function participantActions(p: P, t: Pick<OpsTournament, 'status'>): ParticipantAction[] {
  const out: ParticipantAction[] = [];
  if (p.status === 'active') out.push('rebuy', 'addon', 'chips', 'bust');
  if (p.status === 'checked_in') out.push('chips', 'noShow');
  if (p.status === 'no_show') out.push('undoNoShow');
  if (p.status === 'busted') {
    out.push('reenter');
    // 완료 대회에서는 탈락 취소를 숨긴다(모바일 H8).
    if (t.status === 'active') out.push('undoBust');
    if (p.prizeAmount !== null && p.prizeAmount !== undefined) out.push('openPayouts');
  }
  out.push('edit'); // 오타는 어느 상태에서도 고친다
  const neverPlayed =
    p.rebuys === 0 &&
    p.addOns === 0 &&
    p.reentries === 0 &&
    p.knockouts === 0 &&
    (p.prizeAmount === null || p.prizeAmount === undefined);
  if ((p.status === 'checked_in' || p.status === 'no_show') && neverPlayed) out.push('delete');
  if (p.playerUserId) out.push('unclaim');
  return out;
}

/** 바운티 대회 여부 — 탈락 시 KO(누가 눌렀나) 지정 단계를 거친다. */
export function isBountyTournament(t: Pick<OpsTournament, 'bountyCost'>): boolean {
  return t.bountyCost !== null && t.bountyCost !== undefined;
}

/** KO 지정 후보 — 진행 중인 다른 참가자. */
export function eliminatorCandidates<T extends Pick<OpsParticipant, 'id' | 'status'>>(
  participants: readonly T[],
  bustedId: string
): T[] {
  return participants.filter((c) => c.status === 'active' && c.id !== bustedId);
}

/** 탈락 결과 안내 — 모바일 handleBustSuccess 문구. */
export function bustResultMessage(r: {
  finishPosition: number;
  prizeAmount: number | null;
  winnerFinalized: boolean;
  winner: { prizeAmount: number | null } | null;
}): { title: string; body: string } {
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  if (r.winnerFinalized && r.winner) {
    return {
      title: '우승 확정',
      body: `1위 · 상금 ${r.winner.prizeAmount !== null ? fmt(r.winner.prizeAmount) : '미설정'}`,
    };
  }
  return {
    title: r.prizeAmount !== null ? 'ITM 종료' : '탈락 처리 완료',
    body: `${r.finishPosition}위${r.prizeAmount !== null ? ` · 상금 ${fmt(r.prizeAmount)}` : ''}`,
  };
}

/**
 * 탈락 예상 순위 — 서버 ops_bust_participant 산식과 같다:
 * 현재 active 수(탈락 대상 포함) 이상에서 **아직 쓰이지 않은 가장 작은 순위**.
 * 탈락 후 active 1명·checked_in 0명이면 남은 1명이 우승 확정된다.
 */
export function predictBust(
  participants: readonly Pick<OpsParticipant, 'status' | 'finishPosition'>[]
): { rank: number; winnerFinalized: boolean } {
  const active = participants.filter((p) => p.status === 'active').length;
  const used = new Set(
    participants
      .map((p) => p.finishPosition)
      .filter((n): n is number => n !== null && n !== undefined)
  );
  let rank = Math.max(1, active);
  while (used.has(rank)) rank += 1;
  const checkedIn = participants.filter((p) => p.status === 'checked_in').length;
  return { rank, winnerFinalized: active - 1 === 1 && checkedIn === 0 };
}
