/**
 * UNIQN Mobile - Wallet Repository Interface
 *
 * @description 결제 시스템 wallet 잔액/제품 조회 추상화 (read-only)
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. DB 직접 의존 제거 → 테스트 용이성
 * 2. wallet 조회 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 *
 * 차감/적립/환불은 RPC 직접 호출 (Service 계층)이라 인터페이스 범위 밖.
 *
 * @see docs/superpowers/specs/2026-04-26-monetization-design.md §3, §6.1
 */

import type { DiamondProduct, WalletSummary } from '@/types/wallet';

// ============================================================================
// Interface
// ============================================================================

/**
 * Wallet Repository 인터페이스 (read-only)
 *
 * 구현체:
 * - WalletRepository (프로덕션, Supabase)
 */
export interface IWalletRepository {
  /**
   * 현재 사용자(또는 지정 사용자)의 지갑 요약 조회.
   *
   * @param userId 미지정 시 RPC가 auth.uid() 사용. admin/service_role만 타인 조회 가능.
   * @returns heart/diamond 잔액 + lifetime 누적 + 만료 임박(7일) lot 목록.
   * @throws Supabase RPC 에러 그대로 throw — 호출자가 처리.
   */
  getSummary(userId?: string): Promise<WalletSummary>;

  /**
   * 활성 다이아 충전 상품 목록 (display_order 오름차순).
   *
   * @returns active=true 상품만, 시드 6종 기준.
   */
  listProducts(): Promise<DiamondProduct[]>;
}
