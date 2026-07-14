import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { logger } from '@/utils/logger';
import { optionalTimestampSchema, timestampSchema } from './common';
import { preQuestionsArraySchema } from './preQuestion.schema';
import { VALID_STAFF_ROLES } from '@/types/role';
import type { JobPosting, JobPostingDocumentV3 } from '@/types';
import {
  FIXED_POSTING_DURATION_DAYS,
  buildFixedSyntheticRequirement,
  deriveWorkDateFieldsFromSchedule,
  deserializeJobPostingDocument,
  getCanonicalPostingType,
  isScheduleKindCompatibleWithPostingType,
} from '@/domains/job-posting';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { isWithinUrgentDateLimit } from '@/utils/date';
import { Constants } from '@/types/supabase';
import { isRegionSlug } from '@/constants/regions';

/**
 * 공고 상태 SSOT — DB enum(posting_status)을 단일출처로 파생.
 * 인라인 z.enum 중복 하드코딩 제거 (drift 가드).
 */
const POSTING_STATUS_VALUES = Constants.public.Enums.posting_status;

export const postingTypeSchema = z.enum(['regular', 'fixed', 'tournament', 'urgent'], {
  error: 'Select a valid posting type',
});

export type PostingType = z.infer<typeof postingTypeSchema>;

export const salaryTypeSchema = z.enum(['hourly', 'daily', 'monthly', 'other'], {
  error: 'Select a valid salary type',
});

export type SalaryTypeSchema = z.infer<typeof salaryTypeSchema>;

export const roleSchema = z.enum(VALID_STAFF_ROLES, {
  error: 'Select a valid staff role',
});

export const roleRequirementSchema = z.object({
  role: roleSchema,
  count: z
    .number()
    .min(1, { message: 'At least one staff member is required' })
    .max(100, { message: 'At most 100 staff members are allowed' }),
});

export const salaryInfoSchema = z.object({
  type: salaryTypeSchema,
  amount: z.number().min(0, { message: 'Salary amount must be non-negative' }),
});

export const allowancesSchema = z
  .object({
    guaranteedHours: z.number().min(0).optional(),
    meal: z.number().optional(),
    transportation: z.number().optional(),
    accommodation: z.number().optional(),
  })
  .optional();

export const basicInfoSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Enter a title' })
    .max(25, { message: 'Title must be 25 characters or less' })
    .trim()
    .refine(xssValidation, { message: 'Unsafe text is not allowed' }),
  location: z
    .string()
    .min(1, { message: 'Enter a location' })
    .trim()
    .refine(xssValidation, { message: 'Unsafe text is not allowed' }),
  district: z
    .string()
    .trim()
    .refine(xssValidation, { message: 'Unsafe text is not allowed' })
    .optional(),
  detailedAddress: z
    .string()
    .trim()
    .max(200, { message: 'Detailed address must be 200 characters or less' })
    .refine(xssValidation, { message: 'Unsafe text is not allowed' })
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, { message: 'Description must be 500 characters or less' })
    .refine(xssValidation, { message: 'Unsafe text is not allowed' })
    .optional(),
  contactPhone: z
    .string()
    .min(1, { message: 'Enter a contact phone number' })
    .max(25, { message: 'Contact phone must be 25 characters or less' })
    .trim()
    .refine(xssValidation, { message: 'Unsafe text is not allowed' }),
});

export type BasicInfoData = z.infer<typeof basicInfoSchema>;

export const dateTimeSchema = z.object({
  workDate: z
    .string()
    .min(1, { message: 'Select a work date' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use YYYY-MM-DD format' }),
  timeSlot: z.string().min(1, { message: 'Enter a work time' }),
});

export type DateTimeData = z.infer<typeof dateTimeSchema>;

export const jobFilterSchema = z.object({
  status: z.enum(POSTING_STATUS_VALUES).optional(),
  roles: z.array(roleSchema).optional(),
  district: z.string().optional(),
  region: z.string().optional(),
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

export { applicationMessageSchema } from './application.schema';

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
    // region 은 읽기에서 enum 제한하지 않는다(미래 신규 slug 도입 시 read 증발 방지).
    region: z.string().optional(),
    detailedAddress: z.string().optional(),
  })
  .strict();

const postingLocationInputSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Enter a location name' })
      .trim()
      .refine(xssValidation, { message: 'Unsafe text is not allowed' }),
    district: z
      .string()
      .trim()
      .refine(xssValidation, { message: 'Unsafe text is not allowed' })
      .optional(),
    // 쓰기에서는 알려진 region slug 만 허용(오염 방지). 미선택은 undefined.
    region: z
      .string()
      .trim()
      .refine((v) => isRegionSlug(v), { message: 'Unknown region' })
      .optional(),
    detailedAddress: z
      .string()
      .trim()
      .max(200, { message: 'Detailed address must be 200 characters or less' })
      .refine(xssValidation, { message: 'Unsafe text is not allowed' })
      .optional(),
  })
  .strict();

