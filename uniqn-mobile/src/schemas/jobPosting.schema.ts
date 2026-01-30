/**
 * UNIQN Mobile - 구인공고 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { logger } from '@/utils/logger';
import { timestampSchema } from './common';
import type { JobPosting } from '@/types';

/**
 * 공고 타입 스키마
 */
export const postingTypeSchema = z.enum(['regular', 'fixed', 'tournament', 'urgent'], {
  error: '올바른 공고 타입을 선택해주세요',
});

export type PostingType = z.infer<typeof postingTypeSchema>;

/**
 * 급여 타입 스키마
 */
export const salaryTypeSchema = z.enum(['hourly', 'daily', 'monthly', 'other'], {
  error: '올바른 급여 타입을 선택해주세요',
});

export type SalaryTypeSchema = z.infer<typeof salaryTypeSchema>;

/**
 * 역할 스키마
 */
export const roleSchema = z.enum(['dealer', 'manager', 'chiprunner', 'admin'], {
  error: '올바른 역할을 선택해주세요',
});

/**
 * 역할별 모집 인원 스키마
 */
export const roleRequirementSchema = z.object({
  role: roleSchema,
  count: z
    .number()
    .min(1, { message: '최소 1명 이상이어야 합니다' })
    .max(100, { message: '최대 100명까지 가능합니다' }),
});

/**
 * 급여 정보 스키마
 */
export const salaryInfoSchema = z.object({
  type: salaryTypeSchema,
  amount: z.number().min(0, { message: '급여는 0 이상이어야 합니다' }),
});

/**
 * 수당 정보 스키마
 * - guaranteedHours: 보장시간
 * - meal/transportation/accommodation: 금액 또는 -1 (제공 플래그)
 */
export const allowancesSchema = z
  .object({
    guaranteedHours: z.number().min(0).optional(),
    meal: z.number().optional(), // -1 = 제공
    transportation: z.number().optional(), // -1 = 제공
    accommodation: z.number().optional(), // -1 = 제공
  })
  .optional();

/**
 * 기본 정보 스키마
 */
export const basicInfoSchema = z.object({
  title: z
    .string()
    .min(1, { message: '공고 제목을 입력해주세요' })
    .max(25, { message: '공고 제목은 25자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다',
    }),

  location: z
    .string()
    .min(1, { message: '근무 장소를 선택해주세요' })
    .trim(),

  district: z.string().trim().optional(),

  detailedAddress: z
    .string()
    .trim()
    .max(200, { message: '상세 주소는 200자를 초과할 수 없습니다' })
    .optional(),

  description: z
    .string()
    .trim()
    .max(500, { message: '공고 설명은 500자를 초과할 수 없습니다' })
    .refine(xssValidation, {
      message: '위험한 문자열이 포함되어 있습니다',
    })
    .optional(),

  contactPhone: z
    .string()
    .min(1, { message: '문의 연락처를 입력해주세요' })
    .max(25, { message: '문의 연락처는 25자를 초과할 수 없습니다' })
    .trim(),
});

export type BasicInfoData = z.infer<typeof basicInfoSchema>;

/**
 * 날짜/시간 정보 스키마
 */
