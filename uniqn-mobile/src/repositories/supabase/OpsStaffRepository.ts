import { supabase } from '@/lib/supabase';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { mapOpsRpcError } from './opsRpcError';
import type { OpsStaff, OpsStaffWorkLogLink } from '@/types/ops';
import type { StaffRole } from '@/types/role';

const TABLE = 'ops_staff' as const;
const COLUMNS =
  'id, tournament_id, staff_id, role, custom_role, staff_name, staff_nickname, source, ' +
  'source_work_log_id, created_at';

/**
 * ops 스태프 로스터(1e) Repository.
 * 읽기는 RLS 필터 SELECT, 쓰기는 SECDEF RPC 5종(공고연결/스냅샷임포트/수동추가/제거/테이블배정).
 * 반환값은 브리프 계약대로 대부분 void — 최신 상태는 listByTournament 재조회로 반영(옵티미스틱 갱신은 상위 계층 책임).
 */
export class SupabaseOpsStaffRepository {
  /** 대회 스태프 로스터 목록 (created_at asc). */
  async listByTournament(tournamentId: string): Promise<OpsStaff[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });
      if (error) handleSupabaseError(error, { operation: 'ops 스태프 로스터 목록', table: TABLE });
      return (data ?? []).map((r) =>
        toCamelCase<OpsStaff>(r as unknown as Record<string, unknown>)
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 스태프 로스터 목록', table: TABLE });
    }
  }

  /**
   * 스태프별 근태 대상 work_log 해석 (결함 ⑦-2). 읽기 전용 — 여기서 쓰지 않는다.
   *
   * 🔴 `ops_staff.source_work_log_id` 를 대신 쓰면 안 된다. import 가
   *    `DISTINCT ON (staff_id) ORDER BY date DESC` 로 **스태프당 최신 1건**만 붙들기 때문에
   *    다일 공고에서 대회 운영일이 아닌 행을 가리킨다. 해석 키는 서버가
   *    (job_posting_id, staff_id, event_date) 로 잡는다.
   * 🔴 평범한 SELECT 로 대신할 수 없다 — RLS 의 "0건" 은 "안 보인다" 일 수 있어
   *    권한없음과 행없음을 구분하지 못한다. SECDEF RPC 가 그 구분을 돌려준다.
   */
  async resolveWorkLogs(p: {
    tournamentId: string;
    actorId: string;
  }): Promise<OpsStaffWorkLogLink[]> {
    try {
      const { data, error } = await supabase.rpc('ops_resolve_staff_work_logs', {
        p_tournament_id: p.tournamentId,
        p_actor_id: p.actorId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 근태 대상 해석' });
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) =>
        toCamelCase<OpsStaffWorkLogLink>(r)
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'ops 근태 대상 해석', table: TABLE });
    }
  }

  /** 대회↔공고 연결/변경/해제(jobPostingId=null). 변경은 대회 소유자 전용(RPC 게이트). */
  async setTournamentPosting(p: {
    tournamentId: string;
    actorId: string;
    jobPostingId: string | null;
  }): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_set_tournament_posting', {
        p_tournament_id: p.tournamentId,
        p_actor_id: p.actorId,
        p_job_posting_id: p.jobPostingId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 대회-공고 연결' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 대회-공고 연결' });
    }
  }

  /** 연결된 공고의 확정 스태프(work_logs SSOT)를 스냅샷 import. date=null 이면 전체 날짜. */
  async importFromPosting(p: {
    tournamentId: string;
    actorId: string;
    date: string | null;
  }): Promise<{ imported: number; skipped: number }> {
    try {
      const { data, error } = await supabase.rpc('ops_import_staff_from_posting', {
        p_tournament_id: p.tournamentId,
        p_actor_id: p.actorId,
        p_date: p.date ?? null,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 스태프 스냅샷 임포트' });
      const r = data as { imported: number; skipped: number };
      return { imported: r.imported, skipped: r.skipped };
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 스태프 스냅샷 임포트' });
    }
  }

  /** 가입자 검색 결과 기반 로스터 수동 추가(source='manual'). */
  async addStaff(p: {
    tournamentId: string;
    actorId: string;
    staffId: string;
    role: StaffRole;
    customRole?: string | null;
  }): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_add_staff', {
        p_tournament_id: p.tournamentId,
        p_actor_id: p.actorId,
        p_staff_id: p.staffId,
        p_role: p.role,
        p_custom_role: p.customRole ?? null,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 스태프 로스터 추가' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 스태프 로스터 추가' });
    }
  }

  /** 로스터 제거 + cascade-clear(배정 중이던 테이블의 assignedStaffId 선해제, RPC 내부 처리). */
  async removeStaff(p: {
    tournamentId: string;
    actorId: string;
    opsStaffId: string;
  }): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_remove_staff', {
        p_tournament_id: p.tournamentId,
        p_actor_id: p.actorId,
        p_ops_staff_id: p.opsStaffId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 스태프 로스터 제거' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 스태프 로스터 제거' });
    }
  }

  /** 딜러 테이블 배정. staffId=null 이면 해제(멱등). move 시맨틱(재배정 시 이전 테이블 자동 해제)은 RPC 내부 처리. */
  async assignTableStaff(p: {
    tournamentId: string;
    actorId: string;
    tableId: string;
    staffId: string | null;
  }): Promise<void> {
    try {
      const { error } = await supabase.rpc('ops_assign_table_staff', {
        p_tournament_id: p.tournamentId,
        p_actor_id: p.actorId,
        p_table_id: p.tableId,
        p_staff_id: p.staffId,
      });
      if (error) mapOpsRpcError(error, { operation: 'ops 테이블 딜러 배정' });
    } catch (error) {
      if (isAppError(error)) throw error;
      mapOpsRpcError(error, { operation: 'ops 테이블 딜러 배정' });
    }
  }
}
