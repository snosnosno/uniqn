import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { mapOpsRpcError } from './opsRpcError';
import type { IOpsMonitorRepository } from '../interfaces/IOpsMonitorRepository';
import type { OpsMonitorSnapshot } from '@/types/ops';

/**
 * ops 공개 모니터 Repository (1c-3).
 * 두 RPC 모두 SECDEF — getSnapshot 은 anon GRANT(비-PII 화이트리스트 투영), rotateToken 은 authed.
 * 생성타입(supabase.ts)에 신규 RPC 미반영(prod 후 MCP gen 정합, §0.5 B5) → rpc 는 느슨타입.
 */
export class SupabaseOpsMonitorRepository implements IOpsMonitorRepository {
  async getSnapshot(monitorToken: string): Promise<OpsMonitorSnapshot> {
    try {
      const { data, error } = await supabase.rpc('ops_get_monitor_snapshot', {
        p_monitor_token: monitorToken,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 모니터 스냅샷' });
      // RPC 가 camelCase jsonb(비-PII)로 직접 반환 → toCamelCase 불요.
      return data as unknown as OpsMonitorSnapshot;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 모니터 스냅샷' });
    }
  }

  async rotateToken(tournamentId: string, actorId: string, force = false): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('ops_rotate_monitor_token', {
        p_tournament_id: tournamentId,
        p_actor_id: actorId,
        p_force: force,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 모니터 토큰 발급' });
      return (data as unknown as { monitorToken: string } | null)?.monitorToken ?? '';
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 모니터 토큰 발급' });
    }
  }
}