export const dateTimeSchema = z.object({
  workDate: z
    .string()
    .min(1, { message: '근무 날짜를 선택해주세요' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),

  timeSlot: z.string().min(1, { message: '근무 시간을 입력해주세요' }),
});

export type DateTimeData = z.infer<typeof dateTimeSchema>;

/**
 * 공고 생성 전체 스키마
 */
export const createJobPostingSchema = basicInfoSchema
  .merge(dateTimeSchema)
  .extend({
    postingType: postingTypeSchema.optional().default('regular'),
    roles: z.array(roleRequirementSchema).min(1, { message: '최소 1개 역할을 추가해주세요' }),
    salary: salaryInfoSchema,
    allowances: allowancesSchema,
    isUrgent: z.boolean().optional().default(false),
    tags: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      // 긴급 공고는 7일 이내만 가능
      if (data.postingType === 'urgent' || data.isUrgent) {
        const targetDate = new Date(data.workDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDays >= 0 && diffDays <= 7;
      }
      return true;
    },
    {
      message: '긴급 공고는 오늘부터 최대 7일 이내의 날짜만 가능합니다',
      path: ['workDate'],
    }
  );

export type CreateJobPostingFormData = z.infer<typeof createJobPostingSchema>;

/**
 * 공고 필터 스키마
 */
export const jobFilterSchema = z.object({
  status: z.enum(['active', 'closed', 'cancelled']).optional(),
  roles: z.array(roleSchema).optional(),
  district: z.string().optional(),
  dateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  searchTerm: z.string().optional(),
  isUrgent: z.boolean().optional(),
});

export type JobFilterData = z.infer<typeof jobFilterSchema>;

/**
 * 지원 메시지 스키마
 */
export const applicationMessageSchema = z
  .string()
  .max(200, { message: '메시지는 200자를 초과할 수 없습니다' })
  .refine(xssValidation, {
    message: '위험한 문자열이 포함되어 있습니다',
  })
  .optional();

// ============================================================================
// Firestore 문서 검증 스키마 (런타임 타입 검증)
// ============================================================================

/**
 * JobPosting Firestore 문서 스키마 (런타임 검증)
 *
 * @description Firestore에서 읽은 데이터의 타입 안전성을 보장
 * .passthrough()로 알려지지 않은 필드 허용 (하위 호환성)
 */
export const jobPostingDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'closed', 'cancelled']),

  // 장소 정보
  location: z.object({
    name: z.string(),
    district: z.string().optional(),
  }),
  detailedAddress: z.string().optional(),
  contactPhone: z.string().optional(),

  // 일정 정보 (쿼리용 필수 필드)
  workDate: z.string(),
  timeSlot: z.string(),

  // 모집 정보
  roles: z.array(z.object({
    role: z.string(),
    count: z.number(),
    filled: z.number().optional(),
    customRole: z.string().optional(),
    salary: z.object({
      type: salaryTypeSchema,
      amount: z.number(),
    }).optional(),
  })),
  totalPositions: z.number(),
  filledPositions: z.number(),

  // 소유자 정보
  ownerId: z.string(),
  ownerName: z.string().optional(),

  // 메타데이터
  postingType: postingTypeSchema.optional(),
  isUrgent: z.boolean().optional(),
  viewCount: z.number().optional(),
  applicationCount: z.number().optional(),

  // Timestamps (Firebase Timestamp)
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).passthrough();

export type JobPostingDocumentData = z.infer<typeof jobPostingDocumentSchema>;

/**
 * 단일 JobPosting 문서 안전 파싱
 *
 * @param data Firestore에서 읽은 원시 데이터
 * @returns 검증된 JobPosting 또는 null (검증 실패 시)
 */
export function parseJobPostingDocument(data: unknown): JobPosting | null {
  const result = jobPostingDocumentSchema.safeParse(data);
  if (!result.success) {
    logger.warn('JobPosting 문서 검증 실패', {
      errors: result.error.flatten(),
      component: 'jobPosting.schema',
    });
    return null;
  }
  return result.data as JobPosting;
}

/**
 * JobPosting 문서 배열 안전 파싱
 *
 * @param data Firestore에서 읽은 원시 데이터 배열
 * @returns 검증된 JobPosting 배열 (검증 실패 항목은 제외)
 */
export function parseJobPostingDocuments(data: unknown[]): JobPosting[] {
  return data
    .map((item) => parseJobPostingDocument(item))
    .filter((item): item is JobPosting => item !== null);
}

/**
 * JobPosting 타입 가드
 */
export function isJobPostingDocument(data: unknown): data is JobPosting {
  return jobPostingDocumentSchema.safeParse(data).success;
}
