import { z } from 'zod';
import { xssValidation } from '@/utils/security';

const assignmentRoleIdSchema = z
  .string()
  .min(1, { message: '최소 1개 이상의 역할을 선택해주세요' })
  .refine(xssValidation, { message: '위험한 문자가 포함되어 있습니다' });

export const roleIdsSchema = z.array(assignmentRoleIdSchema).min(1, {
  message: '최소 1개 이상의 역할을 선택해주세요',
});

export const timeSlotSchema = z.string().min(1, { message: '시간대를 선택해주세요' });

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)',
});

export const datesArraySchema = z.array(dateSchema).min(1, {
  message: '최소 1개 이상의 날짜를 선택해주세요',
});

export const durationTypeSchema = z.enum(['single', 'consecutive', 'multi'], {
  error: '올바른 기간 타입이 아닙니다',
});

export const durationSchema = z.object({
  type: durationTypeSchema,
  startDate: dateSchema,
  endDate: dateSchema.optional(),
});

export const checkMethodSchema = z.enum(['group', 'individual'], {
  error: '올바른 출퇴근 체크 방식이 아닙니다',
});

export const assignmentSchema = z.object({
  roleIds: roleIdsSchema,
  timeSlot: timeSlotSchema,
  dates: datesArraySchema,
  isGrouped: z.boolean(),
  groupId: z.string().optional(),
  checkMethod: checkMethodSchema.optional(),
  requirementId: z.string().optional(),
  duration: durationSchema.optional(),
  isTimeToBeAnnounced: z.boolean().optional(),
  tentativeDescription: z
    .string()
    .refine(xssValidation, { message: '위험한 문자가 포함되어 있습니다' })
    .optional(),
});

export type AssignmentFormData = z.infer<typeof assignmentSchema>;

export const assignmentsArraySchema = z.array(assignmentSchema).min(1, {
  message: '최소 1개 이상의 배정을 선택해주세요',
});

export type AssignmentsArrayData = z.infer<typeof assignmentsArraySchema>;

export const createApplicationV2Schema = z.object({
  jobPostingId: z.string().min(1, { message: '공고 ID가 필요합니다' }),
  assignments: assignmentsArraySchema,
  message: z
    .string()
    .max(200, { message: '메시지는 200자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자가 포함되어 있습니다' })
    .optional(),
});

export type CreateApplicationV2FormData = z.infer<typeof createApplicationV2Schema>;

export const confirmApplicationV2Schema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  selectedAssignments: assignmentsArraySchema.optional(),
  notes: z
    .string()
    .max(500, { message: '메모는 500자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자가 포함되어 있습니다' })
    .optional(),
});

export type ConfirmApplicationV2Data = z.infer<typeof confirmApplicationV2Schema>;

export const cancelConfirmationSchema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  cancelReason: z
    .string()
    .max(200, { message: '취소 사유는 200자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자가 포함되어 있습니다' })
    .optional(),
});

export type CancelConfirmationData = z.infer<typeof cancelConfirmationSchema>;