const postingRoleCatalogEntrySchema = z
  .object({
    role: roleSchema,
    customRole: z.string().optional(),
    salary: salaryInfoSchema.optional(),
  })
  .strict();

// NOTE: .strict() 의도적 미사용 — 레거시 doc 의 slot role 에 박혀있는 dead counter `filled`(SP3 제거)를
// 거부하지 않고 조용히 strip 하기 위함. strict 면 저장된 prod doc 이 검증 실패로 사라진다(읽기 호환 크럭스).
const postingSlotRoleRequirementSchema = z.object({
  id: z.string().optional(),
  role: roleSchema.optional(),
  customRole: z.string().optional(),
  count: z.number(),
});

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
    date: z.string().nullable(),
    timeSlots: z.array(postingTimeSlotSchema),
    isGrouped: z.boolean().optional(),
  })
  .strict();

const postingFixedScheduleBaseSchema = z
  .object({
    kind: z.literal('fixed'),
    daysPerWeek: z.number().optional(),
    startTime: z.string().optional(),
    isStartTimeNegotiable: z.boolean().optional(),
    requirements: z.array(postingDateRequirementSchema),
  })
  .strict();

const postingScheduleSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('dated'),
        primaryDate: z.string(),
        allDates: z.array(z.string()),
        requirements: z.array(postingDateRequirementSchema),
      })
      .strict(),
    postingFixedScheduleBaseSchema,
  ])
  .superRefine((schedule, ctx) => {
    if (schedule.kind !== 'fixed') {
      return;
    }
    const { requirements } = schedule;
    if (
      requirements.length !== 1 ||
      requirements[0]?.date !== null ||
      requirements[0]?.timeSlots.length !== 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requirements'],
        message: 'fixed schedule must have exactly one requirement (date:null) with one timeSlot',
      });
    }
  });

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

export const postingConditionsSchema = z
  .object({
    dressCode: z
      .string()
      .max(50)
      .refine(xssValidation, { message: 'Unsafe text is not allowed' })
      .optional(),
    experience: z
      .string()
      .max(50)
      .refine(xssValidation, { message: 'Unsafe text is not allowed' })
      .optional(),
  })
  .strict();

const postingStatsSchema = z
  .object({
    totalApplicants: z.number(),
    activeApplicants: z.number(),
    confirmedApplicants: z.number(),
    cancellationPendingApplicants: z.number(),
    filledPositions: z.number(),
  })
  .strict();

function addContractIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message,
  });
}

function hasSameStringArray(left?: string[], right?: string[]): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function validatePostingTypeScheduleContract(
  data: {
    postingType?: PostingType;
    schedule: z.infer<typeof postingScheduleSchema>;
  },
  ctx: z.RefinementCtx
): void {
  const postingType = getCanonicalPostingType(data.postingType);

  if (!isScheduleKindCompatibleWithPostingType(postingType, data.schedule.kind)) {
    addContractIssue(ctx, ['schedule', 'kind'], 'postingType and schedule.kind must match');
  }
}

export const createJobPostingSchema = z
  .object({
    postingType: postingTypeSchema.optional().default('regular'),
    title: basicInfoSchema.shape.title,
    description: basicInfoSchema.shape.description,
    location: postingLocationInputSchema,
    contactPhone: basicInfoSchema.shape.contactPhone.optional(),
    tags: z
      .array(z.string().refine(xssValidation, { message: 'Unsafe text is not allowed' }))
      .optional(),
    schedule: postingScheduleSchema,
    roleCatalog: z.array(postingRoleCatalogEntrySchema).min(1, {
      message: 'Add at least one role',
    }),
    compensation: postingCompensationSchema,
    questions: postingQuestionsSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    validatePostingTypeScheduleContract(data, ctx);
  })
  .refine(
    (data) => {
      if (data.postingType !== 'urgent' || data.schedule.kind !== 'dated') {
        return true;
      }

      return isWithinUrgentDateLimit(data.schedule.primaryDate);
    },
    {
      message: 'Urgent postings must be within 7 days',
      path: ['schedule', 'primaryDate'],
    }
  );

