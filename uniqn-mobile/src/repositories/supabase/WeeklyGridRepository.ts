/**
 * UNIQN Mobile — Supabase WeeklyGrid Repository (주간 배치 그리드 읽기)
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
import type { GridSummaryRow } from '@/domains/weeklyGrid';
import type { IWeeklyGridRepository, VenueDaySlot } from '../interfaces/IWeeklyGridRepository';

const TABLE = 'work_logs' as const;

export class SupabaseWeeklyGridRepository implements IWeeklyGridRepository {
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
      }[];
      // job_count → jobCount camelCase 매핑 + 숫자 정규화(NaN 방어)
      return rows.map((r) => ({
        d: r.d,
        headcount: Number(r.headcount) || 0,
        jobCount: Number(r.job_count) || 0,
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
}
