/**
 * UNIQN Mobile - Supabase Report Repository
 *
 * @description Supabase PostgREST 기반 Report Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 신고 CRUD 작업
 * 2. RPC 트랜잭션 캡슐화 (중복 신고 방지)
 * 3. 신고 처리 (상태 전이)
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError, CannotReportSelfError } from '@/errors';
import { handleSupabaseError, toCamelCase, paginatedQuery, runRpc } from '@/utils/supabase';
import { getReportSeverity } from '@/types/report';
import type {
  IReportRepository,
  CreateReportContext,
  FetchReportsOptions,
  FetchReportsResult,
  ReportCounts,
} from '../interfaces';
import type { Report, CreateReportInput, ReviewReportInput } from '@/types/report';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  REPORTS: 'reports',
} as const;
const TABLE_COLUMNS =
  'id,created_at,description,evidence_urls,job_posting_id,job_posting_title,reporter_id,reporter_name,reporter_type,reviewed_at,reviewer_id,reviewer_notes,severity,status,target_id,target_name,type,updated_at,work_date,work_log_id' as const;

// ============================================================================
// Helpers
// ============================================================================

function rowToReport(row: Record<string, unknown>): Report {
  return toCamelCase<Report>(row);
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseReportRepository implements IReportRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(reportId: string): Promise<Report | null> {
    try {
      logger.info('신고 상세 조회', { reportId });

      const { data, error } = await supabase
        .from(TABLES.REPORTS)
        .select(TABLE_COLUMNS)
        .eq('id', reportId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '신고 상세 조회', table: TABLES.REPORTS });
      }

      if (!data) return null;

      return rowToReport(data as Record<string, unknown>);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '신고 상세 조회', table: TABLES.REPORTS });
    }
  }

  async getByJobPostingId(jobPostingId: string): Promise<Report[]> {
    return this.queryReports('job_posting_id', jobPostingId, '공고별 신고 목록 조회');
  }

  async getByTargetId(targetId: string): Promise<Report[]> {
    return this.queryReports('target_id', targetId, '대상별 신고 목록 조회');
  }

  async getByReporterId(reporterId: string): Promise<Report[]> {
    return this.queryReports('reporter_id', reporterId, '신고자별 신고 목록 조회');
  }

  async getAll(options: FetchReportsOptions = {}): Promise<FetchReportsResult> {
    try {
      const { filters, pageSize = 50, cursor } = options;
      logger.info('전체 신고 목록 조회', { filters, pageSize });

      const result = await paginatedQuery<Record<string, unknown>>(TABLES.REPORTS, {
        filters: (q) => {
          let query = q;
          if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
          }
          if (filters?.severity && filters.severity !== 'all') {
            query = query.eq('severity', filters.severity);
          }
          if (filters?.reporterType && filters.reporterType !== 'all') {
            query = query.eq('reporter_type', filters.reporterType);
          }
          return query;
        },
        orderBy: 'created_at',
        ascending: false,
        pageSize,
        cursor,
      });

      return {
        reports: result.items.map(rowToReport),
        nextCursor: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '전체 신고 목록 조회', table: TABLES.REPORTS });
    }
  }

  async getCountsByTargetId(targetId: string): Promise<ReportCounts> {
    try {
      logger.info('대상별 신고 통계 조회', { targetId });

      const severities = ['critical', 'high', 'medium', 'low'] as const;

      const counts = await Promise.all(
        severities.map(async (severity) => {
          const { count, error } = await supabase
            .from(TABLES.REPORTS)
            .select('id', { count: 'exact', head: true })
            .eq('target_id', targetId)
            .eq('severity', severity);

          if (error) {
            handleSupabaseError(error, { operation: '신고 통계 조회', table: TABLES.REPORTS });
          }

          return count ?? 0;
        })
      );

      const [critical, high, medium, low] = counts;

      return {
        total: critical + high + medium + low,
        critical,
        high,
        medium,
        low,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '대상별 신고 통계 조회', table: TABLES.REPORTS });
    }
  }

  // ==========================================================================
  // 트랜잭션 (Write) - RPC 사용
  // ==========================================================================

  async createWithTransaction(
    input: CreateReportInput,
    context: CreateReportContext
  ): Promise<string> {
    try {
      // 본인 신고 방지
      if (input.targetId === context.reporterId) {
        throw new CannotReportSelfError({
          userMessage: '본인을 신고할 수 없습니다',
        });
      }

      logger.info('신고 생성 트랜잭션 시작', {
        type: input.type,
        reporterType: input.reporterType,
        targetId: input.targetId,
      });

      const severity = getReportSeverity(input.type, input.reporterType);

      const result = await runRpc<{ report_id: string }>('create_report', {
        p_type: input.type,
        p_reporter_type: input.reporterType,
        p_reporter_id: context.reporterId,
        p_reporter_name: context.reporterName,
        p_target_id: input.targetId,
        p_target_name: input.targetName,
        p_job_posting_id: input.jobPostingId,
        p_job_posting_title: input.jobPostingTitle ?? '',
        p_description: input.description,
        p_evidence_urls: input.evidenceUrls ?? [],
        p_severity: severity,
        p_work_log_id: input.workLogId ?? null,
        p_work_date: input.workDate ?? null,
      });

      logger.info('신고 생성 트랜잭션 완료', { reportId: result.report_id });
      return result.report_id;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '신고 생성', table: TABLES.REPORTS });
    }
  }

  async reviewWithTransaction(input: ReviewReportInput, reviewerId: string): Promise<void> {
    try {
      logger.info('신고 처리 트랜잭션 시작', {
        reportId: input.reportId,
        status: input.status,
      });

      await runRpc<void>('review_report', {
        p_report_id: input.reportId,
        p_status: input.status,
        p_reviewer_id: reviewerId,
        p_reviewer_notes: input.reviewerNotes ?? '',
      });

      logger.info('신고 처리 트랜잭션 완료', { reportId: input.reportId });
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '신고 처리', table: TABLES.REPORTS });
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async queryReports(
    field: string,
    value: string,
    operationName: string
  ): Promise<Report[]> {
    try {
      logger.info(operationName, { [field]: value });

      const { data, error } = await supabase
        .from(TABLES.REPORTS)
        .select(TABLE_COLUMNS)
        .eq(field, value)
        .order('created_at', { ascending: false });

      if (error) {
        handleSupabaseError(error, { operation: operationName, table: TABLES.REPORTS });
      }

      return ((data ?? []) as Record<string, unknown>[]).map(rowToReport);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: operationName, table: TABLES.REPORTS });
    }
  }
}