export type CreateJobPostingFormData = z.infer<typeof createJobPostingSchema>;

const fixedConfigSchema = z
  .object({
    durationDays: z.literal(FIXED_POSTING_DURATION_DAYS),
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

function validateDocumentContract(
  data: {
    postingType?: PostingType;
    schedule: z.infer<typeof postingScheduleSchema>;
    workDate?: string;
    workDates?: string[];
    fixedConfig?: z.infer<typeof fixedConfigSchema>;
    tournamentConfig?: z.infer<typeof tournamentConfigSchema>;
    urgentConfig?: z.infer<typeof urgentConfigSchema>;
  },
  ctx: z.RefinementCtx
): void {
  const postingType = getCanonicalPostingType(data.postingType);
  const derivedDates = deriveWorkDateFieldsFromSchedule(data.schedule);

  validatePostingTypeScheduleContract(data, ctx);

  if (data.workDate !== derivedDates.workDate) {
    addContractIssue(ctx, ['workDate'], 'workDate must match the canonical schedule');
  }

  if (!hasSameStringArray(data.workDates, derivedDates.workDates)) {
    addContractIssue(ctx, ['workDates'], 'workDates must match canonical schedule.allDates');
  }

  const hasFixedConfig = data.fixedConfig !== undefined;
  const hasTournamentConfig = data.tournamentConfig !== undefined;
  const hasUrgentConfig = data.urgentConfig !== undefined;

  switch (postingType) {
    case 'fixed':
      if (hasTournamentConfig) {
        addContractIssue(
          ctx,
          ['tournamentConfig'],
          'fixed postings cannot include tournamentConfig'
        );
      }
      if (hasUrgentConfig) {
        addContractIssue(ctx, ['urgentConfig'], 'fixed postings cannot include urgentConfig');
      }
      break;
    case 'tournament':
      if (hasFixedConfig) {
        addContractIssue(ctx, ['fixedConfig'], 'tournament postings cannot include fixedConfig');
      }
      if (!hasTournamentConfig) {
        addContractIssue(ctx, ['tournamentConfig'], 'tournament postings require tournamentConfig');
      }
      if (hasUrgentConfig) {
        addContractIssue(ctx, ['urgentConfig'], 'tournament postings cannot include urgentConfig');
      }
      break;
    case 'urgent':
      if (hasFixedConfig) {
        addContractIssue(ctx, ['fixedConfig'], 'urgent postings cannot include fixedConfig');
      }
      if (hasTournamentConfig) {
        addContractIssue(
          ctx,
          ['tournamentConfig'],
          'urgent postings cannot include tournamentConfig'
        );
      }
      if (!hasUrgentConfig) {
        addContractIssue(ctx, ['urgentConfig'], 'urgent postings require urgentConfig');
      }
      break;
    case 'regular':
      if (hasFixedConfig) {
        addContractIssue(ctx, ['fixedConfig'], 'regular postings cannot include fixedConfig');
      }
      if (hasTournamentConfig) {
        addContractIssue(
          ctx,
          ['tournamentConfig'],
          'regular postings cannot include tournamentConfig'
        );
      }
      if (hasUrgentConfig) {
        addContractIssue(ctx, ['urgentConfig'], 'regular postings cannot include urgentConfig');
      }
      break;
  }
}

export const jobPostingDocumentSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(JOB_POSTING_SCHEMA_VERSION),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(POSTING_STATUS_VALUES),
    ownerId: z.string(),
    ownerName: z.string().optional(),
    workspaceId: z.string().uuid({ message: '올바른 워크스페이스 ID 가 아닙니다' }),
    // 운영처(venue) 컨테이너 FK(주간 배치 그리드). 일반 공고는 미설정. `.strict()` 스키마라
    // 키를 등록하지 않으면 venue_id 를 select 하는 순간 read 가 증발하고(#194 클래스),
    // 직렬화에 venueId 가 실리면 assertCanonical 이 throw 한다 — 양 경계의 필수 등록.
    venueId: z.string().uuid({ message: '올바른 운영처 ID 가 아닙니다' }).optional(),
    postingType: postingTypeSchema.optional().default('regular'),
    workDate: z.string().optional(), // fixed 공고는 work_date가 없음
    workDates: z.array(z.string()).optional(),
    roleKeys: z.array(z.string()).optional(),
    totalPositions: z.number(),
    filledPositions: z.number(),
    viewCount: z.number().optional(),
    stats: postingStatsSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    searchIndex: z.array(z.string()).optional(),
    closedAt: optionalTimestampSchema,
    closedReason: z.enum(['manual', 'expired', 'expired_by_work_date', 'filled']).optional(),
    tags: z.array(z.string()).optional(),
    contactPhone: z.string().optional(),
    location: postingLocationSchema,
    schedule: postingScheduleSchema,
    roleCatalog: z.array(postingRoleCatalogEntrySchema),
    compensation: postingCompensationSchema,
    questions: postingQuestionsSchema,
    conditions: postingConditionsSchema.optional(),
    fixedConfig: fixedConfigSchema.optional(),
    tournamentConfig: tournamentConfigSchema.optional(),
    urgentConfig: urgentConfigSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    validateDocumentContract(data, ctx);
  });

