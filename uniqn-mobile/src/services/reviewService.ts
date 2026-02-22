/**
 * UNIQN Mobile - Review Service
 *
 * @description 리뷰/평가(버블) 비즈니스 로직
 * @version 1.0.0
 *
 * 책임:
 * 1. Zod 스키마 검증
 * 2. 도메인 검증 (ReviewValidator)
 * 3. Repository 호출
 * 4. 에러 변환 및 로깅
 */

import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import {
  isAppError,
  ValidationError,
  ERROR_CODES,
  CannotReviewSelfError,
  ReviewPeriodExpiredError,
  UnauthorizedReviewError,
  ReviewNotFoundError,
} from '@/errors';
import { reviewRepository, workLogRepository } from '@/repositories';
import { createReviewInputSchema } from '@/schemas/review.schema';
import { ReviewValidator } from '@/domains/review';
import { REVIEW_DEADLINE_DAYS } from '@/types/review';
import type { WorkLogForReview } from '@/domains/review';
import type { CreateReviewInput, ReviewerType, Review, ReviewBlindResult } from '@/types/review';
import type { CreateReviewContext, ReviewPaginationCursor, PaginatedReviews } from '@/repositories';

// ============================================================================
// Service
// ============================================================================

const validator = new ReviewValidator();

/**
 * 리뷰 생성
 *
 * @param input - 리뷰 입력 데이터
 * @param context - 평가자 컨텍스트
 * @returns 생성된 리뷰 ID
 * @throws Zod ValidationError, BusinessError (E6060~E6064)
 */
export async function createReview(
  input: CreateReviewInput,
  context: CreateReviewContext
): Promise<string> {
  try {
    logger.info('리뷰 생성 시작', {
      component: 'reviewService',
      workLogId: input.workLogId,
      reviewerType: input.reviewerType,
      sentiment: input.sentiment,
    });

    // 1. Zod 스키마 검증
    const parseResult = createReviewInputSchema.safeParse(input);
    if (!parseResult.success) {
      logger.warn('리뷰 입력 검증 실패', {
        component: 'reviewService',
        errors: parseResult.error.flatten(),
      });
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      const firstMessage = Object.values(fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof firstMessage === 'string' ? firstMessage : '입력값을 확인해주세요',
      });
    }

    // 2. 태그 유효성 검증 (도메인)
    const tagResult = validator.validateTags(input.tags, input.reviewerType);
    if (!tagResult.valid) {
      logger.warn('리뷰 태그 검증 실패', {
        component: 'reviewService',
        invalidTags: tagResult.invalidTags,
      });
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: `허용되지 않은 태그가 포함되어 있습니다: ${tagResult.invalidTags.join(', ')}`,
      });
    }

    // 3. 감성-태그 일관성 경고 (비블로킹)
    const consistency = validator.checkSentimentTagConsistency(input.sentiment, input.tags);
    if (!consistency.consistent) {
      logger.info('감성-태그 불일치 경고', {
        component: 'reviewService',
        warning: consistency.warning,
        sentiment: input.sentiment,
        tags: input.tags,
      });
    }

    // 4. 도메인 검증: WorkLog 상태, 권한, 기한 (사전 검증 — fast fail)
    const workLog = await workLogRepository.getById(input.workLogId);
    if (!workLog) {
      throw new ReviewNotFoundError({
        userMessage: '평가 대상을 찾을 수 없습니다',
        workLogId: input.workLogId,
      });
    }

    const workLogData: WorkLogForReview = {
      id: input.workLogId,
      staffId: workLog.staffId,
      ownerId: workLog.ownerId ?? '',
      jobPostingId: workLog.jobPostingId,
      status: workLog.status,
      date: workLog.date,
      completedAt: workLog.checkOutTime as WorkLogForReview['completedAt'],
    };

    const eligibility = validator.checkEligibility(
      workLogData,
      context.reviewerId,
      input.reviewerType
    );

    if (!eligibility.eligible) {
      switch (eligibility.code) {
        case 'REVIEW_PERIOD_EXPIRED':
          throw new ReviewPeriodExpiredError({
            userMessage: eligibility.reason,
            workLogId: input.workLogId,
            deadlineDays: REVIEW_DEADLINE_DAYS,
          });
        case 'CANNOT_REVIEW_SELF':
          throw new CannotReviewSelfError({
            userMessage: eligibility.reason,
          });
        case 'UNAUTHORIZED_REVIEWER':
          throw new UnauthorizedReviewError({
            userMessage: eligibility.reason,
            workLogId: input.workLogId,
            reviewerType: input.reviewerType,
          });
        default:
          throw new ReviewNotFoundError({
            userMessage: eligibility.reason,
            workLogId: input.workLogId,
          });
      }
    }

    // 5. Repository 트랜잭션 (중복 확인 + 버블 점수 원자적 업데이트)
    const reviewId = await reviewRepository.createWithTransaction(input, context);

    logger.info('리뷰 생성 완료', {
      component: 'reviewService',
      reviewId,
    });

    return reviewId;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '리뷰 생성',
      component: 'reviewService',
      context: { workLogId: input.workLogId, reviewerType: input.reviewerType },
    });
  }
}

/**
 * 블라인드 리뷰 조회
 *
 * @param workLogId - 근무 기록 ID
 * @param myReviewerType - 내 평가자 유형
 * @param currentUserId - 현재 사용자 ID (권한 검증용)
 * @returns 블라인드 조회 결과 (내 리뷰 + 상대 리뷰 + 열람 가능 여부)
 */
export async function getReviewsWithBlindCheck(
  workLogId: string,
  myReviewerType: ReviewerType,
  currentUserId: string
): Promise<ReviewBlindResult> {
  try {
    return await reviewRepository.getReviewsWithBlindCheck(workLogId, myReviewerType, currentUserId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '블라인드 리뷰 조회',
      component: 'reviewService',
      context: { workLogId, myReviewerType },
    });
  }
}

/**
 * 받은 리뷰 목록 조회 (커서 기반 페이지네이션)
 */
export async function getReceivedReviews(
  revieweeId: string,
  pageSize?: number,
  cursor?: ReviewPaginationCursor
): Promise<PaginatedReviews> {
  try {
    return await reviewRepository.getByRevieweeId(revieweeId, pageSize, cursor);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '받은 리뷰 목록 조회',
      component: 'reviewService',
      context: { revieweeId },
    });
  }
}

/**
 * 작성한 리뷰 목록 조회 (커서 기반 페이지네이션)
 */
export async function getGivenReviews(
  reviewerId: string,
  pageSize?: number,
  cursor?: ReviewPaginationCursor
): Promise<PaginatedReviews> {
  try {
    return await reviewRepository.getByReviewerId(reviewerId, pageSize, cursor);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '작성한 리뷰 목록 조회',
      component: 'reviewService',
      context: { reviewerId },
    });
  }
}

/**
 * 특정 WorkLog의 리뷰 조회
 */
export async function getReviewByWorkLog(
  workLogId: string,
  reviewerType: ReviewerType
): Promise<Review | null> {
  try {
    return await reviewRepository.getByWorkLogAndType(workLogId, reviewerType);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '리뷰 조회',
      component: 'reviewService',
      context: { workLogId, reviewerType },
    });
  }
}
