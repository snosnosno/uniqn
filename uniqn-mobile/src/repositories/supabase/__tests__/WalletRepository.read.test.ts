/**
 * WalletRepository.getPostingCost — RPC 호출 및 파싱 테스트
 */
import { WalletRepository } from '../WalletRepository';
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

describe('WalletRepository.getPostingCost', () => {
  beforeEach(() => jest.clearAllMocks());

  it('get_posting_cost RPC를 type/owner로 호출하고 파싱한다', async () => {
    mockRpc.mockResolvedValue({
      data: { type: 'urgent', cost: 0, is_paid: false, currency_hint: 'diamond' },
      error: null,
    });
    const r = await WalletRepository.getPostingCost('urgent', 'owner-1');
    expect(mockRpc).toHaveBeenCalledWith('get_posting_cost', {
      p_type: 'urgent',
      p_owner_id: 'owner-1',
    });
    expect(r.cost).toBe(0);
  });

  it('RPC 에러를 throw한다', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(WalletRepository.getPostingCost('urgent', 'owner-1')).rejects.toMatchObject({
      message: 'boom',
    });
  });
});