export type JobPostingDocumentData = z.infer<typeof jobPostingDocumentSchema>;

function toJobPostingDocumentV3(document: JobPostingDocumentData): JobPostingDocumentV3 {
  const { searchIndex: _searchIndex, ...rest } = document;

  return {
    ...rest,
    closedAt: rest.closedAt ?? undefined,
    tournamentConfig: rest.tournamentConfig
      ? {
          ...rest.tournamentConfig,
          approvedAt: rest.tournamentConfig.approvedAt ?? undefined,
          rejectedAt: rest.tournamentConfig.rejectedAt ?? undefined,
          resubmittedAt: rest.tournamentConfig.resubmittedAt ?? undefined,
        }
      : undefined,
  } as unknown as JobPostingDocumentV3;
}

/**
 * 레거시 fixed 스케줄(roleRequirements[]) 문서를 strict 스키마가 받아들일 수 있는
 * 통일 구조(requirements[])로 입력 단계에서 정규화한다.
 *
 * @description SP1 통일 후 fixed 스키마는 `requirements` 필수 + `.strict()`라
 * 레거시 `{kind:'fixed', roleRequirements:[...]}` 문서는 safeParse 에서 거부되어
 * 읽기 경로가 null 을 반환(공고 증발)한다. deserialize 의 역호환 흡수는 parse 통과
 * 후에만 실행되므로 도달 불가능 — 따라서 safeParse 이전에 합성 슬롯으로 변환한다.
 *
 * canonical 문서(roleRequirements 키 없음)는 원본 그대로 반환(무변경 통과).
 */
function normalizeLegacyFixedScheduleInput(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const doc = data as Record<string, unknown>;
  const schedule = doc.schedule;
  if (!schedule || typeof schedule !== 'object') return data;
  const s = schedule as Record<string, unknown>;
  if (s.kind !== 'fixed' || !('roleRequirements' in s)) return data;

  // 레거시 흡수: roleRequirements → 합성 requirements 1건 + roleRequirements 키 제거(strict 통과)
  const { roleRequirements: _legacyRoleRequirements, ...restSchedule } = s;
  return {
    ...doc,
    schedule: {
      ...restSchedule,
      requirements: [buildFixedSyntheticRequirement(s)],
    },
  };
}

export function parseJobPostingDocument(data: unknown): JobPosting | null {
  const result = jobPostingDocumentSchema.safeParse(normalizeLegacyFixedScheduleInput(data));

  if (result.success) {
    return deserializeJobPostingDocument(toJobPostingDocumentV3(result.data));
  }

  logger.warn('JobPosting document validation failed', {
    errors: result.error.flatten(),
    component: 'jobPosting.schema',
  });
  return null;
}

export function parseJobPostingDocuments(data: unknown[]): JobPosting[] {
  return data
    .map((item) => parseJobPostingDocument(item))
    .filter((item): item is JobPosting => item !== null);
}

export function isJobPostingDocument(data: unknown): data is JobPosting {
  return jobPostingDocumentSchema.safeParse(normalizeLegacyFixedScheduleInput(data)).success;
}
