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
import {
  isAppError,
  CannotReportSelfError,
  DuplicateReportError,
  ReportNotFoundError,
  ReportAlreadyReviewedError,
  NetworkError,
  ERROR_CODES,
} from '@/errors';
import { handleSupabaseError, toCamelCase, paginatedQuery, runRpc } from '@/utils/supabase';
import { getReportSeverity } from '@/types/report';
import { generateId } from '@/utils/generateId';
import type {
  IReportRepository,
  CreateReportContext,
  FetchReportsOptions,
  FetchReportsResult,
} from '../interfaces';
import type {
  Report,
  CreateReportInput,
  ReviewReportInput,
  LocalReportEvidence,
} from '@/types/report';
import { loadFailed, notFound } from '@/constants/messages';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  REPORTS: 'reports',
} as const;
const TABLE_COLUMNS =
  'id,created_at,description,evidence_urls,job_posting_id,job_posting_title,reporter_id,reporter_name,reporter_type,reviewed_at,reviewer_id,reviewer_notes,severity,status,target_id,target_name,type,updated_at,work_date,work_log_id' as const;

/**
 * 증빙 전용 비공개 버킷
 *
 * 1:1 문의 버킷(`inquiry-attachments`)을 경로 prefix 로 나눠 쓸 수도 있었지만,
 * 버킷은 보존/수명주기/일괄정리의 단위라 문의 첨부와 신고 증빙이 한 통에 섞이면
 * 문의 쪽 정리 정책이 분쟁 증빙을 조용히 지울 수 있다. 파일이 한 번 쌓이면 되돌리기
 * 어려우므로 시작부터 분리한다. (DELETE 는 관리자만 — 아래 마이그레이션 참조)
 */
const BUCKETS = {
  REPORT_EVIDENCE: 'report-evidence',
} as const;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const COMPONENT = 'SupabaseReportRepository';

/** 서명 URL 기본 유효 시간 (초) */
const SIGNED_URL_TTL_SECONDS = 3600;

// ============================================================================
// Helpers
// ============================================================================

/**
 * 신고 행 → 도메인 객체
 *
 * ⚠️ `toCamelCase` 는 KNOWN_ACRONYMS(URL) 규칙 때문에 `evidence_urls` 를 `evidenceUrls` 가 아니라
 * **`evidenceURLs`** 로 바꾼다(`src/utils/__tests__/supabase.test.ts` 가 그 동작을 고정하고 있다).
 * `toCamelCase<Report>` 는 검사 없는 캐스팅이라 tsc 가 이 어긋남을 못 잡고, 그대로 두면
 * `Report.evidenceUrls` 가 **영원히 undefined** 라 증빙을 올려도 관리자 화면에 아무것도 안 뜬다.
 * 읽기 진입점인 여기서 한 번만 정규화한다.
 */
function rowToReport(row: Record<string, unknown>): Report {
  const camel = toCamelCase<Record<string, unknown>>(row) as Record<string, unknown> & {
    evidenceURLs?: string[] | null;
  };
  const { evidenceURLs, ...rest } = camel;

  return {
    ...rest,
    ...(evidenceURLs ? { evidenceUrls: evidenceURLs } : {}),
  } as unknown as Report;
}

/**
 * 증빙 Storage 경로 생성 — `{업로더uid}/{제출id}/{timestamp}-{random}.{ext}`
 *
 * 첫 세그먼트가 업로더 uid 여야 Storage RLS(`storage.foldername(name)[1] = auth.uid()`)를 통과한다.
 */
