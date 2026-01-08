/**
 * UNIQN Mobile - 페널티 관련 Zod 스키마
 *
 * @version 1.0.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';

// ============================================================================
// 페널티 타입 스키마
// ============================================================================

/**
 * 페널티 타입 스키마
 */
export const penaltyTypeSchema = z.enum([
  'no_show',              // 노쇼
  'late_arrival',         // 지각
  'early_leave',          // 조퇴
  'policy_violation',     // 정책 위반
  'inappropriate_behavior', // 부적절한 행동
  'cancellation',         // 취소
  'other',                // 기타
]);

export type PenaltyTypeSchema = z.infer<typeof penaltyTypeSchema>;

/**
 * 페널티 상태 스키마
 */
export const penaltyStatusSchema = z.enum([
  'pending',    // 대기 중
  'active',     // 적용 중
  'expired',    // 만료됨
  'appealed',   // 이의 제기
  'revoked',    // 취소됨
]);

export type PenaltyStatusSchema = z.infer<typeof penaltyStatusSchema>;

/**
 * 페널티 심각도 스키마
 */
export const penaltySeveritySchema = z.enum([
  'warning',     // 경고
  'minor',       // 경미
  'moderate',    // 중간
  'severe',      // 심각
  'critical',    // 치명적
]);

export type PenaltySeveritySchema = z.infer<typeof penaltySeveritySchema>;

// ============================================================================
// 페널티 스키마
// ============================================================================

/**
 * 페널티 생성 스키마
 */
export const createPenaltySchema = z.object({
  targetUserId: z.string().min(1, { message: '대상 사용자 ID는 필수입니다' }),
  type: penaltyTypeSchema,
  severity: penaltySeveritySchema,
  reason: z.string().min(10, { message: '사유는 최소 10자 이상이어야 합니다' }).max(500, { message: '사유는 500자를 초과할 수 없습니다' }),
  relatedEventId: z.string().optional(),
  relatedWorkLogId: z.string().optional(),
  points: z.number().min(0, { message: '포인트는 0 이상이어야 합니다' }).max(100, { message: '포인트는 100을 초과할 수 없습니다' }).optional(),
  expiresInDays: z.number().min(1, { message: '만료 기간은 최소 1일 이상이어야 합니다' }).max(365, { message: '만료 기간은 365일을 초과할 수 없습니다' }).optional(),
  evidence: z.array(z.string().url()).max(5, { message: '증거 파일은 최대 5개까지 첨부 가능합니다' }).optional(),
});

export type CreatePenaltyData = z.infer<typeof createPenaltySchema>;

/**
 * 페널티 업데이트 스키마
 */
export const updatePenaltySchema = z.object({
  status: penaltyStatusSchema.optional(),
  adminNote: z.string().max(500, { message: '관리자 메모는 500자를 초과할 수 없습니다' }).optional(),
});

export type UpdatePenaltyData = z.infer<typeof updatePenaltySchema>;

/**
 * 페널티 필터 스키마
 */
export const penaltyFiltersSchema = z.object({
  userId: z.string().optional(),
  type: penaltyTypeSchema.optional(),
  status: penaltyStatusSchema.optional(),
  severity: penaltySeveritySchema.optional(),
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
  }).optional(),
});

export type PenaltyFiltersData = z.infer<typeof penaltyFiltersSchema>;

// ============================================================================
// 이의 제기 스키마
// ============================================================================

/**
 * 이의 제기 스키마
 */
export const appealPenaltySchema = z.object({
  penaltyId: z.string().min(1, { message: '페널티 ID는 필수입니다' }),
  reason: z.string().min(20, { message: '이의 제기 사유는 최소 20자 이상이어야 합니다' }).max(1000, { message: '이의 제기 사유는 1000자를 초과할 수 없습니다' }),
  evidence: z.array(z.string().url()).max(5, { message: '증거 파일은 최대 5개까지 첨부 가능합니다' }).optional(),
});

export type AppealPenaltyData = z.infer<typeof appealPenaltySchema>;

/**
 * 이의 제기 처리 스키마
 */
export const processAppealSchema = z.object({
  penaltyId: z.string().min(1, { message: '페널티 ID는 필수입니다' }),
  decision: z.enum(['accepted', 'rejected']),
  adminNote: z.string().min(1, { message: '처리 사유는 필수입니다' }).max(500, { message: '처리 사유는 500자를 초과할 수 없습니다' }),
});

export type ProcessAppealData = z.infer<typeof processAppealSchema>;

// ============================================================================
// 페널티 포인트 스키마
// ============================================================================

/**
 * 페널티 타입별 기본 포인트
 */
export const PENALTY_DEFAULT_POINTS: Record<z.infer<typeof penaltyTypeSchema>, number> = {
  no_show: 30,
  late_arrival: 10,
  early_leave: 10,
  policy_violation: 20,
  inappropriate_behavior: 25,
  cancellation: 15,
  other: 10,
};

/**
 * 심각도별 포인트 배수
 */
export const SEVERITY_MULTIPLIERS: Record<z.infer<typeof penaltySeveritySchema>, number> = {
  warning: 0,
  minor: 0.5,
  moderate: 1,
  severe: 1.5,
  critical: 2,
};
