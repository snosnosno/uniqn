/**
 * WalletRepository.getWalletLedger — 페이지네이션(hasMore prefetch) + walletReasonLabel
 */
import { WalletRepository } from '../WalletRepository';
import { walletReasonLabel } from '@/utils/wallet/walletReasonLabels';

const mockRange = jest.fn();
const makeChain = () => {
  const c: Record<string, unknown> = {};
  c.select = jest.fn(() => c);
  c.order = jest.fn(() => c);
  c.range = (from: number, to: number) => mockRange(from, to);
  return c;
};
const mockFrom = jest.fn((_table?: string) => makeChain());
jest.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

function row(i: number, currency: 'heart' | 'diamond' = 'diamond') {
  return {
    id: `id${i}`,
    currency_type: currency,
    delta: 10,
    reason: 'purchase',
    ref_type: null,
    balance_after_heart: 0,
    balance_after_diamond: 10,
    created_at: '2026-06-09T00:00:00Z',
  };
}

describe('WalletRepository.getWalletLedger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('limit+1 prefetch로 hasMore=true 판정 + limit개로 slice', async () => {
    mockRange.mockResolvedValue({ data: [row(1), row(2), row(3)], error: null });
    const r = await WalletRepository.getWalletLedger(0, 2);
    expect(mockFrom).toHaveBeenCalledWith('wallet_ledger');
    expect(mockRange).toHaveBeenCalledWith(0, 2); // offset..offset+limit (limit+1 prefetch)
    expect(r.items).toHaveLength(2);
    expect(r.hasMore).toBe(true);
  });

  it('limit 이하면 hasMore=false, 전부 반환', async () => {
    mockRange.mockResolvedValue({ data: [row(1)], error: null });
    const r = await WalletRepository.getWalletLedger(0, 2);
    expect(r.items).toHaveLength(1);
    expect(r.hasMore).toBe(false);
  });

  it('빈 결과도 안전(hasMore=false)', async () => {
    mockRange.mockResolvedValue({ data: [], error: null });
    const r = await WalletRepository.getWalletLedger();
    expect(r.items).toHaveLength(0);
    expect(r.hasMore).toBe(false);
  });

  it('에러를 throw한다', async () => {
    mockRange.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(WalletRepository.getWalletLedger()).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('walletReasonLabel', () => {
  it('알려진 사유 → 한글 라벨', () => {
    expect(walletReasonLabel('refund_job_cancelled')).toBe('공고 취소 환불');
    expect(walletReasonLabel('grant_daily_attendance')).toBe('출석 보상');
    expect(walletReasonLabel('purchase')).toBe('다이아 충전');
  });
  it('미지원/미지정 사유 → 기타', () => {
    expect(walletReasonLabel('unknown_reason')).toBe('기타');
    expect(walletReasonLabel('')).toBe('기타');
  });
});
