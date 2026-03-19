/**
 * UNIQN Mobile - 구인공고 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { logger } from '@/utils/logger';
import { optionalTimestampSchema, timestampSchema } from './common';
import { preQuestionsArraySchema } from './preQuestion.schema';
import { VALID_STAFF_ROLES } from '@/types/role';
import type { JobPosting, JobPostingDocumentV3 } from '@/types';
import {
  deserializeJobPostingDocument,
  deserializeLegacyJobPostingDocument,
} from '@/domains/job-posting';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types';
import { isWithinUrgentDateLimit } from '@/utils/date';

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
export const roleSchema = z.enum(VALID_STAFF_ROLES, {
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
    .trim()
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),

  district: z
    .string()
    .trim()
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),

  detailedAddress: z
    .string()
    .trim()
    .max(200, { message: '상세 주소는 200자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
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
    .trim()
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
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
    tags: z
      .array(z.string().refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }))
      .optional(),
  })
  .refine(
    (data) => {
      // 긴급 공고는 7일 이내만 가능
      if (data.postingType === 'urgent' || data.isUrgent) {
        return isWithinUrgentDateLimit(data.workDate);
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

// applicationMessageSchema는 application.schema.ts에서 정의됨
// 하위 호환성을 위해 re-export
export { applicationMessageSchema } from './application.schema';

// ============================================================================
// Firestore 문서 검증 스키마 (런타임 타입 검증)
// ============================================================================

const taxableItemsSchema = z
  .object({
    basePay: z.boolean().optional(),
    meal: z.boolean().optional(),
    transportation: z.boolean().optional(),
    accommodation: z.boolean().optional(),
    additional: z.boolean().optional(),
  })
  .strict();

const taxSettingsSchema = z
  .object({
    type: z.enum(['none', 'rate', 'fixed']),
    value: z.number(),
    taxableItems: taxableItemsSchema.optional(),
  })
  .strict();

const postingLocationSchema = z
  .object({
    name: z.string(),
    district: z.string().optional(),
    detailedAddress: z.string().optional(),
  })
  .strict();

const postingRoleCatalogEntrySchema = z
  .object({
    role: roleSchema,
    customRole: z.string().optional(),
    salary: salaryInfoSchema.optional(),
  })
  .strict();

const postingSlotRoleRequirementSchema = z
  .object({
    id: z.string().optional(),
    role: roleSchema.optional(),
    customRole: z.string().optional(),
    count: z.number(),
    filled: z.number().optional(),
  })
  .strict();

const postingTimeSlotSchema = z
  .object({
    id: z.string().optional(),
    startTime: z.string().optional(),
    isTimeToBeAnnounced: z.boolean().optional(),
    tentativeDescription: z.string().optional(),
    roles: z.array(postingSlotRoleRequirementSchema),
  })
  .strict();

const postingDateRequirementSchema = z
  .object({
    date: z.string(),
    timeSlots: z.array(postingTimeSlotSchema),
    isGrouped: z.boolean().optional(),
  })
  .strict();

const postingFixedRoleRequirementSchema = z
  .object({
    role: roleSchema.optional(),
    customRole: z.string().optional(),
    count: z.number(),
    filled: z.number().optional(),
  })
  .strict();

const postingScheduleSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('dated'),
      primaryDate: z.string(),
      allDates: z.array(z.string()),
      requirements: z.array(postingDateRequirementSchema),
    })
    .strict(),
  z
    .object({
      kind: z.literal('fixed'),
      daysPerWeek: z.number().optional(),
      startTime: z.string().optional(),
      isStartTimeNegotiable: z.boolean().optional(),
      roleRequirements: z.array(postingFixedRoleRequirementSchema).optional(),
    })
    .strict(),
]);

const postingCompensationSchema = z
  .object({
    mode: z.enum(['shared', 'by_role']),
    defaultSalary: salaryInfoSchema.optional(),
    allowances: allowancesSchema,
    taxSettings: taxSettingsSchema.optional(),
  })
  .strict();

const postingQuestionsSchema = z
  .object({
    items: preQuestionsArraySchema,
  })
  .strict();

const fixedConfigSchema = z
  .object({
    durationDays: z.literal(7),
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

const tournamentConfigSchema = z
  .object({
    approvalStatus: z.enum(['pending', 'approved', 'rejected']),
    approvedBy: z.string().optional(),
    approvedAt: optionalTimestampSchema,
    rejectedBy: z.string().optional(),
    rejectedAt: optionalTimestampSchema,
    rejectionReason: z.string().optional(),
    resubmittedAt: optionalTimestampSchema,
    submittedAt: timestampSchema,
  })
  .strict();

const urgentConfigSchema = z
  .object({
    createdAt: timestampSchema,
    priority: z.literal('high'),
  })
  .strict();

/**
 * JobPosting V3 Firestore 문서 스키마.
 *
 * @description 저장 문서는 strict V3 구조만 허용한다.
 * 레거시(V2 이하) 문서는 parse 단계에서 adapter로만 흡수한다.
 */
