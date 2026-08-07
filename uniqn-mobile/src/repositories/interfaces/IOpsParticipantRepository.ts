import type {
  OpsParticipant,
  OpsBustResult,
  OpsReenterResult,
  OpsUndoBustResult,
  OpsPrizeCorrectionResult,
  OpsChipCountResult,
  OpsNoShowResult,
} from '@/types/ops';

export interface RegisterParticipantInput {
  tournamentId: string;
  name: string;
  nationality?: string;
  phone?: string;
  buyInAmount?: number;
}

/**
 * ops 참가자 Repository.
 * 구현체: SupabaseOpsParticipantRepository. 읽기는 RLS 필터(view_token 포함(D8)·claim_pin_hash 제외), 쓰기는 SECDEF RPC.
 */
export interface IOpsParticipantRepository {
  /** 대회 참가자 목록 (entry_number asc). */
  listByTournament(tournamentId: string): Promise<OpsParticipant[]>;
  registerWithEvent(
    input: RegisterParticipantInput,
    actorId: string
  ): Promise<{ participantId: string; entryNumber: number }>;
  addRebuy(participantId: string, actorId: string): Promise<void>;
  addAddon(participantId: string, actorId: string): Promise<void>;
  bustParticipant(
    participantId: string,
    actorId: string,
    eliminatorId?: string | null
  ): Promise<OpsBustResult>;
  reenterParticipant(participantId: string, actorId: string): Promise<OpsReenterResult>;
  /** 1f: 탈락 취소(bust 직전 상태 복원). */
  undoBust(participantId: string, actorId: string): Promise<OpsUndoBustResult>;
  /** 1f: 상금 정정/회수(amount=null 회수). */
  correctPrize(
    participantId: string,
    actorId: string,
    amount: number | null,
    reason?: string | null
  ): Promise<OpsPrizeCorrectionResult>;
  /** S1 C4: 상금 지급 마킹(paid=true) / 취소(paid=false, undo-first). 멱등. */
  setPrizePaid(
    participantId: string,
    actorId: string,
    paid: boolean
  ): Promise<{ participantId: string; prizePaidAt: string | null }>;
  /** 결함①: 칩 카운트 수동 입력(절대값). active/checked_in 만, 1 이상. 동일값은 서버 no-op. */
  setChips(participantId: string, actorId: string, chips: number): Promise<OpsChipCountResult>;
  /**
   * 결함②: 노쇼 표시(true) / 취소(false, undo-first). 멱등.
   * checked_in ↔ no_show 왕복만 허용 — active 는 서버가 거부한다(그 경로는 bustParticipant).
   */
  setNoShow(participantId: string, actorId: string, noShow: boolean): Promise<OpsNoShowResult>;
  /**
   * 결함⑤: 플레이어 계정 연결(claim) 해제 — `player_user_id = NULL`.
   * 클레임은 플레이어가 8자 PIN 으로 **스스로** 거는 것이라 엔트리를 잘못 짚을 수 있고,
   * 그때 운영자가 풀어줄 경로가 없으면 그 참가자는 영구히 남의 계정에 묶인다.
   * ⚠️ 서버는 이벤트를 append 하지 않는다 — claim 쪽도 마찬가지라 **대칭적으로** 감사 로그가
   *    없다(2026-08-08 prosrc 실측). 감사 추가는 claim/unclaim 을 함께 손대는 별도 후속이다.
   */
  unclaimParticipant(participantId: string, actorId: string): Promise<void>;
}
