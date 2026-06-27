import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import type { IOpsEventRepository } from '../interfaces/IOpsEventRepository';
import type { OpsEvent } from '@/types/ops';

const TABLE = 'ops_events' as const;
const COLUMNS = 'id, tournament_id, type, actor_id, actor_device, payload, created_at';
const DEFAULT_LIMIT = 100;

export class SupabaseOpsEventRepository implements IOpsEventRepository {
  async listByTournament(tournamentId: string, limit: number = DEFAULT_LIMIT): Promise<OpsEvent[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) handleSupabaseError(error, { operation: 'ops 이벤트 목록', table: TABLE });
      // payload(jsonb)는 toCamelCase 가 최상위 키만 변환 → 내부 키는 원문 유지(감사 로그 표시용).
      return (data ?? []).map((r) =>
        toCamelCase<OpsEvent>(r as unknown as Record<string, unknown>)
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 이벤트 목록', table: TABLE });
    }
  }
}
