import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type {
  IOpsParticipantRepository,
  RegisterParticipantInput,
} from '../interfaces/IOpsParticipantRepository';
import type {
  OpsParticipant,
  OpsBustResult,
  OpsReenterResult,
  OpsUndoBustResult,
  OpsPrizeCorrectionResult,
} from '@/types/ops';

const TABLE = 'ops_participants' as const;
// view_token 포함 (D8 — 운영자가 라이브 링크 재공유, PIN 재발급 없이). claim_pin_hash 는 절대 미포함.
const COLUMNS =
  'id, tournament_id, entry_number, name, nationality, phone, player_user_id, view_token, status, chips, ' +
  'buy_in_amount, rebuys, add_ons, reentries, knockouts, finish_position, busted_at, prize_amount, ' +
  'prize_paid_at, note, created_at, updated_at';

function rowToParticipant(row: Record<string, unknown>): OpsParticipant {
  return toCamelCase<OpsParticipant>(row);
}

// ── RPC 응답 경계 검증 (금전 경로: 탈락취소 칩복원·상금 정정·지급) ──────────────
// 생성타입 미반영으로 인라인 익명 타입 직단언하던 자리를 얇은 parse 로 교체.
// 응답은 snake_case(수동 매핑) → 스키마도 snake_case. passthrough 로 필드 strip 없음.
// 실패 시 오염값이 흐르지 않도록 ValidationError throw(정상 응답 경로는 불변).

const undoBustResponseSchema = z
  .object({
    participant_id: z.string(),
    restored_chips: z.number(),
    status: z.string(),
    seated: z.boolean(),
    table_no: z.number().nullable(),
    seat_no: z.number().nullable(),
  })
  .passthrough();

const prizeCorrectionResponseSchema = z
  .object({
    participant_id: z.string(),
    amount_before: z.number().nullable(),
    amount_after: z.number().nullable(),
  })
  .passthrough();

const setPrizePaidResponseSchema = z
  .object({
    participant_id: z.string(),
    prize_paid_at: z.string().nullable(),
  })
  .passthrough();

/** RPC 응답을 얇은 스키마로 parse. 실패 시 한글 ValidationError. */
function parseOpsRpcResponse<T>(schema: z.ZodType<T>, data: unknown, operation: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: `${operation} 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요`,
    });
  }
  return parsed.data;
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

  async bustParticipant(
    participantId: string,
    actorId: string,
    eliminatorId?: string | null
  ): Promise<OpsBustResult> {
    try {
      const { data, error } = await supabase.rpc('ops_bust_participant', {
        p_participant_id: participantId,
        p_actor_id: actorId,
        p_eliminator_id: eliminatorId ?? null,
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

  async undoBust(participantId: string, actorId: string): Promise<OpsUndoBustResult> {
    try {
      const { data, error } = await supabase.rpc('ops_undo_bust', {
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 탈락 취소' });
      const row = parseOpsRpcResponse(undoBustResponseSchema, data, 'ops 탈락 취소');
      return {
        participantId: row.participant_id,
        restoredChips: row.restored_chips,
        status: row.status as OpsParticipant['status'],
        seated: row.seated,
        tableNo: row.table_no ?? null,
        seatNo: row.seat_no ?? null,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 탈락 취소' });
    }
  }

  async correctPrize(
    participantId: string,
    actorId: string,
    amount: number | null,
    reason?: string | null
  ): Promise<OpsPrizeCorrectionResult> {
    try {
      const { data, error } = await supabase.rpc('ops_correct_participant_prize', {
        p_participant_id: participantId,
        p_actor_id: actorId,
        p_amount: amount,
        p_reason: reason ?? null,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 상금 정정' });
      const row = parseOpsRpcResponse(prizeCorrectionResponseSchema, data, 'ops 상금 정정');
      return {
        participantId: row.participant_id,
        amountBefore: row.amount_before ?? null,
        amountAfter: row.amount_after ?? null,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 상금 정정' });
    }
  }

  async setPrizePaid(
    participantId: string,
    actorId: string,
    paid: boolean
  ): Promise<{ participantId: string; prizePaidAt: string | null }> {
    try {
      const { data, error } = await supabase.rpc('ops_set_prize_paid', {
        p_participant_id: participantId,
        p_actor_id: actorId,
        p_paid: paid,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 상금 지급 마킹' });
      const row = parseOpsRpcResponse(setPrizePaidResponseSchema, data, 'ops 상금 지급 마킹');
      return { participantId: row.participant_id, prizePaidAt: row.prize_paid_at ?? null };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 상금 지급 마킹' });
    }
  }
}
