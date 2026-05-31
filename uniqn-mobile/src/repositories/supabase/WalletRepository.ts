/**
 * UNIQN Mobile - Wallet Repository (read-only)
 *
 * @description 결제 시스템 wallet 잔액/제품 조회 전용
 *   - 차감/적립/환불은 RPC 직접 호출 (Service 계층에서)
 *   - get_wallet_summary RPC + diamond_products 테이블 조회만 제공
 * @version 1.0.0
 * @see docs/superpowers/specs/2026-04-26-monetization-design.md §3, §6.1
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import {
  DiamondProductSchema,
  WalletSummarySchema,
  ClaimAttendanceResponseSchema,
  PostingCostSchema,
  CreatePostingPaymentResultSchema,
  RefundResultSchema,
  type DiamondProduct,
  type WalletSummary,
  type ClaimAttendanceResponse,
  type PostingCost,
  type CreatePostingPaymentResult,
  type RefundResult,
  type WalletReason,
} from '@/types/wallet';

const TABLES = {
  DIAMOND_PRODUCTS: 'diamond_products',
} as const;

const DIAMOND_PRODUCT_COLUMNS =
  'product_id, diamonds, bonus_diamonds, price_krw, display_order, active' as const;

export const WalletRepository = {
  /**
   * 현재 사용자(또는 지정 사용자)의 지갑 요약 조회.
   *
   * @param userId 미지정 시 RPC가 auth.uid() 사용. admin/service_role만 타인 조회 가능.
   * @returns heart/diamond 잔액 + lifetime 누적 + 만료 임박(7일) lot 목록.
   * @throws Supabase RPC 에러 그대로 throw — 호출자가 처리.
   */
  async getSummary(userId?: string): Promise<WalletSummary> {
    const { data, error } = await supabase.rpc('get_wallet_summary', {
      p_user_id: userId ?? null,
    });
    if (error) {
      logger.error('wallet.getSummary.failed', error, { userId });
      throw error;
    }
    return WalletSummarySchema.parse(data);
  },

  /**
   * 활성 다이아 충전 상품 목록 (display_order 오름차순).
   *
   * @returns active=true 상품만, 시드 6종 기준.
   */
  async listProducts(): Promise<DiamondProduct[]> {
    const { data, error } = await supabase
      .from(TABLES.DIAMOND_PRODUCTS)
      .select(DIAMOND_PRODUCT_COLUMNS)
      .eq('active', true)
      .order('display_order', { ascending: true });
    if (error) {
      logger.error('wallet.listProducts.failed', error);
      throw error;
    }
    return (data ?? []).map((row) => DiamondProductSchema.parse(row));
  },

  /**
   * 본인 일일 출석 체크 — 하트 1개 적립(90일 만료). KST 기준 일일 1회.
   *
   * @returns 성공 시 lot 정보, 이미 출석 시 success:false. 미인증 등은 throw.
   * @throws Supabase RPC 에러 그대로 throw — Service 계층이 변환.
   */
  async claimDailyAttendance(): Promise<ClaimAttendanceResponse> {
    const { data, error } = await supabase.rpc('claim_daily_attendance', {});
    if (error) {
      logger.error('wallet.claimDailyAttendance.failed', error);
      throw error;
    }
    return ClaimAttendanceResponseSchema.parse(data);
  },

  /**
   * 공고 유형별 비용 조회 — 표시용 단일소스. flag off 시 cost=0.
   *
   * @param postingType 공고 유형 (예: 'urgent', 'regular')
   * @param ownerId 공고 소유자 user_id
   * @returns 비용 정보 (type, cost, is_paid, currency_hint)
   * @throws Supabase RPC 에러 그대로 throw — Service 계층이 변환.
   */
  async getPostingCost(postingType: string, ownerId: string): Promise<PostingCost> {
    const { data, error } = await supabase.rpc('get_posting_cost', {
      p_type: postingType,
      p_owner_id: ownerId,
    });
    if (error) {
      logger.error('wallet.getPostingCost.failed', error, { postingType });
      throw error;
    }
    return PostingCostSchema.parse(data);
  },

  /**
   * 공고 생성 + 서버 권위 비용 차감을 단일 트랜잭션으로 (결제 RPC).
   *
   * @param ownerId 비용 주체(워크스페이스 owner) user_id
   * @param payload snake_case job_postings payload. **payload.id를 멱등키로 유지할 것.**
   * @param reason 차감 사유 (기본 consume_job_posting)
   * @returns posting_id + 차감량. flag off면 cost=0 → 차감 0.
   * @throws Supabase RPC 에러 그대로 throw — 호출자가 INSUFFICIENT_BALANCE를 매핑.
   */
  async createJobPostingWithPayment(
    ownerId: string,
    payload: Record<string, unknown>,
    reason: WalletReason = 'consume_job_posting'
  ): Promise<CreatePostingPaymentResult> {
    const { data, error } = await supabase.rpc('create_job_posting_with_payment_atomically', {
      p_owner_id: ownerId,
      p_posting_payload: payload,
      p_reason: reason,
    });
    if (error) {
      logger.error('wallet.createJobPostingWithPayment.failed', error, { ownerId });
      throw error;
    }
    return CreatePostingPaymentResultSchema.parse(data);
  },

  /**
   * 공고 취소 환불 (24h 100% / 이후 50%). 환불은 항상 owner 지갑에 적립.
   *
   * @param postingId 취소된 공고 id
   * @param ownerId 비용 주체(owner) user_id — caller가 owner 또는 협업자여야 통과.
   * @returns success + 환불량. 무차감/권한밖이면 success:false (throw 아님).
   * @throws Supabase transport 에러만 throw.
   */
  async refundJobCancellation(postingId: string, ownerId: string): Promise<RefundResult> {
    const { data, error } = await supabase.rpc('refund_job_cancellation_atomically', {
      p_posting_id: postingId,
      p_owner_id: ownerId,
    });
    if (error) {
      logger.error('wallet.refundJobCancellation.failed', error, { postingId });
      throw error;
    }
    return RefundResultSchema.parse(data);
  },
};
