/**
 * Lane D (featured/extend) — extendWithTransaction RPC 배선 검증.
 *
 * @description extend_job_posting RPC 가 prod 에 미적용(DRAFT)이라 타입 부재.
 *   Repository 는 localized cast 로 호출하며, 본 테스트는:
 *   1) supabase.rpc('extend_job_posting', {p_posting_id, p_owner_id, p_extend_days}) 호출
 *   2) extendDays 미지정 시 default 7
 *   3) RPC error 시 rethrow
 *   를 검증한다.
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      if (error) throw new Error(`supabase: ${error.message ?? 'unknown'}`);
    },
  };
});

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
}));

const POSTING_ID = '55555555-5555-4555-8555-555555555555';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('JobPostingRepository.extendWithTransaction (Lane D draft)', () => {
  const repo = new SupabaseJobPostingRepository();

  it('extend_job_posting RPC 를 default 7일로 호출한다', async () => {
    mockRpc.mockResolvedValue({ error: null });

    await repo.extendWithTransaction(POSTING_ID, OWNER_ID);

    expect(mockRpc).toHaveBeenCalledWith('extend_job_posting', {
      p_posting_id: POSTING_ID,
      p_owner_id: OWNER_ID,
      p_extend_days: 7,
    });
  });

  it('extendDays 를 명시하면 그대로 전달한다', async () => {
    mockRpc.mockResolvedValue({ error: null });

    await repo.extendWithTransaction(POSTING_ID, OWNER_ID, 14);

    expect(mockRpc).toHaveBeenCalledWith('extend_job_posting', {
      p_posting_id: POSTING_ID,
      p_owner_id: OWNER_ID,
      p_extend_days: 14,
    });
  });

  it('RPC error 시 rethrow 한다', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'INSUFFICIENT_BALANCE' } });

    await expect(repo.extendWithTransaction(POSTING_ID, OWNER_ID)).rejects.toThrow();
  });
});