function buildEvidencePath(userId: string, submissionId: string, mime: string): string {
  const ext = MIME_TO_EXT[mime] ?? 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${userId}/${submissionId}/${timestamp}-${random}.${ext}`;
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

  // ==========================================================================
  // 증빙 첨부 (Storage)
  // ==========================================================================

  /**
   * 증빙 이미지 업로드 — 신고 생성 **전에** 호출한다.
   *
   * 1:1 문의는 "문의 생성 → 첨부 업로드 → 실패 시 접수된 문의를 서버에서 통째로 삭제"라는
   * 롤백을 안고 있다. 여기서는 순서를 뒤집어 **업로드를 먼저 끝내고 그 경로로 신고를 1회 생성**하므로
   * 되돌릴 서버 레코드 자체가 없다(업로드가 실패하면 신고를 아예 만들지 않는다).
   *
   * 부분 실패 시 이미 올라간 파일은 지우지 않고 경로만 로그로 남긴다 — 증빙 버킷은 DELETE 를
   * 관리자에게만 허용하기 때문이다(신고자가 접수 뒤 증빙을 지우면 이 기능의 목적이 사라진다).
   *
   * @param userId 업로더(= 신고자) uid — 경로 첫 세그먼트이자 Storage RLS 축
   * @returns 업로드된 Storage 경로 목록 (입력 순서 유지)
   */
  async uploadEvidence(userId: string, files: LocalReportEvidence[]): Promise<string[]> {
    if (files.length === 0) return [];

    const submissionId = generateId();
    const uploadedPaths: string[] = [];

    try {
      for (const file of files) {
        const path = buildEvidencePath(userId, submissionId, file.mime);
        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { error } = await supabase.storage.from(BUCKETS.REPORT_EVIDENCE).upload(path, blob, {
          contentType: file.mime,
          upsert: false,
        });

        if (error) {
          throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
            message: `증빙 업로드 실패: ${error.message}`,
            userMessage: '증빙 사진 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.',
            metadata: { component: COMPONENT, path, mime: file.mime },
            originalError: error instanceof Error ? error : undefined,
          });
        }

        uploadedPaths.push(path);
      }

      logger.info('report.evidence.uploaded', {
        component: COMPONENT,
        submissionId,
        count: uploadedPaths.length,
      });

      return uploadedPaths;
    } catch (error) {
      // 신고를 아직 만들지 않았으므로 되돌릴 레코드는 없다. 고아 파일 경로만 기록.
      if (uploadedPaths.length > 0) {
        logger.warn('report.evidence.partial_upload_orphans', {
          component: COMPONENT,
          submissionId,
          paths: uploadedPaths,
        });
      }

      if (isAppError(error)) throw error;
      throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        message: '증빙 업로드 중 오류가 발생했습니다.',
        userMessage: '증빙 사진 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.',
        metadata: { component: COMPONENT, submissionId },
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * 증빙 서명 URL 발급 (열람용)
   *
   * 버킷이 비공개라 열람 시점마다 발급한다. 실제 접근 통제는 Storage RLS 가 한다
   * (신고자 본인 또는 관리자만 SELECT 가능 → 서명 자체가 거부된다).
   */
  async getSignedEvidenceUrl(
    path: string,
    expiresInSeconds = SIGNED_URL_TTL_SECONDS
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKETS.REPORT_EVIDENCE)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        message: `증빙 signed URL 발급 실패: ${error?.message ?? 'unknown'}`,
        userMessage: loadFailed('증빙 사진'),
        metadata: { component: COMPONENT, path },
        originalError: error instanceof Error ? error : undefined,
      });
    }

    return data.signedUrl;
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

      // RPC 내부에서 RAISE EXCEPTION 으로 전달된 비즈니스 예외를 AppError 로 변환
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('DUPLICATE_REPORT')) {
        throw new DuplicateReportError({
          userMessage: '이미 해당 건에 대해 신고하셨습니다',
          targetId: input.targetId,
          jobPostingId: input.jobPostingId,
        });
      }
      if (message.includes('CANNOT_REPORT_SELF')) {
        throw new CannotReportSelfError({
          userMessage: '본인을 신고할 수 없습니다',
        });
      }
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

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('REPORT_NOT_FOUND')) {
        throw new ReportNotFoundError({
          userMessage: notFound('신고'),
          reportId: input.reportId,
        });
      }
      if (message.includes('REPORT_ALREADY_REVIEWED')) {
        throw new ReportAlreadyReviewedError({
          userMessage: '이미 처리된 신고입니다',
          reportId: input.reportId,
        });
      }
      handleSupabaseError(error, { operation: '신고 처리', table: TABLES.REPORTS });
    }
  }
}
