import { summarizeExpiringHearts } from '../expiringHearts';
import type { ExpiringLot } from '@/types/wallet';

const NOW = new Date('2026-05-30T00:00:00Z');

function lot(over: Partial<ExpiringLot>): ExpiringLot {
  return {
    lot_id: '11111111-1111-1111-8111-111111111111',
    amount_remaining: 1,
    expires_at: '2026-06-02T00:00:00Z',
    source: 'grant_signup',
    ...over,
  };
}

describe('summarizeExpiringHearts', () => {
  it('lot이 없으면 null', () => {
    expect(summarizeExpiringHearts([], NOW)).toBeNull();
  });

  it('남은 수량을 합산한다', () => {
    const result = summarizeExpiringHearts(
      [lot({ amount_remaining: 3 }), lot({ amount_remaining: 2 })],
      NOW
    );
    expect(result?.totalAmount).toBe(5);
  });

  it('가장 임박한 lot 기준 D-day를 올림 계산한다', () => {
    // 2026-06-02 - 2026-05-30 = 3일
    const result = summarizeExpiringHearts(
      [lot({ expires_at: '2026-06-05T00:00:00Z' }), lot({ expires_at: '2026-06-02T00:00:00Z' })],
      NOW
    );
    expect(result?.daysUntilExpiry).toBe(3);
  });

  it('하루 미만 남은 lot은 D-day 1로 올림(0 방지)', () => {
    const result = summarizeExpiringHearts([lot({ expires_at: '2026-05-30T10:00:00Z' })], NOW);
    expect(result?.daysUntilExpiry).toBe(1);
  });

  it('amount_remaining이 0인 lot은 무시한다', () => {
    const result = summarizeExpiringHearts(
      [lot({ amount_remaining: 0 }), lot({ amount_remaining: 4 })],
      NOW
    );
    expect(result?.totalAmount).toBe(4);
  });
});
