/**
 * UNIQN Mobile - 리뷰/평가 관련 Zod 스키마
 *
 * @description 버블 (Bubble) 상호 평가 입력 검증
 * @version 1.0.0
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { REVIEW_TAG_LIMITS, REVIEW_COMMENT_MAX_LENGTH } from '@/types/review';

// ============================================================================
// 기본 스키마
// ============================================================================

/**
 * 평가자 유형 스키마
 */
export const reviewerTypeSchema = z.enum(['employer', 'staff'], {
  error: '올바른 평가자 유형을 선택해주세요',
});

export type ReviewerTypeSchema = z.infer<typeof reviewerTypeSchema>;

/**
 * 감성 스키마
 */
export const reviewSentimentSchema = z.enum(['positive', 'neutral', 'negative'], {
  error: '평가를 선택해주세요',
});

export type ReviewSentimentSchema = z.infer<typeof reviewSentimentSchema>;

/**
 * 구인자 → 스태프 태그 스키마
 */
export const employerToStaffTagSchema = z.enum([
  'punctual',
  'skilled',
  'polite',
  'responsive',
  'proactive',
  'reliable',
  'late',
  'unprepared',
  'unresponsive',
  'careless',
]);

/**
 * 스태프 → 구인자 태그 스키마
 */
export const staffToEmployerTagSchema = z.enum([
  'fair_pay',
  'good_environment',
  'clear_instructions',
  'respectful',
  'well_organized',
  'supportive',
  'delayed_pay',
  'poor_environment',
  'unclear_instructions',
  'disrespectful',
]);

/**
 * 통합 태그 스키마
 */
export const reviewTagSchema = z.union([employerToStaffTagSchema, staffToEmployerTagSchema]);

// ============================================================================
// 리뷰 생성 스키마
// ============================================================================

/**
 * 리뷰 생성 입력 스키마
 */
export const createReviewInputSchema = z.object({
  workLogId: z.string().min(1, '근무 기록 ID가 필요합니다'),
  jobPostingId: z.string().min(1, '공고 ID가 필요합니다'),
  jobPostingTitle: z.string().min(1, '공고 제목이 필요합니다'),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  revieweeId: z.string().min(1, '피평가자 ID가 필요합니다'),
  revieweeName: z.string().min(1, '피평가자 이름이 필요합니다'),
  reviewerType: reviewerTypeSchema,
  sentiment: reviewSentimentSchema,
  tags: z
    .array(reviewTagSchema)
    .min(REVIEW_TAG_LIMITS.MIN, `태그를 최소 ${REVIEW_TAG_LIMITS.MIN}개 선택해주세요`)
    .max(REVIEW_TAG_LIMITS.MAX, `태그는 최대 ${REVIEW_TAG_LIMITS.MAX}개까지 선택 가능합니다`)
    .refine((arr) => new Set(arr).size === arr.length, '중복된 태그가 있습니다'),
  comment: z
    .string()
    .max(REVIEW_COMMENT_MAX_LENGTH, `코멘트는 최대 ${REVIEW_COMMENT_MAX_LENGTH}자까지 입력 가능합니다`)
    .refine((val) => !val || xssValidation(val), '잘못된 입력이 감지되었습니다')
    .optional(),
});

export type CreateReviewInputSchema = z.infer<typeof createReviewInputSchema>;

/**
 * 리뷰 폼 스키마 (UI 입력용 — workLogId 등 메타 필드 제외)
 */
export const reviewFormSchema = z.object({
  sentiment: reviewSentimentSchema,
  tags: z
    .array(reviewTagSchema)
    .min(REVIEW_TAG_LIMITS.MIN, `태그를 최소 ${REVIEW_TAG_LIMITS.MIN}개 선택해주세요`)
    .max(REVIEW_TAG_LIMITS.MAX, `태그는 최대 ${REVIEW_TAG_LIMITS.MAX}개까지 선택 가능합니다`)
    .refine((arr) => new Set(arr).size === arr.length, '중복된 태그가 있습니다'),
  comment: z
    .string()
    .max(REVIEW_COMMENT_MAX_LENGTH, `코멘트는 최대 ${REVIEW_COMMENT_MAX_LENGTH}자까지 입력 가능합니다`)
    .refine((val) => !val || xssValidation(val), '잘못된 입력이 감지되었습니다')
    .optional(),
});

export type ReviewFormSchema = z.infer<typeof reviewFormSchema>;
