/**
 * BasicInfo 섹션 Zod 스키마
 *
 * 구인공고 기본 정보 (제목, 장소, 설명, 공고 타입) 검증
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections/BasicInfoSection.tsx
 */

import { z } from 'zod';
import { xssValidation } from '../../utils/validation/xssProtection';

/**
 * 공고 타입 열거형
 */
export const PostingTypeSchema = z.enum(['regular', 'fixed', 'tournament', 'urgent'], {
  errorMap: () => ({ message: '올바른 공고 타입을 선택해주세요' })
});

/**
 * BasicInfo 섹션 검증 스키마
 *
 * 검증 규칙:
 * - title: 2자 이상, 100자 이하
 * - location: 필수 입력
 * - description: 10자 이상 (상세한 설명 요구)
 * - postingType: 유효한 공고 타입
 */
export const basicInfoSchema = z.object({
  /**
   * 공고 제목
   * - 최소: 2자
   * - 최대: 100자
   * - XSS 방지
   */
  title: z
    .string({
      required_error: '공고 제목을 입력해주세요',
      invalid_type_error: '공고 제목은 문자열이어야 합니다'
    })
    .min(2, { message: '공고 제목은 최소 2자 이상이어야 합니다' })
    .max(100, { message: '공고 제목은 100자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다 (XSS 차단)'
    }),

  /**
   * 근무 장소
   * - 필수 입력
   */
  location: z
    .string({
      required_error: '근무 장소를 선택해주세요',
      invalid_type_error: '근무 장소는 문자열이어야 합니다'
    })
    .min(1, { message: '근무 장소를 선택해주세요' })
    .trim(),

  /**
   * 시/군/구 (선택)
   */
  district: z
    .string()
    .trim()
    .optional(),

  /**
   * 상세 주소 (선택)
   */
  detailedAddress: z
    .string()
    .trim()
    .max(200, { message: '상세 주소는 200자를 초과할 수 없습니다' })
    .optional(),

  /**
   * 공고 설명
   * - 최소: 10자 (상세한 설명 요구)
   * - 최대: 2000자
   * - XSS 방지
   */
  description: z
    .string({
      required_error: '공고 설명을 입력해주세요',
      invalid_type_error: '공고 설명은 문자열이어야 합니다'
    })
    .min(10, { message: '공고 설명은 최소 10자 이상이어야 합니다' })
    .max(2000, { message: '공고 설명은 2000자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다 (XSS 차단)'
    }),

  /**
   * 공고 타입
   * - regular: 정기 공고
   * - fixed: 고정 공고
   * - tournament: 토너먼트 공고
   * - urgent: 긴급 공고
   */
  postingType: PostingTypeSchema,

  /**
   * 문의 연락처 (선택)
   */
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9-+()]*$/, { message: '올바른 전화번호 형식이 아닙니다' })
    .optional()
});

/**
 * TypeScript 타입 추론
 */
export type BasicInfoData = z.infer<typeof basicInfoSchema>;
