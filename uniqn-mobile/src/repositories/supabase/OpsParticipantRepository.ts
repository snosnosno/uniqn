import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type {
  IOpsParticipantRepository,
  RegisterParticipantInput,
} from '../interfaces/IOpsParticipantRepository';
import type { OpsParticipant, OpsBustResult, OpsReenterResult } from '@/types/ops';

const TABLE = 'ops_participants' as const;
// view_token 포함 (D8 — 운영자가 라이브 링크 재공유, PIN 재발급 없이). claim_pin_hash 는 절대 미포함.
const COLUMNS =
  'id, tournament_id, entry_number, name, nationality, phone, player_user_id, view_token, status, chips, ' +
  'buy_in_amount, rebuys, add_ons, reentries, finish_position, busted_at, prize_amount, note, ' +
  'created_at, updated_at';

function rowToParticipant(row: Record<string, unknown>): OpsParticipant {
  return toCamelCase<OpsParticipant>(row);
}

export class SupabaseOpsParticipantRepository implements IOpsParticipantRepository {
  async listByTournament(tournamentId: string): Promise<OpsParticipant[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .order('entry_number', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 참가자 목록', table: TABLE });
      return (data ?? []).map((r) => rowToParticipant(r as unknown as Record<string, unknown>));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 참가자 목록', table: TABLE });
    }
  }

  async registerWithEvent(
    input: RegisterParticipantInput,
    actorId: string
  ): Promise<{ participantId: string; entryNumber: number }> {
    try {
      logger.info('ops 참가자 등록 시작', { actorId, tournamentId: input.tournamentId });
      const { data, error } = await supabase.rpc('ops_register_participant', {
        p_tournament_id: input.tournamentId,
        p_actor_id: actorId,
        p_name: input.name,
        p_nationality: input.nationality ?? null,
        p_phone: input.phone ?? null,
        p_buy_in_amount: input.buyInAmount ?? null,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 참가자 등록' });
      const result = data as { participant_id: string; entry_number: number };
      logger.info('ops 참가자 등록 완료', {
        participantId: result.participant_id,
        entryNumber: result.entry_number,
      });
      return { participantId: result.participant_id, entryNumber: result.entry_number };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 참가자 등록' });
    }
  }

  async addRebuy(participantId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_add_rebuy', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 리바이' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 리바이' });
    }
  }

  async addAddon(participantId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_add_addon', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 애드온' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 애드온' });
    }
  }

  async bustParticipant(participantId: string, actorId: string): Promise<OpsBustResult> {
    try {
      const { data, error } = await supabase.rpc('ops_bust_participant', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 탈락 처리' });
      const r = data as {
        finish_position: number;
        prize_amount: number | null;
        winner_finalized: boolean;
        winner: {
          participant_id: string;
          finish_position: number;
          prize_amount: number | null;
        } | null;
      };
      return {
        finishPosition: r.finish_position,
        prizeAmount: r.prize_amount,
        winnerFinalized: r.winner_finalized,
        winner: r.winner
          ? {
              participantId: r.winner.participant_id,
              finishPosition: r.winner.finish_position,
              prizeAmount: r.winner.prize_amount,
            }
          : null,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 탈락 처리' });
    }
  }

  async reenterParticipant(participantId: string, actorId: string): Promise<OpsReenterResult> {
    try {
      const { data, error } = await supabase.rpc('ops_reenter_participant', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 재진입' });
      const r = data as {
        participant_id: string;
        reentries: number;
        status: string;
        seated: boolean;
      };
      return {
        participantId: r.participant_id,
        reentries: r.reentries,
        status: r.status as OpsParticipant['status'],
        seated: r.seated,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 재진입' });
    }
  }
}
