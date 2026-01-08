/**
 * UNIQN Mobile - 근무 기록 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { payrollStatusSchema } from './schedule.schema';

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
  eventId: z.string().min(1, { message: '이벤트 ID는 필수입니다' }),
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
  actualStartTime: z.string().optional(),
  actualEndTime: z.string().optional(),
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
