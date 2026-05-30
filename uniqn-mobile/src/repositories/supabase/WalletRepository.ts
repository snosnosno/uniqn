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
  type DiamondProduct,
  type WalletSummary,
} from '@/types/wallet';
import type { IWalletRepository } from '../interfaces';

const TABLES = {
  DIAMOND_PRODUCTS: 'diamond_products',
} as const;

const DIAMOND_PRODUCT_COLUMNS =
  'product_id, diamonds, bonus_diamonds, price_krw, display_order, active' as const;

export const WalletRepository: IWalletRepository = {
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
};
