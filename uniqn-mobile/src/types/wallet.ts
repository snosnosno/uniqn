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
