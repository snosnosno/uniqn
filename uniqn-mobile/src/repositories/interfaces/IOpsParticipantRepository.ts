import type { OpsParticipant } from '@/types/ops';

export interface RegisterParticipantInput {
  tournamentId: string;
  name: string;
  nationality?: string;
  phone?: string;
  buyInAmount?: number;
}

/**
 * ops 참가자 Repository.
 * 구현체: SupabaseOpsParticipantRepository. 읽기는 RLS 필터(claim_token 제외), 쓰기는 SECDEF RPC.
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
}
