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
import { REVIEW_DEADLINE_DAYS, getSentimentTagConsistency } from '@/types/review';
import type { WorkLogForReview } from '@/domains/review';
import type { CreateReviewInput, ReviewerType, Review, ReviewBlindResult } from '@/types/review';
import type { CreateReviewContext, ReviewPaginationCursor, PaginatedReviews } from '@/repositories';

const validator = new ReviewValidator();

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

    const parseResult = createReviewInputSchema.safeParse(input);
    if (!parseResult.success) {
      logger.warn('리뷰 입력 검증 실패', {
        component: 'reviewService',
        errors: parseResult.error.flatten(),
      });
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      const firstMessage = Object.values(fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof firstMessage === 'string' ? firstMessage : '입력값을 확인해 주세요.',
      });
    }

    const tagResult = validator.validateTags(input.tags, input.reviewerType);
    if (!tagResult.valid) {
      logger.warn('리뷰 태그 검증 실패', {
        component: 'reviewService',
        invalidTags: tagResult.invalidTags,
      });
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: `허용되지 않는 태그가 포함되어 있습니다: ${tagResult.invalidTags.join(', ')}`,
      });
    }

    const consistency = getSentimentTagConsistency(input.sentiment, input.tags);
    if (!consistency.consistent) {
      logger.warn('리뷰 감정-태그 정책 검증 실패', {
        component: 'reviewService',
        message: consistency.message,
        sentiment: input.sentiment,
        tags: input.tags,
      });
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: consistency.message ?? '선택한 감정과 태그가 일치하지 않습니다.',
      });
    }

    const workLog = await workLogRepository.getById(input.workLogId);
    if (!workLog) {
      throw new ReviewNotFoundError({
        userMessage: '리뷰 대상을 찾을 수 없습니다.',
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

export async function getReviewsWithBlindCheck(
  workLogId: string,
  myReviewerType: ReviewerType,
  currentUserId: string
): Promise<ReviewBlindResult> {
  try {
    return await reviewRepository.getReviewsWithBlindCheck(
      workLogId,
      myReviewerType,
      currentUserId
    );
  } catch (error) {
    throw handleServiceError(error, {
      operation: '블라인드 리뷰 조회',
      component: 'reviewService',
      context: { workLogId, myReviewerType },
    });
  }
}

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
