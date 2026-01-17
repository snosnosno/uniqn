/**
 * UNIQN Mobile - 대회공고 승인 스키마
 *
 * @description 대회공고 승인/거부/재제출 요청 검증 스키마
 * @version 1.0.0
 */

import { z } from 'zod';

// ============================================================================
// Approval Status Schema
// ============================================================================

/**
 * 대회공고 승인 상태
 */
export const tournamentApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
]);

export type TournamentApprovalStatusSchema = z.infer<
  typeof tournamentApprovalStatusSchema
>;

// ============================================================================
// Rejection Reason Schema
// ============================================================================

/**
 * 거부 사유 스키마
 * - 최소 10자 이상
 * - 최대 500자
 * - 공백만으로 구성 불가
 */
export const rejectionReasonSchema = z
  .string()
  .min(10, '거부 사유는 최소 10자 이상이어야 합니다')
  .max(500, '거부 사유는 500자를 초과할 수 없습니다')
  .trim()
  .refine(
    (value) => value.replace(/\s/g, '').length >= 10,
    '공백을 제외한 내용이 10자 이상이어야 합니다'
  );

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * 승인 요청 스키마
 */
export const approveTournamentSchema = z.object({
  postingId: z.string().min(1, '공고 ID가 필요합니다'),
});

export type ApproveTournamentData = z.infer<typeof approveTournamentSchema>;

/**
 * 거부 요청 스키마
 */
export const rejectTournamentSchema = z.object({
  postingId: z.string().min(1, '공고 ID가 필요합니다'),
  reason: rejectionReasonSchema,
});

export type RejectTournamentData = z.infer<typeof rejectTournamentSchema>;

/**
 * 재제출 요청 스키마
 */
export const resubmitTournamentSchema = z.object({
  postingId: z.string().min(1, '공고 ID가 필요합니다'),
});

export type ResubmitTournamentData = z.infer<typeof resubmitTournamentSchema>;

// ============================================================================
// Filter Schema
// ============================================================================

/**
 * 대회공고 필터 스키마 (관리자용)
 */
export const tournamentPostingFilterSchema = z.object({
  approvalStatus: tournamentApprovalStatusSchema.optional(),
  ownerId: z.string().optional(),
  searchTerm: z.string().optional(),
  dateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
});

export type TournamentPostingFilterData = z.infer<
  typeof tournamentPostingFilterSchema
>;
