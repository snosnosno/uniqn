/**
 * UNIQN Mobile - 정산 관련 Zod 스키마
 *
 * @version 1.1.0
 * @description Zod 4.x 호환
 */

import { z } from 'zod';

// ============================================================================
// NOTE: salaryTypeSchema, salaryInfoSchema는 jobPosting.schema.ts에서 정의됨
// 중복 방지를 위해 schemas/index.ts에서 import하여 사용
// ============================================================================

// ============================================================================
// 정산 상태 스키마
// ============================================================================

/**
 * 정산 상태 스키마
 */
export const settlementStatusSchema = z.enum([
  'pending',       // 정산 대기
  'processing',    // 정산 진행 중
  'completed',     // 정산 완료
  'cancelled',     // 정산 취소
]);

export type SettlementStatusSchema = z.infer<typeof settlementStatusSchema>;

/**
 * 정산 타입 스키마
 */
export const settlementTypeSchema = z.enum([
  'individual',    // 개별 정산
  'batch',         // 일괄 정산
]);

export type SettlementTypeSchema = z.infer<typeof settlementTypeSchema>;

// ============================================================================
// 정산 스키마
// ============================================================================

/**
 * 정산 항목 스키마
 */
export const settlementItemSchema = z.object({
  workLogId: z.string().min(1, { message: '근무 기록 ID는 필수입니다' }),
  staffId: z.string().min(1, { message: '스태프 ID는 필수입니다' }),
  staffName: z.string().min(1, { message: '스태프 이름은 필수입니다' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
  role: z.string().min(1, { message: '역할은 필수입니다' }),
  hours: z.number().min(0, { message: '근무 시간은 0 이상이어야 합니다' }),
  hourlyRate: z.number().min(0, { message: '시급은 0 이상이어야 합니다' }),
  amount: z.number().min(0, { message: '금액은 0 이상이어야 합니다' }),
  bonus: z.number().min(0).optional(),
  deduction: z.number().min(0).optional(),
  finalAmount: z.number().min(0, { message: '최종 금액은 0 이상이어야 합니다' }),
});

export type SettlementItemData = z.infer<typeof settlementItemSchema>;

/**
 * 정산 생성 스키마
 */
export const createSettlementSchema = z.object({
  /** 공고 ID */
  jobPostingId: z.string().min(1, { message: '공고 ID는 필수입니다' }),
  type: settlementTypeSchema,
  items: z.array(settlementItemSchema).min(1, { message: '정산 항목이 최소 1개 이상 필요합니다' }),
  totalAmount: z.number().min(0, { message: '총 금액은 0 이상이어야 합니다' }),
  notes: z.string().max(500, { message: '메모는 500자를 초과할 수 없습니다' }).optional(),
});

export type CreateSettlementData = z.infer<typeof createSettlementSchema>;

/**
 * 정산 필터 스키마
 */
export const settlementFiltersSchema = z.object({
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'YYYY-MM-DD 형식이어야 합니다' }),
  }).optional(),
  status: settlementStatusSchema.optional(),
  staffId: z.string().optional(),
  jobPostingId: z.string().optional(),
});

export type SettlementFiltersData = z.infer<typeof settlementFiltersSchema>;

/**
 * 개별 정산 처리 스키마
 */
export const processSettlementSchema = z.object({
  settlementId: z.string().min(1, { message: '정산 ID는 필수입니다' }),
  status: settlementStatusSchema,
  processedAmount: z.number().min(0, { message: '처리 금액은 0 이상이어야 합니다' }).optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().max(500, { message: '메모는 500자를 초과할 수 없습니다' }).optional(),
});

export type ProcessSettlementData = z.infer<typeof processSettlementSchema>;
