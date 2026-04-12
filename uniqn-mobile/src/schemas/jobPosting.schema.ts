import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { logger } from '@/utils/logger';
import { optionalTimestampSchema, timestampSchema } from './common';
import { preQuestionsArraySchema } from './preQuestion.schema';
import { VALID_STAFF_ROLES } from '@/types/role';
import type { JobPosting, JobPostingDocumentV3 } from '@/types';
import {
  FIXED_POSTING_DURATION_DAYS,
  deriveWorkDateFieldsFromSchedule,
  deserializeJobPostingDocument,
  getCanonicalPostingType,
  isScheduleKindCompatibleWithPostingType,
} from '@/domains/job-posting';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { isWithinUrgentDateLimit } from '@/utils/date';

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
  status: z
    .enum(['draft', 'pending', 'approved', 'active', 'closed', 'cancelled', 'expired', 'rejected'])
    .optional(),
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
      .min(1, { message: 'Enter a location name' })
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
    workDate: string;
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
    status: z.enum([
      'draft',
      'pending',
      'approved',
      'active',
      'closed',
      'cancelled',
      'expired',
      'rejected',
    ]),
    ownerId: z.string(),
    ownerName: z.string().optional(),
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
