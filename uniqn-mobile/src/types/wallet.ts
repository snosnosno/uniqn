/**
 * UNIQN Mobile - Wallet 도메인 타입
 *
 * @description 결제 시스템 wallet/diamond_products 타입 + Zod 스키마
 *   - 마이그 20260427000000~001000 매핑
 *   - Phase 1 Task 12 read-only Repository용
 * @see docs/superpowers/specs/2026-04-26-monetization-design.md §3
 */

import { z } from 'zod';

export type WalletCurrency = 'heart' | 'diamond';

export type WalletReason =
  | 'purchase'
  | 'consume_job_posting'
  | 'consume_job_extend'
  | 'consume_job_upgrade'
  | 'refund_purchase'
  | 'refund_job_cancelled'
  | 'grant_signup'
  | 'grant_daily_attendance'
  | 'grant_streak_7d'
  | 'grant_review'
  | 'grant_referral'
  | 'grant_admin'
  | 'grant_first_purchase_bonus'
  | 'expire_heart';

// ============================================================================
// get_wallet_summary RPC 응답
// ============================================================================

export const ExpiringLotSchema = z.object({
  lot_id: z.string().uuid(),
  amount_remaining: z.number().int().min(0),
  expires_at: z.string(),
  source: z.string(),
});
export type ExpiringLot = z.infer<typeof ExpiringLotSchema>;

export const WalletSummarySchema = z.object({
  heart_balance: z.number().int().min(0),
  diamond_balance: z.number().int().min(0),
  lifetime_purchased_diamonds: z.number().int().min(0),
  expiring_lots: z.array(ExpiringLotSchema),
});
export type WalletSummary = z.infer<typeof WalletSummarySchema>;

// ============================================================================
// diamond_products 행
// ============================================================================

export const DiamondProductSchema = z.object({
  product_id: z.string(),
  diamonds: z.number().int().positive(),
  bonus_diamonds: z.number().int().min(0),
  price_krw: z.number().int().positive(),
  display_order: z.number().int(),
  active: z.boolean(),
});
export type DiamondProduct = z.infer<typeof DiamondProductSchema>;

// ============================================================================
// claim_daily_attendance RPC 응답
// ============================================================================

export const ClaimAttendanceSuccessSchema = z.object({
  success: z.literal(true),
  lot_id: z.string().uuid(),
  expires_at: z.string(),
  amount: z.number().int().positive(),
});

export const ClaimAttendanceAlreadySchema = z.object({
  success: z.literal(false),
  error: z.literal('already_attended_today'),
});

export const ClaimAttendanceResponseSchema = z.discriminatedUnion('success', [
  ClaimAttendanceSuccessSchema,
  ClaimAttendanceAlreadySchema,
]);
export type ClaimAttendanceResponse = z.infer<typeof ClaimAttendanceResponseSchema>;

// ============================================================================
// get_posting_cost RPC 응답
// ============================================================================

export const PostingCostSchema = z.object({
  type: z.string(),
  cost: z.number().int().nonnegative(),
  is_paid: z.boolean(),
  currency_hint: z.string(),
});
export type PostingCost = z.infer<typeof PostingCostSchema>;

// ============================================================================
// create_job_posting_with_payment_atomically RPC 응답 (Lane B2)
// ============================================================================

export const CreatePostingPaymentResultSchema = z.object({
  success: z.literal(true),
  posting_id: z.string().uuid(),
  idempotent: z.boolean().optional(),
  diamonds_consumed: z.number().int().nonnegative().default(0),
  hearts_consumed: z.number().int().nonnegative().default(0),
  total_consumed: z.number().int().nonnegative().default(0),
});
export type CreatePostingPaymentResult = z.infer<typeof CreatePostingPaymentResultSchema>;

// ============================================================================
// refund_job_cancellation_atomically RPC 응답 (Lane B2)
// ============================================================================

const RefundSuccessSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean().optional(),
  refunded_diamonds: z.number().int().nonnegative().optional(),
  refunded_hearts: z.number().int().nonnegative().optional(),
  refund_rate: z.number().optional(),
  hours_elapsed: z.number().optional(),
  original_diamond: z.number().int().optional(),
  original_heart: z.number().int().optional(),
});

const RefundFailureSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export const RefundResultSchema = z.discriminatedUnion('success', [
  RefundSuccessSchema,
  RefundFailureSchema,
]);
export type RefundResult = z.infer<typeof RefundResultSchema>;

// ============================================================================
// cancel_job_posting_with_refund_atomically RPC 응답 (M3 — 취소+환불 원자)
// ============================================================================

const CancelSuccessSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean().optional(),
  // 내부 환불 결과(success/failure 양 형태). 클라는 상세를 강결합하지 않음 → unknown.
  refund: z.unknown().optional(),
});

const CancelFailureSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export const CancelPostingResultSchema = z.discriminatedUnion('success', [
  CancelSuccessSchema,
  CancelFailureSchema,
]);
export type CancelPostingResult = z.infer<typeof CancelPostingResultSchema>;

// ============================================================================
// wallet_ledger row (거래내역 화면용 — 본인 행만 RLS로 노출)
//   read-증발 방어: 표시 필드에 .catch() 적용 — RPC/스키마 drift 시 한 행 fallback,
//   잔액 전체 throw 회피([[pitfall_enum_divergence_read_disappearance]] 클래스).
// ============================================================================

export const WalletLedgerRowSchema = z.object({
  id: z.string(),
  currency_type: z.enum(['heart', 'diamond']).catch('diamond'),
  delta: z.number().catch(0),
  // 비문자열 drift 시 빈 문자열 → walletReasonLabel이 '기타'로 강등(오라벨 방지)
  reason: z.string().catch(''),
  ref_type: z.string().nullable().catch(null),
  balance_after_heart: z.number().catch(0),
  balance_after_diamond: z.number().catch(0),
  created_at: z.string(),
});
export type WalletLedgerRow = z.infer<typeof WalletLedgerRowSchema>;

/** Repository가 구성하는 페이지 응답(클라 camelCase). */
export type GetWalletLedgerResponse = {
  items: WalletLedgerRow[];
  hasMore: boolean;
};
