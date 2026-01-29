/**
 * UNIQN Mobile - 지원서 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';

/**
 * 지원 상태 스키마
 */
export const applicationStatusSchema = z.enum(
  ['applied', 'pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'cancellation_pending'],
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
 * 지원서 생성 스키마 (레거시)
 *
 * @deprecated assignments 기반 createApplicationV2Schema 사용 권장
 */
export const createApplicationSchema = z.object({
  jobPostingId: z.string().min(1, { message: '공고 ID가 필요합니다' }),
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

/**
 * 취소 요청 스키마 (확정된 지원 취소 요청용)
 *
 * @description 확정된 지원에 대해 스태프가 취소를 요청할 때 사용
 */
export const cancellationRequestSchema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  reason: z
    .string()
    .min(5, { message: '취소 사유는 최소 5자 이상 입력해주세요' })
    .max(500, { message: '취소 사유는 500자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
});

export type CancellationRequestData = z.infer<typeof cancellationRequestSchema>;

/**
 * 취소 요청 검토 스키마 (구인자용)
 *
 * @description 구인자가 취소 요청을 승인/거절할 때 사용
 */
export const reviewCancellationSchema = z.object({
  applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
  approved: z.boolean(),
  rejectionReason: z
    .string()
    .min(3, { message: '거절 사유는 최소 3자 이상 입력해주세요' })
    .max(200, { message: '거절 사유는 200자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
});

export type ReviewCancellationData = z.infer<typeof reviewCancellationSchema>;

// ============================================================================
// Firestore 문서 검증 스키마 (런타임 타입 검증)
// ============================================================================

import { logger } from '@/utils/logger';
import type { Application } from '@/types';

/**
 * Application Firestore 문서 스키마 (런타임 검증)
 *
 * @description Firestore에서 읽은 데이터의 타입 안전성을 보장
 * .passthrough()로 알려지지 않은 필드 허용 (하위 호환성)
 */
/**
 * Assignment 스키마 (Application 내부용)
 * @see types/assignment.ts
 */
const assignmentInnerSchema = z.object({
  roleIds: z.array(z.string()),
  timeSlot: z.string(),
  dates: z.array(z.string()),
  isGrouped: z.boolean(),
  groupId: z.string().optional(),
  checkMethod: z.enum(['group', 'individual']).optional(),
  requirementId: z.string().optional(),
  duration: z.any().optional(),
  isTimeToBeAnnounced: z.boolean().optional(),
  tentativeDescription: z.string().optional(),
}).passthrough();

export const applicationDocumentSchema = z.object({
  id: z.string(),
  jobPostingId: z.string(),
  applicantId: z.string(),
  status: applicationStatusSchema,

  // 지원자 정보
  applicantName: z.string().optional(),
  applicantNickname: z.string().optional(),
  applicantPhone: z.string().optional(),
  applicantPhotoURL: z.string().optional(),

  // 지원 내용
  message: z.string().optional(),

  // Assignment (v3.0 필수)
  assignments: z.array(assignmentInnerSchema),

  // 확정 정보
  confirmedAt: z.any().optional(),
  confirmedBy: z.string().optional(),

  // 거절 정보
  rejectedAt: z.any().optional(),
  rejectionReason: z.string().optional(),

  // 취소 정보
  cancelledAt: z.any().optional(),
  cancellationReason: z.string().optional(),

  // 공고 정보 (비정규화)
  jobPostingTitle: z.string().optional(),
  jobPostingOwnerId: z.string().optional(),
  workDate: z.string().optional(),

  // Timestamps
  createdAt: z.any(),
  updatedAt: z.any(),
}).passthrough();

export type ApplicationDocumentData = z.infer<typeof applicationDocumentSchema>;

/**
 * 단일 Application 문서 안전 파싱
 *
 * @param data Firestore에서 읽은 원시 데이터
 * @returns 검증된 Application 또는 null (검증 실패 시)
 */
export function parseApplicationDocument(data: unknown): Application | null {
  const result = applicationDocumentSchema.safeParse(data);
  if (!result.success) {
    logger.warn('Application 문서 검증 실패', {
      errors: result.error.flatten(),
      component: 'application.schema',
    });
    return null;
  }
  return result.data as Application;
}

/**
 * Application 문서 배열 안전 파싱
 *
 * @param data Firestore에서 읽은 원시 데이터 배열
 * @returns 검증된 Application 배열 (검증 실패 항목은 제외)
 */
export function parseApplicationDocuments(data: unknown[]): Application[] {
  return data
    .map((item) => parseApplicationDocument(item))
    .filter((item): item is Application => item !== null);
}

/**
 * Application 타입 가드
 */
export function isApplicationDocument(data: unknown): data is Application {
  return applicationDocumentSchema.safeParse(data).success;
}
