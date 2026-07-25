import { SupabaseEmployerApplicationRepository } from '../EmployerApplicationRepository';
import { supabase } from '@/lib/supabase';
import { EmployerAppIdentityNotVerifiedError } from '@/errors/BusinessErrors';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockSupabase = supabase as unknown as { rpc: jest.Mock };

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

  it('EMPLOYER_APP_IDENTITY_NOT_VERIFIED RPC 에러를 전용 AppError로 매핑한다', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'EMPLOYER_APP_IDENTITY_NOT_VERIFIED: 본인인증 완료 후 구인자 신청이 가능합니다',
      },
    });
    const repo = new SupabaseEmployerApplicationRepository();

    await expect(repo.register({ termsVersion: 'v1' }, '소개')).rejects.toBeInstanceOf(
      EmployerAppIdentityNotVerifiedError
    );
  });
});

describe('SupabaseEmployerApplicationRepository.approve', () => {
  beforeEach(() => {
    mockSupabase.rpc.mockReset();
  });

  it('승인 시 EMPLOYER_APP_IDENTITY_NOT_VERIFIED 에러도 전용 AppError로 매핑한다', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          'EMPLOYER_APP_IDENTITY_NOT_VERIFIED: 본인인증이 완료되지 않은 신청자는 승인할 수 없습니다',
      },
    });
    const repo = new SupabaseEmployerApplicationRepository();

    await expect(repo.approve('app-1')).rejects.toBeInstanceOf(EmployerAppIdentityNotVerifiedError);
  });
});
