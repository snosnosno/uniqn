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
