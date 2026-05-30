import { getWalletSummary, claimDailyAttendance, getPostingCost } from '../walletService';

const mockGetSummary = jest.fn();
const mockClaimDailyAttendance = jest.fn();
const mockGetPostingCost = jest.fn();

jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: {
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
    claimDailyAttendance: (...args: unknown[]) => mockClaimDailyAttendance(...args),
    getPostingCost: (...args: unknown[]) => mockGetPostingCost(...args),
  },
}));

describe('walletService.claimDailyAttendance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('성공 응답을 claimed 결과로 정규화한다', async () => {
    mockClaimDailyAttendance.mockResolvedValue({
      success: true,
      lot_id: '11111111-1111-1111-8111-111111111111',
      expires_at: '2026-08-28T00:00:00Z',
      amount: 1,
    });

    const result = await claimDailyAttendance();

    expect(result).toEqual({
      status: 'claimed',
      amount: 1,
      expiresAt: '2026-08-28T00:00:00Z',
    });
  });

  it('이미 출석 응답을 already_claimed 결과로 정규화한다', async () => {
    mockClaimDailyAttendance.mockResolvedValue({
      success: false,
      error: 'already_attended_today',
    });

    const result = await claimDailyAttendance();

    expect(result).toEqual({ status: 'already_claimed' });
  });

  it('Repository 에러를 AppError로 변환해 throw한다', async () => {
    mockClaimDailyAttendance.mockRejectedValue(new Error('NOT_AUTHENTICATED'));

    await expect(claimDailyAttendance()).rejects.toMatchObject({
      code: expect.any(String),
      userMessage: expect.any(String),
    });
  });
});

describe('walletService.getWalletSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Repository 요약을 그대로 반환한다', async () => {
    const summary = {
      heart_balance: 10,
      diamond_balance: 0,
      lifetime_purchased_diamonds: 0,
      expiring_lots: [],
    };
    mockGetSummary.mockResolvedValue(summary);

    await expect(getWalletSummary()).resolves.toEqual(summary);
    expect(mockGetSummary).toHaveBeenCalledWith(undefined);
  });

  it('Repository 에러를 AppError로 변환해 throw한다', async () => {
    mockGetSummary.mockRejectedValue(new Error('boom'));

    await expect(getWalletSummary()).rejects.toMatchObject({
      userMessage: expect.any(String),
    });
  });
});

describe('walletService.getPostingCost', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Repository 결과를 그대로 반환', async () => {
    mockGetPostingCost.mockResolvedValue({
      type: 'urgent',
      cost: 0,
      is_paid: false,
      currency_hint: 'diamond',
    });
    await expect(getPostingCost('urgent', 'owner-1')).resolves.toMatchObject({ cost: 0 });
  });

  it('에러를 AppError로 변환', async () => {
    mockGetPostingCost.mockRejectedValue(new Error('boom'));
    await expect(getPostingCost('urgent', 'owner-1')).rejects.toMatchObject({
      userMessage: expect.any(String),
    });
  });
});
