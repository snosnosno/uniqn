import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsPrizeRepository } from '../interfaces/IOpsPrizeRepository';
import type { OpsPrize } from '@/types/ops';
import type { PrizeStructureInput } from '@/schemas/opsPrize.schema';

const TABLE = 'ops_prizes' as const;
const COLUMNS = 'id, tournament_id, rank, amount';

export class SupabaseOpsPrizeRepository implements IOpsPrizeRepository {
  async list(tournamentId: string): Promise<OpsPrize[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .order('rank', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 상금 목록', table: TABLE });
      return (data ?? []).map((r) =>
        toCamelCase<OpsPrize>(r as unknown as Record<string, unknown>)
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 상금 목록', table: TABLE });
    }
  }

  async setStructure(
    tournamentId: string,
    actorId: string,
    prizes: PrizeStructureInput
  ): Promise<{ count: number }> {
    try {
      const { data, error } = await supabase.rpc('ops_set_prize_structure', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
        p_prizes: prizes,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 상금 구조 저장' });
      const r = data as { count: number };
      return { count: r.count };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 상금 구조 저장' });
    }
  }
}
