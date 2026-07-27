/**
 * UNIQN Mobile - 스케줄 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';
import { SCHEDULE_TYPE_LABELS } from '@/shared/status';
import type { ScheduleType } from '@/shared/status';
import { xssValidation } from '@/utils/security';

// ============================================================================
// 기본 타입 스키마
// ============================================================================

/**
 * 출석 상태 스키마
 */
export const attendanceStatusSchema = z.enum(['not_started', 'checked_in', 'checked_out']);

export type AttendanceStatusSchema = z.infer<typeof attendanceStatusSchema>;

/**
 * 스케줄 타입 스키마
 */
// 값 목록을 여기서 다시 적지 않는다 — 예전엔 하드코딩 4값이라 ScheduleType 에 상태를
// 하나 더해도 타입체커가 대조해주지 않아, 신규 상태가 파싱 경계에서 조용히 drop 될 수 있었다.
// SCHEDULE_TYPE_LABELS 는 Record<ScheduleType, string> 이라 누락이 컴파일 에러로 잡히는
// 유일한 전수 목록이다. 여기서 파생시키면 드리프트 자체가 성립하지 않는다.
export const scheduleTypeSchema = z.enum(
  Object.keys(SCHEDULE_TYPE_LABELS) as [ScheduleType, ...ScheduleType[]]
);

export type ScheduleTypeSchema = z.infer<typeof scheduleTypeSchema>;

/**
 * 정산 상태 스키마
 *
 * @description DB enum(payroll_status = ['pending','completed','failed'])과 UI 전용 값('processing')의
 * superset. 'processing'은 UI 표시 전용이며 DB 컬럼에 직접 쓰지 않는다(읽기 호환 목적).
 * read 경로에서 미지 enum 값에 레코드가 drop되지 않도록 호출부(workLog.schema)에서 .catch 흡수.
 */
export const payrollStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

export type PayrollStatusSchema = z.infer<typeof payrollStatusSchema>;

// ============================================================================
// 스케줄 이벤트 스키마
// ============================================================================

/**
 * 스케줄 이벤트 생성 스키마
 */
export const createScheduleEventSchema = z.object({
  type: scheduleTypeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
  /** 공고 ID */
  jobPostingId: z.string().min(1, { message: '공고 ID는 필수입니다' }),
  /** 공고명 */
  jobPostingName: z
    .string()
    .min(1, { message: '공고명은 필수입니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  location: z
    .string()
    .min(1, { message: '장소는 필수입니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  detailedAddress: z
    .string()
    .refine((val) => !val || xssValidation(val), { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
  role: z
    .string()
    .min(1, { message: '역할은 필수입니다' })
    .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' }),
  notes: z
    .string()
    .max(500, { message: '메모는 500자를 초과할 수 없습니다' })
    .refine((val) => !val || xssValidation(val), { message: '위험한 문자열이 포함되어 있습니다' })
    .optional(),
});

export type CreateScheduleEventData = z.infer<typeof createScheduleEventSchema>;

/**
 * 스케줄 필터 스키마
 */
export const scheduleFiltersSchema = z.object({
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
  }),
  searchTerm: z.string().optional(),
  type: scheduleTypeSchema.optional(),
  status: attendanceStatusSchema.optional(),
});

export type ScheduleFiltersData = z.infer<typeof scheduleFiltersSchema>;

// ============================================================================
// QR 코드 스키마
// ============================================================================

/**
 * QR 코드 액션 스키마
 */
export const qrCodeActionSchema = z.enum(['checkIn', 'checkOut']);

export type QRCodeActionSchema = z.infer<typeof qrCodeActionSchema>;
