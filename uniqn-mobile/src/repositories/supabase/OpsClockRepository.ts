import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsClockRepository } from '../interfaces/IOpsClockRepository';
import type { OpsClock } from '@/types/ops';

const TABLE = 'ops_clock' as const;
const COLUMNS =
  'tournament_id, current_level_sort, level_started_at, is_running, paused_remaining_sec, ' +
  'created_at, updated_at';

export class SupabaseOpsClockRepository implements IOpsClockRepository {
  async get(tournamentId: string): Promise<OpsClock | null> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .maybeSingle();
      if (error) handleSupabaseError(error, { operation: 'ops 클럭 조회', table: TABLE });
      // 생성타입(supabase.ts)에 1c 테이블 미반영(prod 후 MCP gen 정합, §0.5 B5) → unknown 경유 캐스트.
      return data ? toCamelCase<OpsClock>(data as unknown as Record<string, unknown>) : null;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 클럭 조회', table: TABLE });
    }
  }

  async start(tournamentId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_clock_start', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 클럭 시작' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 클럭 시작' });
    }
  }

  async pause(tournamentId: string, actorId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_clock_pause', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 클럭 일시정지' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 클럭 일시정지' });
    }
  }

  async setLevel(tournamentId: string, actorId: string, sort: number): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_clock_set_level', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
        p_sort: sort,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 클럭 레벨 이동' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 클럭 레벨 이동' });
    }
  }

  async adjust(tournamentId: string, actorId: string, deltaSec: number): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_clock_adjust', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
        p_delta_sec: deltaSec,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 클럭 보정' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 클럭 보정' });
    }
  }
}
