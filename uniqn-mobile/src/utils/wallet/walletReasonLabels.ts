/**
 * UNIQN Mobile - wallet_ledger reason 한글 라벨
 *
 * @description 거래내역 화면 표시용. WalletReason(14종) → 한글.
 *   알 수 없는 사유(enum drift)는 '기타'로 fallback — read-증발 방지와 동일 철학.
 */

import type { WalletReason } from '@/types/wallet';

export const WALLET_REASON_LABELS: Record<WalletReason, string> = {
  purchase: '다이아 충전',
  consume_job_posting: '공고 게시',
  consume_job_extend: '공고 연장',
  consume_job_upgrade: '공고 업그레이드',
  refund_purchase: '충전 환불',
  refund_job_cancelled: '공고 취소 환불',
  grant_signup: '가입 보너스',
  grant_daily_attendance: '출석 보상',
  grant_streak_7d: '7일 연속 보상',
  grant_review: '평가 보상',
  grant_referral: '친구 초대 보상',
  grant_admin: '관리자 지급',
  grant_first_purchase_bonus: '첫 충전 보너스',
  expire_heart: '하트 만료',
};

/**
 * 거래 사유 → 한글 라벨. 미지정/미지원 사유는 '기타'.
 */
export function walletReasonLabel(reason: string): string {
  return WALLET_REASON_LABELS[reason as WalletReason] ?? '기타';
}
