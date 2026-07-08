import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type {
  IOpsTournamentRepository,
  CreateOpsTournamentInput,
  UpdateOpsTournamentPatch,
} from '../interfaces/IOpsTournamentRepository';
import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';

const TABLE = 'ops_tournaments' as const;
const COLUMNS =
  'id, owner_id, job_posting_id, name, venue, event_date, game_type, status, seats_per_table, ' +
  'starting_chips, color, buy_in_chips, rebuy_chips, addon_chips, buy_in_cost, fee_cost, ' +
  'rebuy_cost, addon_cost, bounty_cost, registration_open, auto_seat_on_register, ' +
  'reentry_allowed, max_reentries, monitor_token, next_entry_seq, created_at, updated_at';

function rowToTournament(row: Record<string, unknown>): OpsTournament {
  return toCamelCase<OpsTournament>(row);
}

export class SupabaseOpsTournamentRepository implements IOpsTournamentRepository {
  async listForUser(): Promise<OpsTournament[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .order('event_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) handleSupabaseError(error, { operation: 'ops 대회 목록', table: TABLE });
      return (data ?? []).map((r) => rowToTournament(r as unknown as Record<string, unknown>));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 대회 목록', table: TABLE });
    }
  }

  async getById(id: string): Promise<OpsTournament | null> {
    try {
      const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('id', id).maybeSingle();
      if (error) handleSupabaseError(error, { operation: 'ops 대회 조회', table: TABLE });
      return data ? rowToTournament(data as unknown as Record<string, unknown>) : null;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 대회 조회', table: TABLE });
    }
  }

  async listByPosting(jobPostingId: string): Promise<OpsTournament[]> {
    // NULL-SAFE: ops_* 미배포/조회 실패 시 빈 배열 → employer 공고상세 화면 깨짐 방지.
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .order('created_at', { ascending: false });
      if (error) {
        logger.warn('ops 대회 by 공고 목록 조회 실패(무시)', {
          jobPostingId,
          code: (error as { code?: string }).code,
        });
        return [];
      }
      return (data ?? []).map((r) => rowToTournament(r as unknown as Record<string, unknown>));
    } catch {
      logger.warn('ops 대회 by 공고 목록 조회 예외(무시)', { jobPostingId });
      return [];
    }
  }

  async createWithEvent(
    input: CreateOpsTournamentInput,
    actorId: string
  ): Promise<{ tournamentId: string }> {
    try {
      logger.info('ops 대회 생성 시작', { actorId, name: input.name });
      const { data, error } = await supabase.rpc('ops_create_tournament', {
        p_owner_id: actorId,
        p_name: input.name,
        p_venue: input.venue ?? null,
        p_event_date: input.eventDate ?? null,
        p_game_type: input.gameType,
        p_job_posting_id: input.jobPostingId ?? null,
        p_starting_chips: input.startingChips,
        p_seats_per_table: input.seatsPerTable,
        p_config: {
          buy_in_chips: input.config.buyInChips,
          rebuy_chips: input.config.rebuyChips,
          addon_chips: input.config.addonChips,
          buy_in_cost: input.config.buyInCost,
          fee_cost: input.config.feeCost,
          rebuy_cost: input.config.rebuyCost,
          addon_cost: input.config.addonCost,
          bounty_cost: input.config.bountyCost, // 1f: null = 비-바운티(서버 RPC COALESCE 없음)
        },
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 대회 생성' });
      const result = data as { tournament_id: string };
      logger.info('ops 대회 생성 완료', { tournamentId: result.tournament_id });
      return { tournamentId: result.tournament_id };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 대회 생성' });
    }
  }

  async updateTournament(
    id: string,
    actorId: string,
    patch: UpdateOpsTournamentPatch
  ): Promise<void> {
    try {
      const pPatch: Record<string, unknown> = {};
      const set = (key: string, value: unknown) => {
        if (value !== undefined) pPatch[key] = value;
      };
      set('name', patch.name);
      set('venue', patch.venue);
      set('event_date', patch.eventDate);
      set('game_type', patch.gameType);
      set('starting_chips', patch.startingChips);
      set('seats_per_table', patch.seatsPerTable);
      set('color', patch.color);
      set('buy_in_chips', patch.buyInChips);
      set('rebuy_chips', patch.rebuyChips);
      set('addon_chips', patch.addonChips);
      set('buy_in_cost', patch.buyInCost);
      set('fee_cost', patch.feeCost);
      set('rebuy_cost', patch.rebuyCost);
      set('addon_cost', patch.addonCost);

      const { error } = await supabase.rpc('ops_update_tournament', {
        p_tournament_id: id,
        p_actor_id: actorId,
        p_patch: pPatch,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 대회 수정' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 대회 수정' });
    }
  }

  async setStatus(id: string, actorId: string, status: OpsTournamentStatus): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_set_tournament_status', {
        p_tournament_id: id,
        p_actor_id: actorId,
        p_status: status,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 대회 상태 변경' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 대회 상태 변경' });
    }
  }

  async toggleRegistration(id: string, actorId: string, open: boolean): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_toggle_registration', {
        p_tournament_id: id,
        p_actor_id: actorId,
        p_open: open,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 등록 토글' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 등록 토글' });
    }
  }
}
