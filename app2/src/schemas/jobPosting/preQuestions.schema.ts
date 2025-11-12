/**
 * PreQuestions 섹션 Zod 스키마
 *
 * 사전 질문 (질문 타입, 옵션, 필수 여부) 검증
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections/PreQuestionsSection.tsx
 */

import { z } from 'zod';
import { xssValidation, validateArrayNoXss } from '../../utils/validation/xssProtection';

/**
 * 질문 타입 열거형
 */
export const QuestionTypeSchema = z.enum(['text', 'textarea', 'select'], {
  errorMap: () => ({ message: '올바른 질문 타입을 선택해주세요' })
});

/**
 * 사전 질문 스키마
 */
export const preQuestionSchema = z.object({
  /**
   * 질문 고유 ID
   */
  id: z
    .string({
      required_error: '질문 ID가 필요합니다',
      invalid_type_error: '질문 ID는 문자열이어야 합니다'
    })
    .min(1, { message: '질문 ID는 필수입니다' }),

  /**
   * 질문 내용
   * - 최소: 2자
   * - 최대: 500자
   * - XSS 방지
   */
  question: z
    .string({
      required_error: '질문 내용을 입력해주세요',
      invalid_type_error: '질문 내용은 문자열이어야 합니다'
    })
    .min(2, { message: '질문 내용은 최소 2자 이상이어야 합니다' })
    .max(500, { message: '질문 내용은 500자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다 (XSS 차단)'
    }),

  /**
   * 필수 응답 여부
   */
  required: z
    .boolean({
      required_error: '필수 응답 여부를 지정해주세요',
      invalid_type_error: '필수 응답 여부는 boolean이어야 합니다'
    }),

  /**
   * 질문 타입
   * - text: 단답형
   * - textarea: 장문형
   * - select: 선택형
   */
  type: QuestionTypeSchema,

  /**
   * 선택형 질문의 옵션들 (select 타입일 때 필수)
   * - 최소: 2개 이상 (선택지는 최소 2개)
   * - 최대: 10개
   * - XSS 방지
   */
  options: z
    .array(
      z
        .string()
        .min(1, { message: '옵션은 최소 1자 이상이어야 합니다' })
        .max(100, { message: '옵션은 100자를 초과할 수 없습니다' })
        .trim()
        .refine(xssValidation, {
          message: '위험한 문자열이 포함되어 있습니다 (XSS 차단)'
        }),
      {
        invalid_type_error: '옵션은 문자열 배열이어야 합니다'
      }
    )
    .min(2, { message: '선택형 질문은 최소 2개 이상의 옵션이 필요합니다' })
    .max(10, { message: '옵션은 최대 10개까지 가능합니다' })
    .optional()
}).refine(
  (data) => {
    // select 타입일 때 options 필수
    if (data.type === 'select') {
      return data.options && data.options.length >= 2;
    }
    return true;
  },
  {
    message: '선택형 질문은 최소 2개 이상의 옵션이 필요합니다',
    path: ['options']
  }
);

/**
 * PreQuestions 섹션 검증 스키마 (base)
 */
export const preQuestionsSchemaBase = z.object({
  /**
   * 사전질문 사용 여부
   */
  usesPreQuestions: z
    .boolean({
      required_error: '사전질문 사용 여부를 지정해주세요',
      invalid_type_error: '사전질문 사용 여부는 boolean이어야 합니다'
    }),

  /**
   * 사전질문 배열
   * - 최소: 0개 (usesPreQuestions=false일 때)
   * - 최대: 10개
   */
  preQuestions: z
    .array(preQuestionSchema, {
      invalid_type_error: '사전질문은 배열이어야 합니다'
    })
    .max(10, { message: '사전질문은 최대 10개까지 가능합니다' })
    .optional()
    .default([])
});

/**
 * PreQuestions 섹션 검증 스키마 (refined)
 *
 * usesPreQuestions=true일 때만 검증 수행 (선택한 질문 타입만 검증)
 */
export const preQuestionsSchema = preQuestionsSchemaBase.refine(
  (data) => {
    // usesPreQuestions=false이면 검증 스킵
    if (!data.usesPreQuestions) {
      return true;
    }
    // usesPreQuestions=true일 때 최소 1개 이상의 질문 필요
    return data.preQuestions && data.preQuestions.length >= 1;
  },
  {
    message: '사전질문을 사용하려면 최소 1개 이상의 질문을 추가해주세요',
    path: ['preQuestions']
  }
);

/**
 * TypeScript 타입 추론
 */
export type PreQuestionsData = z.infer<typeof preQuestionsSchema>;
export type PreQuestionData = z.infer<typeof preQuestionSchema>;
export type QuestionType = z.infer<typeof QuestionTypeSchema>;
