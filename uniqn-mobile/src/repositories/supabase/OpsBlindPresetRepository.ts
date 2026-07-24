/**
 * 블라인드 프리셋 Repository (계획 B) — owner 스코프 재사용 템플릿 CRUD.
 * 조회는 RLS owner 스코프가 자동 필터(별도 owner 조건 불요).
 * 저장/삭제는 SECDEF RPC(ops_save_blind_preset / ops_delete_blind_preset) 경유.
 * (interface 는 OpsStaffRepository 선례에 따라 생략 — 클래스 직접 노출.)
 */
import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { OpsBlindPreset } from '@/types/ops';
import type { OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';

const TABLE = 'ops_blind_presets' as const;
const COLUMNS = 'id, owner_id, name, levels, created_at';

/** ops_blind_presets 원행(snake_case). 생성타입 미반영(prod 후 MCP gen 정합) → 로컬 타입. */
interface OpsBlindPresetRow {
  id: string;
  owner_id: string;
  name: string;
  levels: OpsBlindLevelInput[] | null;
  created_at: string;
}

export class SupabaseOpsBlindPresetRepository {
  /** 내 프리셋 목록(최신순). RLS owner 스코프가 소유자 필터를 담당. */
  async listMine(): Promise<OpsBlindPreset[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .order('created_at', { ascending: false });
      if (error)
        handleSupabaseError(error, { operation: 'ops 블라인드 프리셋 목록', table: TABLE });
      const rows = (data ?? []) as unknown as OpsBlindPresetRow[];
      return rows.map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        name: r.name,
        levels: r.levels ?? [],
        createdAt: r.created_at,
      }));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 블라인드 프리셋 목록', table: TABLE });
    }
  }

  /** 프리셋 저장(신규) — 생성된 프리셋 id 반환. levels 는 camelCase jsonb 그대로 저장. */
  async save(
    actorId: string,
    name: string,
    levels: readonly OpsBlindLevelInput[]
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('ops_save_blind_preset', {
        p_actor_id: actorId,
        p_name: name,
        p_levels: levels,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 블라인드 프리셋 저장' });
      return data as string;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 블라인드 프리셋 저장' });
    }
  }

  /** 프리셋 삭제. */
  async remove(actorId: string, presetId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_delete_blind_preset', {
        p_actor_id: actorId,
        p_preset_id: presetId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 블라인드 프리셋 삭제' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 블라인드 프리셋 삭제' });
    }
  }
}
