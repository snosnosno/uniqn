/**
 * UNIQN Mobile - 만료 임박 하트 요약
 *
 * @description get_wallet_summary의 expiring_lots(7일 이내 만료 하트 lot)를
 *   inline 표시용 요약(총 수량 + 가장 임박한 D-day)으로 변환하는 순수 함수.
 */

import type { ExpiringLot } from '@/types/wallet';

export interface ExpiringHeartSummary {
  /** 만료 임박 lot들의 남은 하트 총합 */
  totalAmount: number;
  /** 가장 임박한 lot까지 남은 일수 (최소 1로 올림) */
  daysUntilExpiry: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function summarizeExpiringHearts(
  lots: ExpiringLot[],
  now: Date
): ExpiringHeartSummary | null {
  const active = lots.filter((l) => l.amount_remaining > 0);
  if (active.length === 0) {
    return null;
  }

  const totalAmount = active.reduce((sum, l) => sum + l.amount_remaining, 0);

  const earliest = active.reduce((min, l) =>
    new Date(l.expires_at).getTime() < new Date(min.expires_at).getTime() ? l : min
  );

  const diffMs = new Date(earliest.expires_at).getTime() - now.getTime();
  const daysUntilExpiry = Math.max(1, Math.ceil(diffMs / MS_PER_DAY));

  return { totalAmount, daysUntilExpiry };
}
