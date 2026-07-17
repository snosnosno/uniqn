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
import { WORK_LOG_COLUMNS, applyTsPreference } from './workLogColumns';

// ============================================================================
// Constants
// ============================================================================

export const TABLE = 'work_logs';
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_STATS_PAGE_SIZE = 1000;
// work_logs SELECT 화이트리스트 정본 재노출(기존 소비처 계약 유지 — 정본은 workLogColumns).
export const TABLE_COLUMNS = WORK_LOG_COLUMNS;

// ============================================================================
// Mapping Functions
// ============================================================================

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
