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

const OWNER = '11111111-1111-4111-8111-111111111111';
const POSTING = '22222222-2222-4222-8222-222222222222';

describe('WalletRepository.createJobPostingWithPayment', () => {
  beforeEach(() => mockRpc.mockReset());

  it('결제 RPC를 (p_owner_id, p_posting_payload, p_reason)로 호출하고 결과를 파싱한다', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        posting_id: POSTING,
        diamonds_consumed: 0,
        hearts_consumed: 0,
        total_consumed: 0,
      },
      error: null,
    });
    const payload = { id: POSTING, title: 't', posting_type: 'regular' };

    const result = await WalletRepository.createJobPostingWithPayment(
      OWNER,
      payload,
      'consume_job_posting'
    );

    expect(mockRpc).toHaveBeenCalledWith('create_job_posting_with_payment_atomically', {
      p_owner_id: OWNER,
      p_posting_payload: payload,
      p_reason: 'consume_job_posting',
    });
    expect(result.posting_id).toBe(POSTING);
  });

  it('reason 미지정 시 consume_job_posting 기본값', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, posting_id: POSTING }, error: null });
    await WalletRepository.createJobPostingWithPayment(OWNER, { id: POSTING });
    expect(mockRpc).toHaveBeenCalledWith(
      'create_job_posting_with_payment_atomically',
      expect.objectContaining({ p_reason: 'consume_job_posting' })
    );
  });

  it('RPC 에러를 그대로 throw한다 (호출자가 INSUFFICIENT_BALANCE 매핑)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'INSUFFICIENT_BALANCE: have 0h+0d, need 10' },
    });
    await expect(
      WalletRepository.createJobPostingWithPayment(OWNER, { id: POSTING })
    ).rejects.toMatchObject({
      message: expect.stringContaining('INSUFFICIENT_BALANCE'),
    });
  });
});
