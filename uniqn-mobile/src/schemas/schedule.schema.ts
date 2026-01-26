/**
 * UNIQN Mobile - 스케줄 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';

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
export const scheduleTypeSchema = z.enum(['applied', 'confirmed', 'completed', 'cancelled']);

export type ScheduleTypeSchema = z.infer<typeof scheduleTypeSchema>;

/**
 * 정산 상태 스키마
 */
export const payrollStatusSchema = z.enum(['pending', 'processing', 'completed']);

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
  jobPostingName: z.string().min(1, { message: '공고명은 필수입니다' }),
  location: z.string().min(1, { message: '장소는 필수입니다' }),
  detailedAddress: z.string().optional(),
  role: z.string().min(1, { message: '역할은 필수입니다' }),
  notes: z.string().max(500, { message: '메모는 500자를 초과할 수 없습니다' }).optional(),
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
