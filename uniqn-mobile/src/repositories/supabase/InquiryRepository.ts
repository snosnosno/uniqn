/**
 * UNIQN Mobile - Supabase Inquiry Repository
 *
 * @description Supabase PostgREST 기반 Inquiry Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 문의 CRUD 작업
 * 2. 상태 전이 검증 (RPC)
 * 3. 관리자 응답 처리
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase, paginatedQuery, runRpc } from '@/utils/supabase';
import type { Inquiry, InquiryStatus, CreateInquiryInput, RespondInquiryInput } from '@/types';
import type {
  IInquiryRepository,
  FetchInquiriesOptions,
  FetchInquiriesResult,
  CreateInquiryContext,
} from '../interfaces/IInquiryRepository';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  INQUIRIES: 'inquiries',
} as const;

const COMPONENT = 'SupabaseInquiryRepository';
const TABLE_COLUMNS =
  'id,attachments,category,created_at,message,responded_at,responder_id,responder_name,response,status,subject,updated_at,user_email,user_id,user_name' as const;

// ============================================================================
// Helpers
// ============================================================================

function rowToInquiry(row: Record<string, unknown>): Inquiry {
  return toCamelCase<Inquiry>(row);
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseInquiryRepository implements IInquiryRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(inquiryId: string): Promise<Inquiry | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.INQUIRIES)
        .select(TABLE_COLUMNS)
        .eq('id', inquiryId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '문의 상세 조회', table: TABLES.INQUIRIES });
      }

      if (!data) return null;

      return rowToInquiry(data as Record<string, unknown>);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '문의 상세 조회', table: TABLES.INQUIRIES });
    }
  }

  async getByUserId(
    userId: string,
    options: FetchInquiriesOptions = {}
  ): Promise<FetchInquiriesResult> {
    try {
      const { pageSize = 20, cursor } = options;

      const result = await paginatedQuery<Record<string, unknown>>(TABLES.INQUIRIES, {
        filters: (q) => q.eq('user_id', userId),
        orderBy: 'created_at',
        ascending: false,
        pageSize,
        cursor,
      });

      logger.info('사용자 문의 조회 완료', {
        component: COMPONENT,
        userId,
        count: result.items.length,
      });

      return {
        inquiries: result.items.map(rowToInquiry),
        nextCursor: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '사용자 문의 목록 조회', table: TABLES.INQUIRIES });
    }
  }

  async getAll(options: FetchInquiriesOptions = {}): Promise<FetchInquiriesResult> {
    try {
      const { filters, pageSize = 20, cursor } = options;

      const result = await paginatedQuery<Record<string, unknown>>(TABLES.INQUIRIES, {
        filters: (q) => {
          if (filters?.status && filters.status !== 'all') {
            return q.eq('status', filters.status);
          }
          return q;
        },
        orderBy: 'created_at',
        ascending: false,
        pageSize,
        cursor,
      });

      logger.info('전체 문의 조회 완료', {
        component: COMPONENT,
        count: result.items.length,
        filters,
      });

      return {
        inquiries: result.items.map(rowToInquiry),
        nextCursor: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '전체 문의 목록 조회', table: TABLES.INQUIRIES });
    }
  }

  async getUnansweredCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from(TABLES.INQUIRIES)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open');

      if (error) {
        handleSupabaseError(error, { operation: '미답변 문의 수 조회', table: TABLES.INQUIRIES });
      }

      return count ?? 0;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '미답변 문의 수 조회', table: TABLES.INQUIRIES });
    }
  }

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  async create(context: CreateInquiryContext, input: CreateInquiryInput): Promise<string> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(TABLES.INQUIRIES)
        .insert({
          user_id: context.userId,
          user_email: context.userEmail,
          user_name: context.userName,
          category: input.category,
          subject: input.subject,
          message: input.message,
          status: 'open',
          attachments: input.attachments ?? [],
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error) {
        handleSupabaseError(error, { operation: '문의 생성', table: TABLES.INQUIRIES });
      }

      logger.info('문의 생성 완료', {
        component: COMPONENT,
        inquiryId: data.id,
        category: input.category,
      });

      return data.id as string;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '문의 생성', table: TABLES.INQUIRIES });
    }
  }

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  async respond(
    inquiryId: string,
    responderId: string,
    responderName: string,
    input: RespondInquiryInput
  ): Promise<void> {
    try {
      const targetStatus = input.status ?? 'closed';

      await runRpc<void>('respond_inquiry', {
        p_inquiry_id: inquiryId,
        p_responder_id: responderId,
        p_responder_name: responderName,
        p_response: input.response,
        p_target_status: targetStatus,
      });

      logger.info('문의 응답 완료', {
        component: COMPONENT,
        inquiryId,
        responderId,
        status: targetStatus,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '문의 응답', table: TABLES.INQUIRIES });
    }
  }

  async updateStatus(inquiryId: string, status: InquiryStatus): Promise<void> {
    try {
      await runRpc<void>('update_inquiry_status', {
        p_inquiry_id: inquiryId,
        p_target_status: status,
      });

      logger.info('문의 상태 변경 완료', {
        component: COMPONENT,
        inquiryId,
        status,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '문의 상태 변경', table: TABLES.INQUIRIES });
    }
  }
}
