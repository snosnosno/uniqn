/**
 * UNIQN Mobile - 지원서 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { logger } from '@/utils/logger';
import { timestampSchema, optionalTimestampSchema, optionalDurationSchema } from './common';
import type { Application } from '@/types';
import { VALID_STAFF_ROLES } from '@/types/role';

/**
 * 지원 상태 스키마
 */
export const applicationStatusSchema = z.enum(
  ['applied', 'confirmed', 'rejected', 'cancelled', 'completed', 'cancellation_pending'],
  {
    error: '올바른 지원 상태가 아닙니다',
  }
);

export type ApplicationStatusSchema = z.infer<typeof applicationStatusSchema>;

/**
 * 스태프 역할 스키마
 *
 * @description types/role.ts의 VALID_STAFF_ROLES와 동기화
 * - dealer, floor, serving, manager, staff, other
 */
export const staffRoleSchema = z.enum(VALID_STAFF_ROLES, {
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
  notes: z
    .string()
    .trim()
    .max(500, { message: '메모는 500자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
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
  wantsSubstitutePost: z.boolean().optional().default(true),
});

export type CancellationRequestData = z.infer<typeof cancellationRequestSchema>;

/**
 * 취소 요청 검토 스키마 (구인자용)
 *
 * @description 구인자가 취소 요청을 승인/거절할 때 사용
 * - 승인: rejectionReason 불필요
 * - 거절: rejectionReason 필수
 */
export const reviewCancellationSchema = z
  .object({
    applicationId: z.string().min(1, { message: '지원서 ID가 필요합니다' }),
    approved: z.boolean(),
    rejectionReason: z
      .string()
      .min(3, { message: '거절 사유는 최소 3자 이상 입력해주세요' })
      .max(200, { message: '거절 사유는 200자를 초과할 수 없습니다' })
      .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
      .optional(),
  })
  .refine((data) => data.approved || (data.rejectionReason && data.rejectionReason.length >= 3), {
    message: '거절 시 거절 사유를 입력해주세요',
    path: ['rejectionReason'],
  });

export type ReviewCancellationData = z.infer<typeof reviewCancellationSchema>;

// ============================================================================
// Firestore 문서 검증 스키마 (런타임 타입 검증)
// ============================================================================

/**
 * Application Firestore 문서 스키마 (런타임 검증)
 *
 * @description Firestore에서 읽은 데이터의 타입 안전성을 보장
 * .passthrough()로 알려지지 않은 필드 허용 (하위 호환성)
 */
/**
 * Assignment 스키마 (Application 내부용)
 * @see types/assignment.ts
 *
 * @description roleIds는 표준 역할 또는 커스텀 역할명을 문자열로 허용
 */
const assignmentInnerSchema = z
  .object({
    roleIds: z.array(
      z
        .string()
        .min(1, { message: '역할 ID는 비어 있을 수 없습니다' })
        .refine((value) => xssValidation(value), {
          message: '위험한 문자가 포함되어 있습니다',
        })
    ),
    timeSlot: z.string(),
    dates: z.array(z.string()),
    isGrouped: z.boolean(),
    groupId: z.string().optional(),
    checkMethod: z.enum(['group', 'individual']).optional(),
    requirementId: z.string().optional(),
    duration: optionalDurationSchema,
    isTimeToBeAnnounced: z.boolean().optional(),
    // P1 보안: XSS 검증 추가
    tentativeDescription: z
      .string()
      .refine((val) => !val || xssValidation(val), {
        message: '위험한 문자열이 포함되어 있습니다',
      })
      .optional(),
  })
  .passthrough();

const originalApplicationSchema = z
  .object({
    assignments: z.array(assignmentInnerSchema),
    appliedAt: optionalTimestampSchema,
  })
  .passthrough();

const confirmationHistoryEntrySchema = z
  .object({
    confirmedAt: timestampSchema,
    cancelledAt: optionalTimestampSchema,
    cancelReason: z.string().optional(),
    assignments: z.array(assignmentInnerSchema),
    confirmedBy: z.string().optional(),
    cancelledBy: z.string().optional(),
  })
  .passthrough();

// string이 먼저 매칭되어야 ISO string이 그대로 유지됨 (timestampSchema가 먼저면 TimestampLike로 변환)
const cancellationRequestTimestampSchema = z.string().or(timestampSchema);

/**
 * applications.cancellation_request JSONB 필드 Zod 스키마.
 *
 * 입력 검증용(cancellationRequestSchema)과 달리 DB 저장 시점의
 * 메타데이터(requestedAt / reviewedAt / status / reviewedBy 등)를 포함한
 * discriminated union. applicationDocumentSchema 경유로 읽기 경로에서
 * safeParse 됨.
 *
 * 과거 이슈: 6e24a4868 — cancellationRequest timestamp 스키마 순서 버그.
 *   string이 먼저 매칭되지 않으면 ISO string이 TimestampLike로 변환됨.
 *   safeParse 기반이므로 실패 시 해당 레코드만 drop.
 */
export const cancellationRequestStoredSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    requestedAt: cancellationRequestTimestampSchema,
    reason: z.string(),
  }),
  z.object({
    status: z.literal('approved'),
    requestedAt: cancellationRequestTimestampSchema,
    reason: z.string(),
    reviewedAt: cancellationRequestTimestampSchema,
    reviewedBy: z.string(),
  }),
  z.object({
    status: z.literal('rejected'),
    requestedAt: cancellationRequestTimestampSchema,
    reason: z.string(),
    reviewedAt: cancellationRequestTimestampSchema,
    reviewedBy: z.string(),
    rejectionReason: z.string(),
  }),
]);

export type CancellationRequestStored = z.infer<typeof cancellationRequestStoredSchema>;

const cancellationRequestDocumentSchema = cancellationRequestStoredSchema;

export const applicationDocumentSchema = z
  .object({
    id: z.string(),
    jobPostingId: z.string(),
    applicantId: z.string(),
    status: applicationStatusSchema,

    // 지원자 정보
    applicantName: z.string().optional(),
    applicantNickname: z.string().optional(),
    applicantPhone: z.string().optional(),
    applicantPhotoURL: z.string().optional(),
    applicantPhotoURLBlurhash: z.string().nullable().optional(),

    // 지원 내용
    message: z.string().optional(),

    // Assignment (v3.0 필수)
    assignments: z.array(assignmentInnerSchema),
    originalApplication: originalApplicationSchema.optional(),
    confirmationHistory: z.array(confirmationHistoryEntrySchema).optional(),

    // 확정 정보
    confirmedAt: optionalTimestampSchema,
    confirmedBy: z.string().optional(),

    // 거절 정보
    rejectedAt: optionalTimestampSchema,
    rejectionReason: z.string().optional(),
    notes: z
      .string()
      .max(500, { message: '메모는 500자를 초과할 수 없습니다' })
      .nullable()
      .optional(),

    // 취소 정보
    cancelledAt: optionalTimestampSchema,
    cancellationReason: z.string().optional(),
    cancellationRequest: cancellationRequestDocumentSchema.optional(),

    // 공고 정보 (비정규화)
    jobPostingTitle: z.string().optional(),
    jobPostingOwnerId: z.string().optional(),
    workDate: z.string().optional(),

    // Timestamps
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    processedAt: optionalTimestampSchema,
  })
  .passthrough();

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
  return {
    ...result.data,
    notes: result.data.notes ?? undefined,
  } as unknown as Application;
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
