import { SupabaseEmployerApplicationRepository } from '../EmployerApplicationRepository';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockSupabase = supabase as { rpc: jest.Mock };

describe('SupabaseEmployerApplicationRepository.register', () => {
  beforeEach(() => {
    mockSupabase.rpc.mockReset();
    mockSupabase.rpc.mockResolvedValue({
      data: {
        success: true,
        applicationId: 'app-1',
        status: 'pending',
        submittedAt: '2026-05-24T00:00:00Z',
      },
      error: null,
    });
  });

  it('passes p_employer_agreements and p_intro to the RPC', async () => {
    const repo = new SupabaseEmployerApplicationRepository();
    const snapshot = { termsVersion: 'v1' };

    await repo.register(snapshot, '강남 일대 홀덤펍 딜러를 주로 모집합니다');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('register_as_employer', {
      p_employer_agreements: snapshot,
      p_intro: '강남 일대 홀덤펍 딜러를 주로 모집합니다',
    });
  });
});
