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
import { NetworkError, ERROR_CODES, isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase, paginatedQuery, runRpc } from '@/utils/supabase';
import type {
  Inquiry,
  InquiryStatus,
  CreateInquiryInput,
  RespondInquiryInput,
  InquiryAttachment,
  LocalInquiryAttachment,
} from '@/types';
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

const BUCKETS = {
  INQUIRY_ATTACHMENTS: 'inquiry-attachments',
} as const;

const COMPONENT = 'SupabaseInquiryRepository';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function buildAttachmentPath(userId: string, inquiryId: string, mime: string): string {
  const ext = MIME_TO_EXT[mime] ?? 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${userId}/${inquiryId}/${timestamp}-${random}.${ext}`;
}
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
          attachments: [],
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

  // ==========================================================================
  // 첨부파일 (Attachments)
  // ==========================================================================

  async uploadAttachments(
    userId: string,
    inquiryId: string,
    files: LocalInquiryAttachment[]
  ): Promise<InquiryAttachment[]> {
    const uploaded: InquiryAttachment[] = [];
    const uploadedPaths: string[] = [];

    try {
      for (const file of files) {
        const path = buildAttachmentPath(userId, inquiryId, file.mime);
        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { error } = await supabase.storage
          .from(BUCKETS.INQUIRY_ATTACHMENTS)
          .upload(path, blob, {
            contentType: file.mime,
            upsert: false,
          });

        if (error) {
          throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
            message: `첨부파일 업로드 실패: ${error.message}`,
            userMessage: '이미지 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.',
            metadata: { component: COMPONENT, path, mime: file.mime },
            originalError: error instanceof Error ? error : undefined,
          });
        }

        uploadedPaths.push(path);
        uploaded.push({
          path,
          mime: file.mime,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          width: file.width,
          height: file.height,
        });
      }

      logger.info('inquiry.attachments.uploaded', {
        component: COMPONENT,
        inquiryId,
        count: uploaded.length,
      });

      return uploaded;
    } catch (error) {
      // Rollback: 이미 업로드된 파일 삭제 시도 (best-effort)
      if (uploadedPaths.length > 0) {
        logger.warn('inquiry.attachments.rollback', {
          component: COMPONENT,
          inquiryId,
          count: uploadedPaths.length,
        });
        try {
          await this.removeAttachmentsFromStorage(uploadedPaths);
        } catch (rollbackError) {
          logger.error('inquiry.attachments.rollback.failed', {
            component: COMPONENT,
            inquiryId,
            paths: uploadedPaths,
            rollbackError,
          });
        }
      }

      if (isAppError(error)) throw error;
      throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        message: '첨부파일 업로드 중 오류가 발생했습니다.',
        userMessage: '이미지 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.',
        metadata: { component: COMPONENT, inquiryId },
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  async updateAttachments(inquiryId: string, attachments: InquiryAttachment[]): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.INQUIRIES)
        .update({
          attachments,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inquiryId);

      if (error) {
        handleSupabaseError(error, { operation: '첨부파일 갱신', table: TABLES.INQUIRIES });
      }

      logger.info('inquiry.attachments.updated', {
        component: COMPONENT,
        inquiryId,
        count: attachments.length,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '첨부파일 갱신', table: TABLES.INQUIRIES });
    }
  }

  async removeAttachmentsFromStorage(paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const { error } = await supabase.storage.from(BUCKETS.INQUIRY_ATTACHMENTS).remove(paths);

    if (error) {
      throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        message: `첨부파일 삭제 실패: ${error.message}`,
        metadata: { component: COMPONENT, paths },
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  async getSignedAttachmentUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKETS.INQUIRY_ATTACHMENTS)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        message: `signed URL 발급 실패: ${error?.message ?? 'unknown'}`,
        metadata: { component: COMPONENT, path },
        originalError: error instanceof Error ? error : undefined,
      });
    }

    return data.signedUrl;
  }

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  async deleteInquiry(inquiryId: string, userId: string): Promise<void> {
    try {
      // RLS 정책 inquiries_delete_own 이 user_id=auth.uid() AND status='open' 보장
      // userId 파라미터는 호출 측 의도 확인용 (실제 검증은 RLS)
      const { error } = await supabase
        .from(TABLES.INQUIRIES)
        .delete()
        .eq('id', inquiryId)
        .eq('user_id', userId);

      if (error) {
        handleSupabaseError(error, { operation: '문의 삭제', table: TABLES.INQUIRIES });
      }

      logger.info('inquiry.deleted', {
        component: COMPONENT,
        inquiryId,
        userId,
      });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '문의 삭제', table: TABLES.INQUIRIES });
    }
  }
}
