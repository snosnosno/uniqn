/**
 * UNIQN Mobile - Wallet Service
 *
 * @description 지갑 도메인 비즈니스 로직 — Repository 호출 + 에러 변환 + 도메인 정규화.
 *   - 차감(consume)/환불(refund)은 RPC 시그니처 확정(T3/T5) 후 별도 추가.
 * @see docs/superpowers/plans/2026-05-30-wallet-client-t6-t7.md
 */

import { WalletRepository } from '@/repositories/supabase/WalletRepository';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import type { WalletSummary, PostingCost, GetWalletLedgerResponse } from '@/types/wallet';

export type ClaimAttendanceResult =
  | { status: 'claimed'; amount: number; expiresAt: string }
  | { status: 'already_claimed' };

/**
 * 본인(또는 지정 사용자) 지갑 요약 조회.
 */
export async function getWalletSummary(userId?: string): Promise<WalletSummary> {
  try {
    return await WalletRepository.getSummary(userId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '지갑 요약 조회',
      component: 'walletService',
    });
  }
}

/**
 * 일일 출석 체크 — 하트 1개 적립. 이미 출석했으면 already_claimed.
 */
export async function claimDailyAttendance(): Promise<ClaimAttendanceResult> {
  try {
    const res = await WalletRepository.claimDailyAttendance();
    if (res.success) {
      return { status: 'claimed', amount: res.amount, expiresAt: res.expires_at };
    }
    return { status: 'already_claimed' };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '출석 적립',
      component: 'walletService',
    });
  }
}

/**
 * 공고 유형별 비용 조회 — 표시용 단일소스. flag off 시 cost=0.
 */
export async function getPostingCost(postingType: string, ownerId: string): Promise<PostingCost> {
  try {
    return await WalletRepository.getPostingCost(postingType, ownerId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고 비용 조회',
      component: 'walletService',
    });
  }
}

/**
 * 본인 지갑 거래내역 페이지 조회 — 최신순.
 */
export async function getWalletLedger(
  offset?: number,
  limit?: number
): Promise<GetWalletLedgerResponse> {
  try {
    return await WalletRepository.getWalletLedger(offset, limit);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '거래내역 조회',
      component: 'walletService',
    });
  }
}
