/**
 * UNIQN Mobile - 근무 기록 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { logger } from '@/utils/logger';
import { payrollStatusSchema } from './schedule.schema';
import { timestampSchema, optionalTimestampSchema } from './common';
import type { WorkLog } from '@/types';

// ============================================================================
// 근무 기록 상태 스키마
// ============================================================================

/**
 * 근무 기록 상태 스키마
 */
export const workLogStatusSchema = z.enum([
  'scheduled',
  'checked_in',
  'checked_out',
  'completed',
  'cancelled',
]);

export type WorkLogStatusSchema = z.infer<typeof workLogStatusSchema>;

// ============================================================================
// 근무 기록 스키마
// ============================================================================

/**
 * 근무 시간 수정 이력 스키마
 */
export const workTimeModificationSchema = z.object({
  modifiedAt: z.string(),
  modifiedBy: z.string().min(1, { message: '수정자 ID는 필수입니다' }),
  reason: z.string().min(1, { message: '수정 사유는 필수입니다' }).max(200, { message: '사유는 200자를 초과할 수 없습니다' }),
  previousStartTime: z.string().optional(),
  previousEndTime: z.string().optional(),
});

export type WorkTimeModificationData = z.infer<typeof workTimeModificationSchema>;

/**
 * 근무 기록 생성 스키마
 */
export const createWorkLogSchema = z.object({
  staffId: z.string().min(1, { message: '스태프 ID는 필수입니다' }),
  /** 공고 ID */
  jobPostingId: z.string().min(1, { message: '공고 ID는 필수입니다' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
  role: z.string().min(1, { message: '역할은 필수입니다' }),
  scheduledStartTime: z.string().optional(),
  scheduledEndTime: z.string().optional(),
  notes: z.string().max(500, { message: '메모는 500자를 초과할 수 없습니다' }).optional(),
});

export type CreateWorkLogData = z.infer<typeof createWorkLogSchema>;

/**
 * 근무 기록 업데이트 스키마
 */
export const updateWorkLogSchema = z.object({
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  status: workLogStatusSchema.optional(),
  payrollStatus: payrollStatusSchema.optional(),
  payrollAmount: z.number().min(0, { message: '금액은 0 이상이어야 합니다' }).optional(),
  payrollNotes: z.string().max(500, { message: '메모는 500자를 초과할 수 없습니다' }).optional(),
  notes: z.string().max(500, { message: '메모는 500자를 초과할 수 없습니다' }).optional(),
});

export type UpdateWorkLogData = z.infer<typeof updateWorkLogSchema>;

/**
 * 근무 시간 수정 요청 스키마 (구인자가 스태프 시간 수정 시)
 */
export const modifyWorkTimeSchema = z.object({
  workLogId: z.string().min(1, { message: '근무 기록 ID는 필수입니다' }),
  newStartTime: z.string().optional(),
  newEndTime: z.string().optional(),
  reason: z.string().min(1, { message: '수정 사유는 필수입니다' }).max(200, { message: '사유는 200자를 초과할 수 없습니다' }),
}).refine(
  (data) => data.newStartTime || data.newEndTime,
  { message: '시작 시간 또는 종료 시간 중 하나는 입력해야 합니다' }
);

export type ModifyWorkTimeData = z.infer<typeof modifyWorkTimeSchema>;

// ============================================================================
// Firestore 문서 검증 스키마 (런타임 타입 검증)
// ============================================================================

/**
 * WorkLog Firestore 문서 스키마 (런타임 검증)
 *
 * @description Firestore에서 읽은 데이터의 타입 안전성을 보장
 * .passthrough()로 알려지지 않은 필드 허용 (하위 호환성)
 */
export const workLogDocumentSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  jobPostingId: z.string(),
  date: z.string(),

  // 스태프 정보
  staffName: z.string().optional(),
  staffNickname: z.string().optional(),
  staffPhotoURL: z.string().optional(),

  // 시간 정보 (Firebase Timestamp 또는 string 또는 null)
  scheduledStartTime: optionalTimestampSchema.or(z.string()).optional(),
  scheduledEndTime: optionalTimestampSchema.or(z.string()).optional(),
  checkInTime: optionalTimestampSchema.or(z.string()).optional(),
  checkOutTime: optionalTimestampSchema.or(z.string()).optional(),

  // 상태
  status: workLogStatusSchema,
  role: z.string(),
  customRole: z.string().optional(),

  // 정산 정보
  payrollStatus: payrollStatusSchema.optional(),
  payrollAmount: z.number().optional(),
  payrollDate: optionalTimestampSchema,
  payrollNotes: z.string().optional(),

  // 메타
  notes: z.string().optional(),
  timeSlot: z.string().optional(),
  ownerId: z.string().optional(),

  // Timestamps
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).passthrough();

export type WorkLogDocumentData = z.infer<typeof workLogDocumentSchema>;

/**
 * 단일 WorkLog 문서 안전 파싱
 *
 * @param data Firestore에서 읽은 원시 데이터
 * @returns 검증된 WorkLog 또는 null (검증 실패 시)
 */
export function parseWorkLogDocument(data: unknown): WorkLog | null {
  const result = workLogDocumentSchema.safeParse(data);
  if (!result.success) {
    logger.warn('WorkLog 문서 검증 실패', {
      errors: result.error.flatten(),
      component: 'workLog.schema',
    });
    return null;
  }
  return result.data as WorkLog;
}

/**
 * WorkLog 문서 배열 안전 파싱
 *
 * @param data Firestore에서 읽은 원시 데이터 배열
 * @returns 검증된 WorkLog 배열 (검증 실패 항목은 제외)
 */
export function parseWorkLogDocuments(data: unknown[]): WorkLog[] {
  return data
    .map((item) => parseWorkLogDocument(item))
    .filter((item): item is WorkLog => item !== null);
}

/**
 * WorkLog 타입 가드
 */
export function isWorkLogDocument(data: unknown): data is WorkLog {
  return workLogDocumentSchema.safeParse(data).success;
}
