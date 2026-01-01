/**
 * UNIQN Mobile - 사전질문 Zod 스키마
 *
 * @version 1.0.0
 * @description PreQuestion 답변 유효성 검증 스키마
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';

/**
 * 사전질문 타입 스키마
 */
export const preQuestionTypeSchema = z.enum(['text', 'textarea', 'select'], {
  error: '올바른 질문 타입이 아닙니다',
});

export type PreQuestionTypeData = z.infer<typeof preQuestionTypeSchema>;

/**
 * 사전질문 정의 스키마
 *
 * @description 구인공고 작성 시 질문 정의 검증
 */
export const preQuestionSchema = z
  .object({
    id: z.string().min(1, { message: '질문 ID가 필요합니다' }),
    question: z
      .string()
      .min(2, { message: '질문은 2자 이상이어야 합니다' })
      .max(200, { message: '질문은 200자를 초과할 수 없습니다' })
      .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
    required: z.boolean(),
    type: preQuestionTypeSchema,
    options: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (data) => {
      // select 타입이면 options 필수
      if (data.type === 'select') {
        return data.options && data.options.length >= 2;
      }
      return true;
    },
    {
      message: '선택형 질문은 최소 2개 이상의 옵션이 필요합니다',
      path: ['options'],
    }
  );

export type PreQuestionFormData = z.infer<typeof preQuestionSchema>;

/**
 * 사전질문 배열 스키마
 */
export const preQuestionsArraySchema = z
  .array(preQuestionSchema)
  .max(10, { message: '사전질문은 최대 10개까지 등록 가능합니다' });

export type PreQuestionsArrayData = z.infer<typeof preQuestionsArraySchema>;

/**
 * 사전질문 답변 스키마
 *
 * @description 지원 시 답변 검증
 */
export const preQuestionAnswerSchema = z.object({
  questionId: z.string().min(1, { message: '질문 ID가 필요합니다' }),
  question: z.string(),
  answer: z
    .string()
    .max(1000, { message: '답변은 1000자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  required: z.boolean(),
});

export type PreQuestionAnswerData = z.infer<typeof preQuestionAnswerSchema>;

/**
 * 사전질문 답변 배열 스키마
 */
export const preQuestionAnswersArraySchema = z.array(preQuestionAnswerSchema);

export type PreQuestionAnswersArrayData = z.infer<typeof preQuestionAnswersArraySchema>;

/**
 * 사전질문 답변 검증 (필수 답변 체크)
 *
 * @description 모든 필수 질문에 답변이 있는지 검증하는 스키마
 */
export const validateRequiredAnswersSchema = z.array(preQuestionAnswerSchema).refine(
  (answers) => {
    return answers.every((answer) => {
      if (answer.required) {
        return answer.answer.trim().length > 0;
      }
      return true;
    });
  },
  {
    message: '필수 질문에 모두 답변해주세요',
  }
);

/**
 * 지원서 생성 + 사전질문 통합 스키마
 */
export const createApplicationWithPreQuestionsSchema = z.object({
  jobPostingId: z.string().min(1, { message: '공고 ID가 필요합니다' }),
  appliedRole: z.string().min(1, { message: '역할을 선택해주세요' }),
  preQuestionAnswers: validateRequiredAnswersSchema.optional(),
  message: z
    .string()
    .max(200, { message: '메시지는 200자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
});

export type CreateApplicationWithPreQuestionsData = z.infer<
  typeof createApplicationWithPreQuestionsSchema
>;
