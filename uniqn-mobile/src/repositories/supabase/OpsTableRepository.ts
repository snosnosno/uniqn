import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { AddTableInput, IOpsTableRepository } from '../interfaces/IOpsTableRepository';
import type { OpsTable, OpsTableStatus, OpsTableLockType } from '@/types/ops';

const TABLE = 'ops_tables' as const;
const COLUMNS =
  'id, tournament_id, table_no, name, status, assigned_staff_id, lock_type, priority, position, created_at, updated_at';

export class SupabaseOpsTableRepository implements IOpsTableRepository {
  async listByTournament(tournamentId: string): Promise<OpsTable[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .order('table_no', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 테이블 목록', table: TABLE });
      return (data ?? []).map((r) => toCamelCase<OpsTable>(r as Record<string, unknown>));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 테이블 목록', table: TABLE });
    }
  }

  async addTable(
    input: AddTableInput,
    actorId: string
  ): Promise<{ tableId: string; tableNo: number }> {
    try {
      const { data, error } = await supabase.rpc('ops_add_table', {
        p_tournament_id: input.tournamentId,
        p_actor_id: actorId,
        p_seat_count: input.seatCount,
        p_name: input.name ?? null,
        p_lock_type: input.lockType,
        p_priority: input.priority ?? null,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 추가' });
      const r = data as { table_id: string; table_no: number };
      return { tableId: r.table_id, tableNo: r.table_no };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 테이블 추가' });
    }
  }

  async setLock(tableId: string, actorId: string, lockType: OpsTableLockType): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_set_table_lock', {
        p_table_id: tableId,
        p_actor_id: actorId,
        p_lock_type: lockType,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 잠금' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 테이블 잠금' });
    }
  }

  async setPriority(tableId: string, actorId: string, priority: number | null): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_set_table_priority', {
        p_table_id: tableId,
        p_actor_id: actorId,
        p_priority: priority,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 우선순위' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 테이블 우선순위' });
    }
  }

  async closeTable(tableId: string, actorId: string, status: OpsTableStatus): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_close_table', {
        p_table_id: tableId,
        p_actor_id: actorId,
        p_status: status,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 닫기' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 테이블 닫기' });
    }
  }
}
