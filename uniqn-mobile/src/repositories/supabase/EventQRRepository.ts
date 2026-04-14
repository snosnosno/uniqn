/**
 * UNIQN Mobile - Supabase Event QR Repository
 *
 * @description Supabase PostgREST 기반 Event QR Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. QR 코드 CRUD 작업
 * 2. 만료 시간 기반 자동 비활성화
 * 3. 보안 코드 검증
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase, toSnakeCase } from '@/utils/supabase';
import type { EventQRScopeOptions, IEventQRRepository } from '../interfaces/IEventQRRepository';
import type { EventQRCode, QRCodeAction } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  EVENT_QR_CODES: 'event_qr_codes',
} as const;
const TABLE_COLUMNS =
  'id,code,created_at,expires_at,is_active,job_posting_id,type,user_id,work_date,assignment_group_id,time_slot' as const;

// ============================================================================
// Helpers
// ============================================================================

function rowToEventQR(row: Record<string, unknown>): EventQRCode {
  const camel = toCamelCase<Record<string, unknown>>(row);
  return {
    ...camel,
    expiresAt: camel.expiresAt ? new Date(camel.expiresAt as string) : new Date(),
    createdAt: camel.createdAt ? new Date(camel.createdAt as string) : new Date(),
  } as EventQRCode;
}

function matchesScope(
  qrCode: Pick<EventQRCode, 'assignmentGroupId' | 'timeSlot'>,
  options?: EventQRScopeOptions
): boolean {
  if (!options) return true;

  if (options.assignmentGroupId !== undefined) {
    const assignmentGroupId = qrCode.assignmentGroupId ?? null;
    if (assignmentGroupId !== (options.assignmentGroupId ?? null)) return false;
  }

  if (options.timeSlot !== undefined) {
    const timeSlot = qrCode.timeSlot ?? null;
    if (timeSlot !== (options.timeSlot ?? null)) return false;
  }

  return true;
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseEventQRRepository implements IEventQRRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(qrId: string): Promise<EventQRCode | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.EVENT_QR_CODES)
        .select(TABLE_COLUMNS)
        .eq('id', qrId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: 'QR 코드 조회', table: TABLES.EVENT_QR_CODES });
      }

      if (!data) return null;

      return rowToEventQR(data as Record<string, unknown>);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('QR 코드 조회 실패', toError(error), { qrId });
      handleSupabaseError(error, { operation: 'QR 코드 조회', table: TABLES.EVENT_QR_CODES });
    }
  }

  async getActiveByJobAndDate(
    jobPostingId: string,
    date: string,
    action: QRCodeAction,
    options?: EventQRScopeOptions
  ): Promise<EventQRCode | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.EVENT_QR_CODES)
        .select(TABLE_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .eq('date', date)
        .eq('action', action)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('활성 QR 조회 실패', toError(error), { jobPostingId, date, action });
        return null;
      }

      if (!data || data.length === 0) return null;

      // scope 필터링 + 만료 확인
      for (const row of data as Record<string, unknown>[]) {
        const qr = rowToEventQR(row);
        if (!matchesScope(qr, options)) continue;

        // 만료 확인
        if (qr.expiresAt.getTime() < Date.now()) {
          // 만료된 QR 비활성화 (비동기)
          supabase
            .from(TABLES.EVENT_QR_CODES)
            .update({ is_active: false })
            .eq('id', qr.id)
            .eq('is_active', true)
            .then(({ error: updateError }) => {
              if (updateError) {
                logger.warn('만료 QR 비활성화 실패', { qrId: qr.id });
              }
            });
          continue;
        }

        return qr;
      }

      return null;
    } catch (error) {
      logger.error('활성 QR 조회 실패', toError(error), { jobPostingId, date, action });
      return null;
    }
  }

  async validateSecurityCode(
    jobPostingId: string,
    date: string,
    action: QRCodeAction,
    securityCode: string,
    options?: EventQRScopeOptions
  ): Promise<EventQRCode | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.EVENT_QR_CODES)
        .select(TABLE_COLUMNS)
        .eq('job_posting_id', jobPostingId)
        .eq('date', date)
        .eq('action', action)
        .eq('security_code', securityCode)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      const qr = rowToEventQR(data as Record<string, unknown>);

      if (!matchesScope(qr, options)) return null;

      // 만료 확인
      if (qr.expiresAt.getTime() < Date.now()) return null;

      return qr;
    } catch (error) {
      logger.error('보안 코드 검증 실패', toError(error), { jobPostingId, date, action });
      return null;
    }
  }

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  async create(data: Omit<EventQRCode, 'id'>): Promise<string> {
    try {
      const snakeData = toSnakeCase(data as unknown as Record<string, unknown>);

      const { data: inserted, error } = await supabase
        .from(TABLES.EVENT_QR_CODES)
        .insert(snakeData)
        .select('id')
        .single();

      if (error) {
        handleSupabaseError(error, { operation: 'QR 코드 생성', table: TABLES.EVENT_QR_CODES });
      }

      logger.info('QR 코드 생성 완료', { qrId: inserted.id });
      return inserted.id as string;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'QR 코드 생성', table: TABLES.EVENT_QR_CODES });
    }
  }

  // ==========================================================================
  // 업데이트 (Update)
  // ==========================================================================

  async deactivate(qrId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.EVENT_QR_CODES)
        .update({ is_active: false })
        .eq('id', qrId);

      if (error) {
        handleSupabaseError(error, { operation: 'QR 코드 비활성화', table: TABLES.EVENT_QR_CODES });
      }

      logger.info('QR 코드 비활성화 완료', { qrId });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'QR 코드 비활성화', table: TABLES.EVENT_QR_CODES });
    }
  }

  async deactivateByJobAndDate(
    jobPostingId: string,
    date: string,
    action: QRCodeAction,
    options?: EventQRScopeOptions
  ): Promise<number> {
    try {
      // scope가 있으면 먼저 조회 후 필터링
      if (options?.assignmentGroupId !== undefined || options?.timeSlot !== undefined) {
        const { data, error: fetchError } = await supabase
          .from(TABLES.EVENT_QR_CODES)
          .select(TABLE_COLUMNS)
          .eq('job_posting_id', jobPostingId)
          .eq('date', date)
          .eq('action', action)
          .eq('is_active', true);

        if (fetchError || !data || data.length === 0) return 0;

        const scopedIds = (data as Record<string, unknown>[])
          .filter((row) => matchesScope(rowToEventQR(row), options))
          .map((row) => row.id as string);

        if (scopedIds.length === 0) return 0;

        const { error: updateError } = await supabase
          .from(TABLES.EVENT_QR_CODES)
          .update({ is_active: false })
          .in('id', scopedIds);

        if (updateError) {
          logger.warn('기존 QR 비활성화 실패', { jobPostingId, date, action });
          return 0;
        }

        return scopedIds.length;
      }

      // scope 없으면 직접 업데이트
      const { data, error } = await supabase
        .from(TABLES.EVENT_QR_CODES)
        .update({ is_active: false })
        .eq('job_posting_id', jobPostingId)
        .eq('date', date)
        .eq('action', action)
        .eq('is_active', true)
        .select('id');

      if (error) {
        logger.warn('기존 QR 비활성화 실패', { jobPostingId, date, action });
        return 0;
      }

      return data?.length ?? 0;
    } catch (error) {
      logger.warn('기존 QR 비활성화 실패', { jobPostingId, date, action, error: toError(error) });
      return 0;
    }
  }

  // ==========================================================================
  // 정리 (Cleanup)
  // ==========================================================================

  async deactivateExpired(): Promise<number> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(TABLES.EVENT_QR_CODES)
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('expires_at', now)
        .select('id');

      if (error) {
        logger.error('만료 QR 정리 실패', toError(error));
        return 0;
      }

      const count = data?.length ?? 0;
      logger.info('만료 QR 정리 완료', { count });
      return count;
    } catch (error) {
      logger.error('만료 QR 정리 실패', toError(error));
      return 0;
    }
  }
}
