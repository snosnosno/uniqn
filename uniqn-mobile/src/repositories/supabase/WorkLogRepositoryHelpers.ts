/**
 * UNIQN Mobile - WorkLog Repository Helpers
 *
 * @description WorkLogRepository에서 사용하는 상수, 매핑 함수, 헬퍼 유틸리티
 */

import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { parseWorkLogDocument, parseWorkLogDocuments } from '@/schemas';
import type { WorkLog } from '@/types';

// ============================================================================
// Constants
// ============================================================================

export const TABLE = 'work_logs';
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_STATS_PAGE_SIZE = 1000;
export const TABLE_COLUMNS =
  'id,application_id,assignment_group_id,check_in_time,check_in_ts,check_out_time,check_out_ts,created_at,custom_allowances,custom_role,custom_salary_info,custom_tax_settings,date,has_time_modification_logs,is_fixed_posting,job_posting_id,modification_history,no_show_at,no_show_reason,notes,owner_id,payroll_amount,payroll_date,payroll_notes,payroll_status,role,role_change_history,settlement_modification_history,staff_id,staff_name,staff_nickname,staff_photo_url,staff_photo_url_blurhash,status,time_slot,updated_at' as const;

// ============================================================================
// Mapping Functions
// ============================================================================

// Phase C: check_in_ts/check_out_ts (timestamptz) 우선. 구 jsonb 값은 fallback.
// PostgREST 가 timestamptz 를 ISO string 으로 직렬화하므로 바로 도메인 타입에 호환.
function applyTsPreference(camel: Record<string, unknown>): Record<string, unknown> {
  const checkInTime = camel.checkInTs ?? camel.checkInTime;
  const checkOutTime = camel.checkOutTs ?? camel.checkOutTime;
  return { ...camel, checkInTime, checkOutTime };
}

export function toWorkLog(row: Record<string, unknown>): WorkLog | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  return parseWorkLogDocument({ ...applyTsPreference(camel), id: row.id });
}

export function rowsToWorkLogs(rows: Record<string, unknown>[]): WorkLog[] {
  return parseWorkLogDocuments(
    rows.map((row) => ({
      ...applyTsPreference(toCamelCase<Record<string, unknown>>(row)),
      id: row.id,
    }))
  );
}

// ============================================================================
// Error Helpers
// ============================================================================

/** 공통 catch 핸들러 */
export function rethrowOrHandle(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): never {
  if (isAppError(error)) throw error;
  logger.error(`${operation} 실패`, toError(error), context);
  handleSupabaseError(error, { operation, table: TABLE });
}
