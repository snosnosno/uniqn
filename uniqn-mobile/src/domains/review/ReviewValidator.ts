/**
 * UNIQN Mobile - Review Validator
 *
 * @description 리뷰/평가(버블) 관련 검증 로직 통합
 * @version 1.0.0
 *
 * ## 책임
 * - 평가 가능 여부 검증 (WorkLog 상태, 기한, 권한)
 * - 태그 유효성 검증 (reviewerType별 허용 태그)
 * - 본인 평가 방지
 */

import type { Timestamp } from 'firebase/firestore';
import type { ReviewerType, ReviewSentiment } from '@/types/review';
import {
  REVIEW_DEADLINE_DAYS,
  REVIEW_TAG_LIMITS,
  getAllowedTagKeys,
} from '@/types/review';

// ============================================================================
// Types
// ============================================================================

/**
 * WorkLog 정보 (검증에 필요한 최소 필드)
 */
export interface WorkLogForReview {
  id: string;
  staffId: string;
  jobPostingId: string;
  ownerId: string;
  status: string;
  date: string;
  completedAt?: Timestamp | Date;
}

/**
 * 평가 가능 여부 결과
 */
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

/**
 * 태그 검증 결과
 */
export interface TagValidationResult {
  valid: boolean;
  invalidTags: string[];
}

// ============================================================================
// Review Validator
// ============================================================================

/** 평가 가능한 WorkLog 상태 */
const REVIEWABLE_STATUSES = new Set(['checked_out', 'completed']);

/**
 * 리뷰 검증 클래스
 *
 * @example
 * ```typescript
 * const validator = new ReviewValidator();
 *
 * // 평가 가능 여부 확인
 * const result = validator.checkEligibility(workLog, userId, 'employer');
 *
 * // 태그 검증
 * const tagResult = validator.validateTags(['punctual', 'skilled'], 'employer');
 * ```
 */
export class ReviewValidator {
  /**
   * 평가 가능 여부 확인
   *
   * @param workLog - 근무 기록
   * @param reviewerId - 평가자 ID
   * @param reviewerType - 평가자 유형
   * @returns 평가 가능 여부 + 사유
   */
  checkEligibility(
    workLog: WorkLogForReview,
    reviewerId: string,
    reviewerType: ReviewerType
  ): ReviewEligibilityResult {
    // 1. WorkLog 상태 확인
    if (!REVIEWABLE_STATUSES.has(workLog.status)) {
      return {
        eligible: false,
        reason: '근무가 완료되지 않았습니다',
        code: 'INVALID_WORKLOG_STATUS',
      };
    }

    // 2. 본인 평가 방지
    const revieweeId =
      reviewerType === 'employer' ? workLog.staffId : workLog.ownerId;
    if (reviewerId === revieweeId) {
      return {
        eligible: false,
        reason: '본인을 평가할 수 없습니다',
        code: 'CANNOT_REVIEW_SELF',
      };
    }

    // 3. reviewerType 권한 확인
    if (reviewerType === 'employer' && reviewerId !== workLog.ownerId) {
      return {
        eligible: false,
        reason: '해당 공고의 구인자만 평가할 수 있습니다',
        code: 'UNAUTHORIZED_REVIEWER',
      };
    }
    if (reviewerType === 'staff' && reviewerId !== workLog.staffId) {
      return {
        eligible: false,
        reason: '해당 근무의 스태프만 평가할 수 있습니다',
        code: 'UNAUTHORIZED_REVIEWER',
      };
    }

    // 4. 기한 확인 (7일)
    if (this.isExpired(workLog)) {
      return {
        eligible: false,
        reason: `평가 기한(${REVIEW_DEADLINE_DAYS}일)이 만료되었습니다`,
        code: 'REVIEW_PERIOD_EXPIRED',
      };
    }

    return { eligible: true };
  }

  /**
   * 평가 기한 만료 확인
   */
  isExpired(workLog: WorkLogForReview): boolean {
    const completedAt = workLog.completedAt;
    if (!completedAt) {
      // completedAt 없으면 date 기준
      return this.isDateExpired(workLog.date);
    }

    const completedDate =
      completedAt instanceof Date
        ? completedAt
        : (completedAt as Timestamp).toDate();

    const deadline = new Date(completedDate);
    deadline.setDate(deadline.getDate() + REVIEW_DEADLINE_DAYS);
    return new Date() > deadline;
  }

  /**
   * 태그 유효성 검증
   *
   * @param tags - 선택된 태그 키 배열
   * @param reviewerType - 평가자 유형
   * @returns 검증 결과 + 유효하지 않은 태그 목록
   */
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

  /**
   * 감성과 태그 일관성 검증 (경고용, 블로킹 아님)
   *
   * @description positive 감성에 negative 태그가 있으면 경고
   */
  checkSentimentTagConsistency(
    sentiment: ReviewSentiment,
    tags: string[]
  ): { consistent: boolean; warning?: string } {
    const negativeTagKeys = new Set([
      'late', 'unprepared', 'unresponsive', 'careless',
      'delayed_pay', 'poor_environment', 'unclear_instructions', 'disrespectful',
    ]);

    const positiveTagKeys = new Set([
      'punctual', 'skilled', 'polite', 'responsive', 'proactive', 'reliable',
      'fair_pay', 'good_environment', 'clear_instructions', 'respectful', 'well_organized', 'supportive',
    ]);

    const hasNegativeTag = tags.some((t) => negativeTagKeys.has(t));
    const hasPositiveTag = tags.some((t) => positiveTagKeys.has(t));

    if (sentiment === 'positive' && hasNegativeTag && !hasPositiveTag) {
      return { consistent: false, warning: '긍정 평가에 부정 태그만 선택되었습니다' };
    }
    if (sentiment === 'negative' && hasPositiveTag && !hasNegativeTag) {
      return { consistent: false, warning: '부정 평가에 긍정 태그만 선택되었습니다' };
    }

    return { consistent: true };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * 날짜 문자열 기준 기한 확인
   */
  private isDateExpired(dateStr: string): boolean {
    const workDate = new Date(dateStr);
    const deadline = new Date(workDate);
    deadline.setDate(deadline.getDate() + REVIEW_DEADLINE_DAYS);
    return new Date() > deadline;
  }
}
