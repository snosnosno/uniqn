/**
 * UNIQN Mobile — Supabase WorkSchedule Repository (근무표 읽기)
 *
 * 두 읽기 RPC(get_venue_grid_summary / get_venue_day_slots)를 감싸는 read-only 레포.
 * - 둘 다 SECDEF + 워크스페이스 게이트 + anon REVOKE, venue_span_posting_ids(SSOT) 경유.
 * - 생성타입(supabase.ts)에 신규 RPC 미반영(prod 후 MCP gen 정합) → rpc 는 느슨타입, 응답은
 *   camelCase 로 투영해 반환(job_count→jobCount 등, CLAUDE.md 필드명 규칙).
 */
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { toDateString } from '@/utils/date';
import type { GridSummaryRow } from '@/domains/workSchedule';
import type {
  IWorkScheduleRepository,
  VenueDaySlot,
  SetVenueRoleSalaryInput,
} from '../interfaces/IWorkScheduleRepository';

const TABLE = 'work_logs' as const;

export class SupabaseWorkScheduleRepository implements IWorkScheduleRepository {
  async getVenueGridSummary(
    venueId: string,
    fromDate: string,
    toDate: string
  ): Promise<GridSummaryRow[]> {
    try {
      logger.info('운영처 그리드 요약 조회', { venueId, fromDate, toDate });
      const { data, error } = await supabase.rpc('get_venue_grid_summary', {
        p_venue: venueId,
        p_from: fromDate,
        p_to: toDate,
      });
      if (error) handleSupabaseError(error, { operation: '운영처 그리드 요약 조회', table: TABLE });
      const rows = (data ?? []) as {
        d: string;
        headcount: number | string;
        job_count: number | string;
        required_count: number | string;
      }[];
      // snake_case → camelCase 매핑 + 숫자 정규화(NaN 방어)
      return rows.map((r) => ({
        d: r.d,
        headcount: Number(r.headcount) || 0,
        jobCount: Number(r.job_count) || 0,
        requiredCount: Number(r.required_count) || 0,
      }));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '운영처 그리드 요약 조회', table: TABLE });
    }
  }

  async getVenueDaySlots(venueId: string, date: string): Promise<VenueDaySlot[]> {
    try {
      logger.info('운영처 하루 슬롯 조회', { venueId, date });
      const { data, error } = await supabase.rpc('get_venue_day_slots', {
        p_venue: venueId,
        p_date: date,
      });
      if (error) handleSupabaseError(error, { operation: '운영처 하루 슬롯 조회', table: TABLE });
      const rows = (data ?? []) as Record<string, unknown>[];
      // RPC 가 snake_case(work_log_id/staff_name/time_slot…) 반환 → camelCase 투영.
      return rows.map((row) => toCamelCase<VenueDaySlot>(row));
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '운영처 하루 슬롯 조회', table: TABLE });
    }
  }

  async setVenueSoftTarget(venueId: string, date: string, count: number): Promise<void> {
    try {
      // E5: write 경계에서 날짜키를 YYYY-MM-DD 로 정규화(RPC 도 재정규화하나 클라단 일관성 보장).
      const dateKey = toDateString(date);
      logger.info('운영처 soft-target 설정', { venueId, date: dateKey, count });
      const { error } = await supabase.rpc('set_venue_soft_target', {
        p_venue: venueId,
        p_date: dateKey,
        p_count: count,
      });
      if (error) handleSupabaseError(error, { operation: '운영처 soft-target 설정', table: TABLE });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '운영처 soft-target 설정', table: TABLE });
    }
  }

  async setVenueRoleSalary(venueId: string, input: SetVenueRoleSalaryInput): Promise<void> {
    try {
      logger.info('지점 역할 단가 설정', {
        venueId,
        role: input.role,
        remove: input.salary === null,
      });
      const { error } = await supabase.rpc('set_venue_role_salary', {
        p_venue: venueId,
        p_role: input.role,
        p_custom_role: input.customRole ?? null,
        p_salary_type: input.salary?.type ?? null,
        p_amount: input.salary?.amount ?? null,
      });
      if (error) handleSupabaseError(error, { operation: '지점 역할 단가 설정', table: TABLE });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '지점 역할 단가 설정', table: TABLE });
    }
  }
}
