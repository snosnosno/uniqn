/**
 * UNIQN Mobile - 지원서 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';

/**
 * XSS 방지 검증
 */
const xssValidation = (val: string) => {
  const dangerous = /<script|javascript:|on\w+=/i;
  return !dangerous.test(val);
};

/**
 * 지원 상태 스키마
 */
export const applicationStatusSchema = z.enum(
  ['applied', 'pending', 'confirmed', 'rejected', 'cancelled', 'waitlisted', 'completed'],
  {
    error: '올바른 지원 상태가 아닙니다',
  }
);

export type ApplicationStatusSchema = z.infer<typeof applicationStatusSchema>;

/**
 * 스태프 역할 스키마
 */
export const staffRoleSchema = z.enum(['dealer', 'manager', 'chiprunner', 'admin'], {
  error: '올바른 역할을 선택해주세요',
});

export type StaffRoleSchema = z.infer<typeof staffRoleSchema>;

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

/**
 * 지원서 생성 스키마
 */
export const createApplicationSchema = z.object({
  jobPostingId: z.string().min(1, { message: '공고 ID가 필요합니다' }),
  appliedRole: staffRoleSchema,
  message: applicationMessageSchema,
});

export type CreateApplicationFormData = z.infer<typeof createApplicationSchema>;

/**
 * 지원서 필터 스키마
 */
export const applicationFilterSchema = z.object({
  status: applicationStatusSchema.optional(),
  jobPostingId: z.string().optional(),
  applicantId: z.string().optional(),
  dateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
});

export type ApplicationFilterData = z.infer<typeof applicationFilterSchema>;

/**
 * 지원 확정 스키마
 */
export const confirmApplicationSchema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  notes: z.string().max(500, { message: '메모는 500자를 초과할 수 없습니다' }).optional(),
});

export type ConfirmApplicationData = z.infer<typeof confirmApplicationSchema>;

/**
 * 지원 거절 스키마
 */
export const rejectApplicationSchema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  reason: z
    .string()
    .max(200, { message: '거절 사유는 200자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
});

export type RejectApplicationData = z.infer<typeof rejectApplicationSchema>;

/**
 * 지원 취소 스키마
 */
export const cancelApplicationSchema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
});

export type CancelApplicationData = z.infer<typeof cancelApplicationSchema>;
