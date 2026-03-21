import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { logger } from '@/utils/logger';
import { optionalTimestampSchema, timestampSchema } from './common';
import { preQuestionsArraySchema } from './preQuestion.schema';
import { VALID_STAFF_ROLES } from '@/types/role';
import type { JobPosting, JobPostingDocumentV3 } from '@/types';
import { deserializeJobPostingDocument } from '@/domains/job-posting';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types';
import { isWithinUrgentDateLimit } from '@/utils/date';

export const postingTypeSchema = z.enum(['regular', 'fixed', 'tournament', 'urgent'], {
  error: '올바른 공고 타입을 선택해주세요',
});

export type PostingType = z.infer<typeof postingTypeSchema>;

export const salaryTypeSchema = z.enum(['hourly', 'daily', 'monthly', 'other'], {
  error: '올바른 급여 타입을 선택해주세요',
});

export type SalaryTypeSchema = z.infer<typeof salaryTypeSchema>;

export const roleSchema = z.enum(VALID_STAFF_ROLES, {
  error: '올바른 역할을 선택해주세요',
});

export const roleRequirementSchema = z.object({
  role: roleSchema,
  count: z
    .number()
    .min(1, { message: '최소 1명 이상이어야 합니다' })
    .max(100, { message: '최대 100명까지 가능합니다' }),
});

export const salaryInfoSchema = z.object({
  type: salaryTypeSchema,
  amount: z.number().min(0, { message: '급여는 0 이상이어야 합니다' }),
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
    .min(1, { message: '공고 제목을 입력해주세요' })
    .max(25, { message: '공고 제목은 25자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
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
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
  contactPhone: z
    .string()
    .min(1, { message: '문의 연락처를 입력해주세요' })
    .max(25, { message: '문의 연락처는 25자를 초과할 수 없습니다' })
    .trim()
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
});

export type BasicInfoData = z.infer<typeof basicInfoSchema>;

export const dateTimeSchema = z.object({
  workDate: z
    .string()
    .min(1, { message: '근무 날짜를 선택해주세요' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
  timeSlot: z.string().min(1, { message: '근무 시간을 입력해주세요' }),
});

export type DateTimeData = z.infer<typeof dateTimeSchema>;

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
    detailedAddress: z.string().optional(),
  })
  .strict();

const postingLocationInputSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: '근무 장소를 선택해주세요' })
      .trim()
      .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
    address: z
      .string()
      .trim()
      .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
      .optional(),
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
    coordinates: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
      })
      .strict()
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

export const createJobPostingSchema = z
  .object({
    postingType: postingTypeSchema.optional().default('regular'),
    title: basicInfoSchema.shape.title,
    description: basicInfoSchema.shape.description,
    location: postingLocationInputSchema,
    contactPhone: basicInfoSchema.shape.contactPhone.optional(),
    tags: z
      .array(z.string().refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }))
      .optional(),
    schedule: postingScheduleSchema,
    roleCatalog: z.array(postingRoleCatalogEntrySchema).min(1, {
      message: '최소 1개 역할을 추가해주세요',
    }),
    compensation: postingCompensationSchema,
    questions: postingQuestionsSchema,
  })
  .strict()
  .refine(
    (data) => {
      if (data.postingType !== 'urgent' || data.schedule.kind !== 'dated') {
        return true;
      }

      return isWithinUrgentDateLimit(data.schedule.primaryDate);
    },
    {
      message: '긴급 공고는 오늘부터 최대 7일 이내의 날짜만 가능합니다',
      path: ['schedule', 'primaryDate'],
    }
  );

export type CreateJobPostingFormData = z.infer<typeof createJobPostingSchema>;

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
    searchIndex: z.array(z.string()).optional(),
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
  };
}

export function parseJobPostingDocument(data: unknown): JobPosting | null {
  const result = jobPostingDocumentSchema.safeParse(data);

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
  return jobPostingDocumentSchema.safeParse(data).success;
}
