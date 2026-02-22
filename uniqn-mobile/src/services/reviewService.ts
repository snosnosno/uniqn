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
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { reviewRepository } from '@/repositories';
import { createReviewInputSchema } from '@/schemas/review.schema';
import { ReviewValidator } from '@/domains/review';
import type { CreateReviewInput, ReviewerType, Review, ReviewBlindResult } from '@/types/review';
import type { CreateReviewContext } from '@/repositories';

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

    // 4. Repository 트랜잭션 (중복 확인 + WorkLog 상태 + 버블 점수 포함)
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
 * 받은 리뷰 목록 조회
 */
export async function getReceivedReviews(
  revieweeId: string,
  limit?: number
): Promise<Review[]> {
  try {
    return await reviewRepository.getByRevieweeId(revieweeId, limit);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '받은 리뷰 목록 조회',
      component: 'reviewService',
      context: { revieweeId },
    });
  }
}

/**
 * 작성한 리뷰 목록 조회
 */
export async function getGivenReviews(
  reviewerId: string,
  limit?: number
): Promise<Review[]> {
  try {
    return await reviewRepository.getByReviewerId(reviewerId, limit);
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