export const jobPostingDocumentSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(JOB_POSTING_SCHEMA_VERSION),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(['active', 'closed', 'cancelled']),
    ownerId: z.string(),
    ownerName: z.string().optional(),
    postingType: postingTypeSchema.optional(),
    workDate: z.string(),
    workDates: z.array(z.string()).optional(),
    roleKeys: z.array(z.string()).optional(),
    totalPositions: z.number(),
    filledPositions: z.number(),
    viewCount: z.number().optional(),
    applicationCount: z.number().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    closedAt: optionalTimestampSchema,
    closedReason: z.enum(['manual', 'expired', 'expired_by_work_date']).optional(),
    tags: z.array(z.string()).optional(),
    contactPhone: z.string().optional(),
    location: postingLocationSchema,
    schedule: postingScheduleSchema,
    roleCatalog: z.array(postingRoleCatalogEntrySchema),
    compensation: postingCompensationSchema,
    questions: postingQuestionsSchema,
    fixedConfig: fixedConfigSchema.optional(),
    tournamentConfig: tournamentConfigSchema.optional(),
    urgentConfig: urgentConfigSchema.optional(),
  })
  .strict();

export type JobPostingDocumentData = z.infer<typeof jobPostingDocumentSchema>;

function toJobPostingDocumentV3(document: JobPostingDocumentData): JobPostingDocumentV3 {
  return {
    ...document,
    closedAt: document.closedAt ?? undefined,
    tournamentConfig: document.tournamentConfig
      ? {
          ...document.tournamentConfig,
          approvedAt: document.tournamentConfig.approvedAt ?? undefined,
          rejectedAt: document.tournamentConfig.rejectedAt ?? undefined,
          resubmittedAt: document.tournamentConfig.resubmittedAt ?? undefined,
        }
      : undefined,
  } as JobPostingDocumentV3;
}

/**
 * 단일 JobPosting 문서 안전 파싱
 *
 * @param data Firestore에서 읽은 원시 데이터
 * @returns 검증된 JobPosting 또는 null (검증 실패 시)
 */
export function parseJobPostingDocument(data: unknown): JobPosting | null {
  const result = jobPostingDocumentSchema.safeParse(data);

  if (result.success) {
    return deserializeJobPostingDocument(toJobPostingDocumentV3(result.data));
  }

  const legacyParsed = deserializeLegacyJobPostingDocument(data);
  if (legacyParsed) {
    logger.info('레거시 JobPosting 문서를 adapter로 변환', {
      jobPostingId:
        data && typeof data === 'object' && 'id' in data
          ? String((data as Record<string, unknown>).id ?? '')
          : undefined,
      component: 'jobPosting.schema',
    });
    return legacyParsed;
  }

  logger.warn('JobPosting 문서 검증 실패', {
    errors: result.error.flatten(),
    component: 'jobPosting.schema',
  });
  return null;
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
