import { z } from 'zod';
import { REVIEW_COMMENT_MAX_LENGTH, REVIEW_TAG_LIMITS } from '@/types/review';
import { xssValidation } from '@/utils/security';

export const reviewerTypeSchema = z.enum(['employer', 'staff'], {
  error: '올바른 평가자 유형을 선택해주세요',
});

export type ReviewerTypeSchema = z.infer<typeof reviewerTypeSchema>;

export const reviewSentimentSchema = z.enum(['positive', 'neutral', 'negative'], {
  error: '평가를 선택해주세요',
});

export type ReviewSentimentSchema = z.infer<typeof reviewSentimentSchema>;

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

export const reviewTagSchema = z.union([employerToStaffTagSchema, staffToEmployerTagSchema]);

const reviewWorkDateSchema = z.union([
  z.literal(''),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
]);

export const createReviewInputSchema = z.object({
  workLogId: z.string().min(1, '근무 기록 ID가 필요합니다'),
  jobPostingId: z.string().min(1, '공고 ID가 필요합니다'),
  jobPostingTitle: z.string().min(1, '공고 제목이 필요합니다'),
  workDate: reviewWorkDateSchema,
  revieweeId: z.string().min(1, '평가 대상 ID가 필요합니다'),
  revieweeName: z.string().min(1, '평가 대상 이름이 필요합니다'),
  reviewerType: reviewerTypeSchema,
  sentiment: reviewSentimentSchema,
  tags: z
    .array(reviewTagSchema)
    .min(REVIEW_TAG_LIMITS.MIN, `태그를 최소 ${REVIEW_TAG_LIMITS.MIN}개 선택해주세요`)
    .max(REVIEW_TAG_LIMITS.MAX, `태그는 최대 ${REVIEW_TAG_LIMITS.MAX}개까지 선택 가능합니다`)
    .refine((arr) => new Set(arr).size === arr.length, '중복된 태그가 있습니다'),
  comment: z
    .string()
    .max(
      REVIEW_COMMENT_MAX_LENGTH,
      `코멘트는 최대 ${REVIEW_COMMENT_MAX_LENGTH}자까지 입력 가능합니다`
    )
    .refine((value) => !value || xssValidation(value), '잘못된 입력이 감지되었습니다')
    .optional(),
});

export type CreateReviewInputSchema = z.infer<typeof createReviewInputSchema>;

export const reviewFormSchema = z.object({
  sentiment: reviewSentimentSchema,
  tags: z
    .array(reviewTagSchema)
    .min(REVIEW_TAG_LIMITS.MIN, `태그를 최소 ${REVIEW_TAG_LIMITS.MIN}개 선택해주세요`)
    .max(REVIEW_TAG_LIMITS.MAX, `태그는 최대 ${REVIEW_TAG_LIMITS.MAX}개까지 선택 가능합니다`)
    .refine((arr) => new Set(arr).size === arr.length, '중복된 태그가 있습니다'),
  comment: z
    .string()
    .max(
      REVIEW_COMMENT_MAX_LENGTH,
      `코멘트는 최대 ${REVIEW_COMMENT_MAX_LENGTH}자까지 입력 가능합니다`
    )
    .refine((value) => !value || xssValidation(value), '잘못된 입력이 감지되었습니다')
    .optional(),
});

export type ReviewFormSchema = z.infer<typeof reviewFormSchema>;
