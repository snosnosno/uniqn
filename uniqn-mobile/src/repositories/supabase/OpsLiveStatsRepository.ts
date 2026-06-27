import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import type { IOpsLiveStatsRepository } from '../interfaces/IOpsLiveStatsRepository';
import type { OpsLiveStats } from '@/types/ops';

const TABLE = 'ops_live_stats' as const;
const COLUMNS =
  'tournament_id, playing, entries, unique_players, reentries_total, tables_open, ' +
  'seats_total, seats_free, total_chips, average_stack, avg_stack_bb, prize_pool, ' +
  'knockout_pool, updated_at';

export class SupabaseOpsLiveStatsRepository implements IOpsLiveStatsRepository {
  async get(tournamentId: string): Promise<OpsLiveStats | null> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .maybeSingle();
      if (error) handleSupabaseError(error, { operation: 'ops 라이브 통계 조회', table: TABLE });
      // 생성타입(supabase.ts)에 1c 테이블 미반영(prod 후 MCP gen 정합, §0.5 B5) → unknown 경유 캐스트.
      return data ? toCamelCase<OpsLiveStats>(data as unknown as Record<string, unknown>) : null;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 라이브 통계 조회', table: TABLE });
    }
  }
}
