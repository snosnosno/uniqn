/**
 * executeCancelConfirmation — H5(체크인 후 취소 차단) 에러 매핑 테스트
 *
 * cancel_application_atomically RPC 가 staff_already_checked_in 을 반환하면
 * BusinessError 로 매핑되고 사용자 메시지에 "이미 출근" 안내가 포함되어야 한다.
 */

import { executeCancelConfirmation } from '../ApplicationRepositoryTransactions';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

describe('executeCancelConfirmation — H5 staff_already_checked_in 매핑', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('staff_already_checked_in 응답을 "이미 출근" 안내가 담긴 BusinessError로 매핑', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'staff_already_checked_in' },
      error: null,
    });

    await expect(executeCancelConfirmation('app-1', 'staff-1')).rejects.toMatchObject({
      userMessage: expect.stringContaining('이미 출근'),
    });
  });
});
