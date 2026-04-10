import type { ReviewerType, ReviewSentiment } from '@/types/review';
import {
  REVIEW_DEADLINE_DAYS,
  REVIEW_TAG_LIMITS,
  REVIEWABLE_STATUSES,
  getAllowedTagKeys,
  getSentimentTagConsistency,
} from '@/types/review';
import { getReviewBaseTime } from './reviewDeadline';

export interface WorkLogForReview {
  id: string;
  staffId: string;
  jobPostingId: string;
  ownerId: string;
  status: string;
  date: string;
  completedAt?: Date;
}

export interface ReviewEligibilityResult {
  eligible: boolean;
  reason?: string;
  code?:
    | 'INVALID_WORKLOG_STATUS'
    | 'REVIEW_PERIOD_EXPIRED'
    | 'CANNOT_REVIEW_SELF'
    | 'UNAUTHORIZED_REVIEWER'
    | 'ALREADY_REVIEWED';
}

export interface TagValidationResult {
  valid: boolean;
  invalidTags: string[];
}

export class ReviewValidator {
  checkEligibility(
    workLog: WorkLogForReview,
    reviewerId: string,
    reviewerType: ReviewerType
  ): ReviewEligibilityResult {
    if (!REVIEWABLE_STATUSES.has(workLog.status)) {
      return {
        eligible: false,
        reason: '근무가 완료되지 않았습니다.',
        code: 'INVALID_WORKLOG_STATUS',
      };
    }

    const revieweeId = reviewerType === 'employer' ? workLog.staffId : workLog.ownerId;
    if (reviewerId === revieweeId) {
      return {
        eligible: false,
        reason: '본인에게는 리뷰를 남길 수 없습니다.',
        code: 'CANNOT_REVIEW_SELF',
      };
    }

    if (reviewerType === 'employer' && reviewerId !== workLog.ownerId) {
      return {
        eligible: false,
        reason: '해당 공고의 구인자만 리뷰를 남길 수 있습니다.',
        code: 'UNAUTHORIZED_REVIEWER',
      };
    }

    if (reviewerType === 'staff' && reviewerId !== workLog.staffId) {
      return {
        eligible: false,
        reason: '해당 근무의 스태프만 리뷰를 남길 수 있습니다.',
        code: 'UNAUTHORIZED_REVIEWER',
      };
    }

    if (this.isExpired(workLog)) {
      return {
        eligible: false,
        reason: `리뷰 기간(${REVIEW_DEADLINE_DAYS}일)이 만료되었습니다.`,
        code: 'REVIEW_PERIOD_EXPIRED',
      };
    }

    return { eligible: true };
  }

  isExpired(workLog: WorkLogForReview): boolean {
    const baseTime = getReviewBaseTime(workLog.completedAt, workLog.date);
    if (baseTime === null) {
      return false;
    }

    const deadline = new Date(baseTime);
    deadline.setDate(deadline.getDate() + REVIEW_DEADLINE_DAYS);
    return new Date() > deadline;
  }

  validateTags(tags: string[], reviewerType: ReviewerType): TagValidationResult {
    if (tags.length < REVIEW_TAG_LIMITS.MIN || tags.length > REVIEW_TAG_LIMITS.MAX) {
      return { valid: false, invalidTags: [] };
    }

    const allowedKeys = getAllowedTagKeys(reviewerType);
    const invalidTags = tags.filter((tag) => !allowedKeys.has(tag));

    return {
      valid: invalidTags.length === 0,
      invalidTags,
    };
  }

  checkSentimentTagConsistency(
    sentiment: ReviewSentiment,
    tags: string[]
  ): { consistent: boolean; warning?: string } {
    const result = getSentimentTagConsistency(sentiment, tags);
    return {
      consistent: result.consistent,
      warning: result.message,
    };
  }
}
