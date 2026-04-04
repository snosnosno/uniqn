import { z } from 'zod';
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_TAG_LIMITS,
  getSentimentTagConsistency,
} from '@/types/review';
import { xssValidation } from '@/utils/security';

export const reviewerTypeSchema = z.enum(['employer', 'staff'], {
  error: '올바른 리뷰어 유형을 선택해 주세요.',
});

export type ReviewerTypeSchema = z.infer<typeof reviewerTypeSchema>;

export const reviewSentimentSchema = z.enum(['positive', 'neutral', 'negative'], {
  error: '리뷰 감정을 선택해 주세요.',
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
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다.'),
]);

const reviewTagsSchema = z
  .array(reviewTagSchema)
  .min(REVIEW_TAG_LIMITS.MIN, `태그를 최소 ${REVIEW_TAG_LIMITS.MIN}개 선택해 주세요.`)
  .max(REVIEW_TAG_LIMITS.MAX, `태그는 최대 ${REVIEW_TAG_LIMITS.MAX}개까지 선택할 수 있어요.`)
  .refine((arr) => new Set(arr).size === arr.length, '중복된 태그는 선택할 수 없어요.');

const reviewCommentSchema = z
  .string()
  .max(
    REVIEW_COMMENT_MAX_LENGTH,
    `코멘트는 최대 ${REVIEW_COMMENT_MAX_LENGTH}자까지 입력할 수 있어요.`
  )
  .refine((value) => !value || xssValidation(value), '허용되지 않는 입력이 포함되어 있어요.')
  .optional();

function addSentimentTagIssue(
  value: { sentiment: z.infer<typeof reviewSentimentSchema>; tags: string[] },
  ctx: z.RefinementCtx
) {
  const consistency = getSentimentTagConsistency(value.sentiment, value.tags);

  if (!consistency.consistent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tags'],
      message: consistency.message ?? '선택한 감정과 태그가 일치하지 않습니다.',
    });
  }
}

export const createReviewInputSchema = z
  .object({
    workLogId: z.string().min(1, '근무 기록 ID가 필요합니다.'),
    jobPostingId: z.string().min(1, '공고 ID가 필요합니다.'),
    jobPostingTitle: z.string().min(1, '공고 제목이 필요합니다.'),
    workDate: reviewWorkDateSchema,
    revieweeId: z.string().min(1, '리뷰 대상 ID가 필요합니다.'),
    revieweeName: z.string().min(1, '리뷰 대상 이름이 필요합니다.'),
    reviewerType: reviewerTypeSchema,
    sentiment: reviewSentimentSchema,
    tags: reviewTagsSchema,
    comment: reviewCommentSchema,
  })
  .superRefine(addSentimentTagIssue);

export type CreateReviewInputSchema = z.infer<typeof createReviewInputSchema>;

export const reviewFormSchema = z
  .object({
    sentiment: reviewSentimentSchema,
    tags: reviewTagsSchema,
    comment: reviewCommentSchema,
  })
  .superRefine(addSentimentTagIssue);

export type ReviewFormSchema = z.infer<typeof reviewFormSchema>;
