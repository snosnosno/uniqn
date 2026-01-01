/**
 * UNIQN Mobile - Assignment v2.0 Zod 스키마
 *
 * @version 1.0.0
 * @description Assignment 유효성 검증 스키마
 */

import { z } from 'zod';

/**
 * 역할 스키마 (단일)
 */
export const roleSchema = z.string().min(1, { message: '역할을 선택해주세요' });

/**
 * 역할 배열 스키마 (다중)
 */
export const rolesArraySchema = z
  .array(z.string().min(1))
  .min(1, { message: '최소 1개 이상의 역할을 선택해주세요' });

/**
 * 시간대 스키마
 */
export const timeSlotSchema = z.string().min(1, { message: '시간대를 선택해주세요' });

/**
 * 날짜 스키마 (YYYY-MM-DD)
 */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)',
});

/**
 * 날짜 배열 스키마
 */
export const datesArraySchema = z
  .array(dateSchema)
  .min(1, { message: '최소 1개 이상의 날짜를 선택해주세요' });

/**
 * Duration 타입 스키마
 */
export const durationTypeSchema = z.enum(['single', 'consecutive', 'multi'], {
  error: '올바른 기간 타입이 아닙니다',
});

/**
 * Duration 스키마
 */
export const durationSchema = z.object({
  type: durationTypeSchema,
  startDate: dateSchema,
  endDate: dateSchema.optional(),
});

/**
 * Check Method 스키마
 */
export const checkMethodSchema = z.enum(['group', 'individual'], {
  error: '올바른 출퇴근 체크 방식이 아닙니다',
});

/**
 * Assignment 스키마 (v2.0)
 *
 * @description 다중 역할/시간/날짜 조합 검증
 */
export const assignmentSchema = z
  .object({
    /** 단일 역할 (일반 공고) */
    role: roleSchema.optional(),
    /** 다중 역할 (고정 공고) */
    roles: rolesArraySchema.optional(),
    /** 시간대 (필수) */
    timeSlot: timeSlotSchema,
    /** 날짜 배열 (필수) */
    dates: datesArraySchema,
    /** 연속 날짜 그룹 여부 */
    isGrouped: z.boolean(),
    /** 그룹 ID */
    groupId: z.string().optional(),
    /** 출퇴근 체크 방식 */
    checkMethod: checkMethodSchema.optional(),
    /** 요구사항 ID */
    requirementId: z.string().optional(),
    /** 기간 설정 */
    duration: durationSchema.optional(),
  })
  .refine((data) => data.role !== undefined || data.roles !== undefined, {
    message: 'role 또는 roles 중 하나는 필수입니다',
    path: ['role'],
  });

export type AssignmentFormData = z.infer<typeof assignmentSchema>;

/**
 * Assignment 배열 스키마
 */
export const assignmentsArraySchema = z
  .array(assignmentSchema)
  .min(1, { message: '최소 1개 이상의 배정을 선택해주세요' });

export type AssignmentsArrayData = z.infer<typeof assignmentsArraySchema>;

/**
 * 지원서 생성 v2.0 스키마
 */
export const createApplicationV2Schema = z.object({
  jobPostingId: z.string().min(1, { message: '공고 ID가 필요합니다' }),
  assignments: assignmentsArraySchema,
  message: z
    .string()
    .max(200, { message: '메시지는 200자를 초과할 수 없습니다' })
    .optional(),
});

export type CreateApplicationV2FormData = z.infer<typeof createApplicationV2Schema>;

/**
 * 지원 확정 v2.0 스키마
 */
export const confirmApplicationV2Schema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  /** 확정할 assignments (미지정 시 전체 확정) */
  selectedAssignments: assignmentsArraySchema.optional(),
  notes: z.string().max(500, { message: '메모는 500자를 초과할 수 없습니다' }).optional(),
});

export type ConfirmApplicationV2Data = z.infer<typeof confirmApplicationV2Schema>;

/**
 * 취소 스키마
 */
export const cancelConfirmationSchema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  cancelReason: z
    .string()
    .max(200, { message: '취소 사유는 200자를 초과할 수 없습니다' })
    .optional(),
});

export type CancelConfirmationData = z.infer<typeof cancelConfirmationSchema>;
