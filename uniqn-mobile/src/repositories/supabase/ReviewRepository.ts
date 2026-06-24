/**
 * UNIQN Mobile - Supabase Review Repository
 *
 * @description Supabase PostgREST 기반 Review Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 리뷰 CRUD (work_log_id + reviewer_type 복합 조회)
 * 2. RPC 트랜잭션 캡슐화 (중복 방지 + 버블 점수 원자적 업데이트)
 * 3. 블라인드 조회 로직
 *
 * 조회 설계: `(work_log_id, reviewer_type)` 컬럼 직접 조회 — 합성 id 금지
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase, paginatedQuery, runRpc } from '@/utils/supabase';
import type {
  IReviewRepository,
  CreateReviewContext,
  ReviewPaginationCursor,
  PaginatedReviews,
} from '../interfaces/IReviewRepository';
import type { Review, CreateReviewInput, ReviewerType, ReviewBlindResult } from '@/types/review';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  REVIEWS: 'reviews',
  WORK_LOGS: 'work_logs',
  USERS: 'users',
} as const;
const TABLE_COLUMNS =
  'id,bubble_score_change,comment,created_at,job_posting_id,job_posting_title,reviewee_id,reviewee_name,reviewer_id,reviewer_name,reviewer_type,sentiment,tags,work_date,work_log_id' as const;

// ============================================================================
// Helpers
// ============================================================================

function rowToReview(row: Record<string, unknown>): Review {
  return toCamelCase<Review>(row);
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseReviewRepository implements IReviewRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getByWorkLogAndType(workLogId: string, reviewerType: ReviewerType): Promise<Review | null> {
    try {
      logger.info('리뷰 조회', { workLogId, reviewerType });

      const { data, error } = await supabase
        .from(TABLES.REVIEWS)
        .select(TABLE_COLUMNS)
        .eq('work_log_id', workLogId)
        .eq('reviewer_type', reviewerType)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '리뷰 조회', table: TABLES.REVIEWS });
      }

      if (!data) return null;

      return rowToReview(data as Record<string, unknown>);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '리뷰 조회', table: TABLES.REVIEWS });
    }
  }

  async getReviewsWithBlindCheck(
    workLogId: string,
    myReviewerType: ReviewerType,
    currentUserId: string
  ): Promise<ReviewBlindResult> {
    try {
      logger.info('블라인드 리뷰 조회', { workLogId, myReviewerType });

      const opponentType: ReviewerType = myReviewerType === 'employer' ? 'staff' : 'employer';

      // 내 리뷰 + 상대 리뷰 병렬 조회 (uuid 컬럼 직접 조회 — 합성 id 금지)
      const [myResult, opponentResult] = await Promise.all([
        supabase
          .from(TABLES.REVIEWS)
          .select(TABLE_COLUMNS)
          .eq('work_log_id', workLogId)
          .eq('reviewer_type', myReviewerType)
          .maybeSingle(),
        supabase
          .from(TABLES.REVIEWS)
          .select(TABLE_COLUMNS)
          .eq('work_log_id', workLogId)
          .eq('reviewer_type', opponentType)
          .maybeSingle(),
      ]);

      if (myResult.error) {
        handleSupabaseError(myResult.error, { operation: '내 리뷰 조회', table: TABLES.REVIEWS });
      }

      const myReviewRaw = myResult.data
        ? rowToReview(myResult.data as Record<string, unknown>)
        : null;
      const opponentReviewRaw = opponentResult.data
        ? rowToReview(opponentResult.data as Record<string, unknown>)
        : null;

      // 현재 사용자의 리뷰인지 검증
      const isMyReview = myReviewRaw?.reviewerId === currentUserId;
      const myReview = isMyReview ? myReviewRaw : null;

      // 블라인드: 내 리뷰 작성 후에만 상대 리뷰 열람 가능
      const canViewOpponent = isMyReview;

      return {
        myReview,
        opponentReview: canViewOpponent ? opponentReviewRaw : null,
        canViewOpponent,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '블라인드 리뷰 조회', table: TABLES.REVIEWS });
    }
  }

  async getByRevieweeId(
    revieweeId: string,
    pageSize = 20,
    cursor?: ReviewPaginationCursor
  ): Promise<PaginatedReviews> {
    try {
      logger.info('받은 리뷰 목록 조회', { revieweeId, pageSize });

      const result = await paginatedQuery<Record<string, unknown>>(TABLES.REVIEWS, {
        filters: (q) => q.eq('reviewee_id', revieweeId),
        orderBy: 'created_at',
        ascending: false,
        pageSize,
        cursor,
      });

      return {
        items: result.items.map(rowToReview),
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '받은 리뷰 목록 조회', table: TABLES.REVIEWS });
    }
  }

  async getByReviewerId(
    reviewerId: string,
    pageSize = 20,
    cursor?: ReviewPaginationCursor
  ): Promise<PaginatedReviews> {
    try {
      logger.info('작성한 리뷰 목록 조회', { reviewerId, pageSize });

      const result = await paginatedQuery<Record<string, unknown>>(TABLES.REVIEWS, {
        filters: (q) => q.eq('reviewer_id', reviewerId),
        orderBy: 'created_at',
        ascending: false,
        pageSize,
        cursor,
      });

      return {
        items: result.items.map(rowToReview),
        lastDoc: result.lastDoc,
        hasMore: result.hasMore,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '작성한 리뷰 목록 조회', table: TABLES.REVIEWS });
    }
  }

  // ==========================================================================
  // 트랜잭션 (Write) - RPC 사용
  // ==========================================================================

  async createWithTransaction(
    input: CreateReviewInput,
    context: CreateReviewContext
  ): Promise<string> {
    try {
      logger.info('리뷰 생성 트랜잭션 시작', {
        workLogId: input.workLogId,
        reviewerType: input.reviewerType,
        sentiment: input.sentiment,
      });

      const result = await runRpc<string>('create_review', {
        p_work_log_id: input.workLogId,
        p_job_posting_id: input.jobPostingId,
        p_job_posting_title: input.jobPostingTitle,
        p_work_date: input.workDate,
        p_reviewer_id: context.reviewerId,
        p_reviewer_name: context.reviewerName,
        p_reviewer_type: input.reviewerType,
        p_reviewee_id: input.revieweeId,
        p_reviewee_name: input.revieweeName,
        p_sentiment: input.sentiment,
        p_tags: input.tags,
        p_comment: input.comment ?? null,
      });

      logger.info('리뷰 생성 트랜잭션 완료', { reviewId: result });
      return result;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, {
        operation: '리뷰 생성',
        table: TABLES.REVIEWS,
      });
    }
  }
}
