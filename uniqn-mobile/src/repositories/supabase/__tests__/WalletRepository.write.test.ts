/**
 * WalletRepository.claimDailyAttendance — write 경로 단위 테스트
 */

import { WalletRepository } from '../WalletRepository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('WalletRepository.claimDailyAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claim_daily_attendance RPC를 인자 없이 호출하고 성공 응답을 파싱한다', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        lot_id: '11111111-1111-1111-8111-111111111111',
        expires_at: '2026-08-28T00:00:00Z',
        amount: 1,
      },
      error: null,
    });

    const result = await WalletRepository.claimDailyAttendance();

    expect(mockRpc).toHaveBeenCalledWith('claim_daily_attendance', {});
    expect(result.success).toBe(true);
  });

  it('이미 출석 응답을 그대로 파싱해 반환한다', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'already_attended_today' },
      error: null,
    });

    const result = await WalletRepository.claimDailyAttendance();

    expect(result.success).toBe(false);
  });

  it('RPC 에러를 그대로 throw한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'NOT_AUTHENTICATED' },
    });

    await expect(WalletRepository.claimDailyAttendance()).rejects.toMatchObject({
      message: 'NOT_AUTHENTICATED',
    });
  });
});
