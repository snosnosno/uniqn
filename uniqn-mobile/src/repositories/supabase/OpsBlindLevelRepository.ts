import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsBlindLevelRepository } from '../interfaces/IOpsBlindLevelRepository';
import type { OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';
import type { OpsBlindLevel } from '@/types/ops';

const TABLE = 'ops_blind_levels' as const;
const COLUMNS =
  'id, tournament_id, level, small_blind, big_blind, ante, duration_sec, is_break, sort, ' +
  'created_at, updated_at';

export class SupabaseOpsBlindLevelRepository implements IOpsBlindLevelRepository {
  async listByTournament(tournamentId: string): Promise<OpsBlindLevel[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .order('sort', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 블라인드 목록', table: TABLE });
      // 생성타입(supabase.ts)에 1c 테이블 미반영(prod 후 MCP gen 정합, §0.5 B5) → unknown 경유 캐스트.
      return (data ?? []).map((r) =>
        toCamelCase<OpsBlindLevel>(r as unknown as Record<string, unknown>)
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 블라인드 목록', table: TABLE });
    }
  }

  async setLevels(
    tournamentId: string,
    actorId: string,
    levels: readonly OpsBlindLevelInput[]
  ): Promise<{ count: number; reanchored: boolean }> {
    try {
      // 앱 camelCase → DB snake_case jsonb (경계 변환). RPC 가 sort 1..N 을 재부여한다.
      const payload = levels.map((l) => ({
        level: l.level,
        small_blind: l.smallBlind,
        big_blind: l.bigBlind,
        ante: l.ante,
        duration_sec: l.durationSec,
        is_break: l.isBreak,
      }));
      const { data, error } = await supabase.rpc('ops_set_blind_levels', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
        p_levels: payload,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 블라인드 설정' });
      const r = data as { count: number; reanchored: boolean };
      return { count: r.count, reanchored: r.reanchored };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 블라인드 설정' });
    }
  }
}
