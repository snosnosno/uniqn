import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsSeatRepository } from '../interfaces/IOpsSeatRepository';
import type { OpsSeat } from '@/types/ops';
import type { WaitlistAssignment, SeatAssignment } from '@/domains/ops';

const TABLE = 'ops_seats' as const;
const COLUMNS =
  'id, tournament_id, table_id, table_no, seat_no, participant_id, created_at, updated_at';

export class SupabaseOpsSeatRepository implements IOpsSeatRepository {
  async listByTournament(tournamentId: string): Promise<OpsSeat[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .order('table_no', { ascending: true })
        .order('seat_no', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 좌석 목록', table: TABLE });
      return (data ?? []).map((r) => toCamelCase<OpsSeat>(r as Record<string, unknown>));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 좌석 목록', table: TABLE });
    }
  }

  async assignSeat(seatId: string, participantId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_assign_seat', {
        p_seat_id: seatId,
        p_participant_id: participantId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 좌석 배정' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 좌석 배정' });
    }
  }

  async moveSeat(fromSeatId: string, toSeatId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_move_seat', {
        p_from_seat_id: fromSeatId,
        p_to_seat_id: toSeatId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 좌석 이동' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 좌석 이동' });
    }
  }

  async freeSeat(seatId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_free_seat', {
        p_seat_id: seatId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 좌석 비우기' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 좌석 비우기' });
    }
  }

  async redrawWaitlistFill(
    tournamentId: string,
    actorId: string,
    assignments: readonly WaitlistAssignment[]
  ): Promise<{ moved: number }> {
    try {
      const { data, error } = await supabase.rpc('ops_redraw_waitlist_fill', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
        p_assignments: assignments.map((a) => ({
          seat_id: a.seatId,
          participant_id: a.participantId,
          expected: a.expected,
        })),
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 대기채움 redraw' });
      return { moved: (data as { moved: number }).moved };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 대기채움 redraw' });
    }
  }

  /** 배정 2종(랜덤/칩 드래프트) 전원 재배치. */
  async reseatParticipants(
    tournamentId: string,
    actorId: string,
    assignments: SeatAssignment[],
    mode: 'random_draw' | 'chip_draft'
  ): Promise<{ moved: number; seated: number; mode: string }> {
    try {
      const { data, error } = await supabase.rpc('ops_reseat_participants', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
        p_assignments: assignments.map((a) => ({
          participant_id: a.participantId,
          seat_id: a.seatId,
        })),
        p_mode: mode,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 전원 재배치' });
      const row = data as { moved: number; seated: number; mode: string };
      return { moved: row.moved, seated: row.seated, mode: row.mode };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 전원 재배치' });
    }
  }
}
