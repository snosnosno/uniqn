/**
 * UNIQN Mobile - 구인자 등록 신청 스키마
 *
 * @description 관리자 거부 처리 입력 검증 (reason 자유 텍스트 XSS 방어)
 * @version 1.0.0
 */

import { z } from 'zod';
import { xssValidation } from '@/utils/security';

// ============================================================================
// Rejection Category Schema
// ============================================================================

/**
 * 거부 분류 스키마 (DB rejection_category 컬럼과 동일 집합)
 */
export const employerApplicationRejectionCategorySchema = z.enum([
  'duplicate',
  'dummy',
  'identity_mismatch',
  'other',
]);

export type EmployerApplicationRejectionCategorySchema = z.infer<
  typeof employerApplicationRejectionCategorySchema
>;

// ============================================================================
// Rejection Reason Schema
// ============================================================================

/**
 * 거부 사유 스키마 (선택)
 * - 입력 시에만 검증: 최대 500자, XSS 패턴 차단
 * - 대회공고 rejectionReasonSchema 와 달리 reason 은 optional (RPC p_reason nullable)
 */
export const employerApplicationRejectReasonSchema = z
  .string()
  .max(500, '거부 사유는 500자를 초과할 수 없습니다')
  .trim()
  .refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' })
  .optional();

// ============================================================================
// Request Schema
// ============================================================================

/**
 * 거부 요청 입력 스키마 (admin)
 */
export const rejectEmployerApplicationSchema = z.object({
  applicationId: z.string().min(1, '신청 ID가 필요합니다'),
  reason: employerApplicationRejectReasonSchema,
  category: employerApplicationRejectionCategorySchema.optional(),
});

export type RejectEmployerApplicationData = z.infer<typeof rejectEmployerApplicationSchema>;
