// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/repositories/supabase/OpsEventRepository.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import { supabase } from '@/lib/supabase';
import { isAppError } from '@/core/errors/AppError';
import { handleSupabaseError, toCamelCase } from '@/lib/supabaseUtils';
import type { IOpsEventRepository } from '../interfaces/IOpsEventRepository';
import type { OpsEvent } from '@/core/types/ops';

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
