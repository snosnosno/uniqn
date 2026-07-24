/**
 * SupabaseJobPostingRepository.getMyVenueRoleSalaries — SECDEF RPC 래퍼 매핑 테스트 (#6)
 *
 * RPC(get_my_venue_role_salaries) 자체(RLS·SECDEF)는 배포 후 실기기 검증 대상이고,
 * 여기서는 응답 행 → Map<containerId, PostingRoleCatalogEntry[]> 변환 로직만 잠근다:
 * 컨테이너별 그룹화, salary type 화이트리스트, null 방어.
 */
import { SupabaseJobPostingRepository } from '../JobPostingRepository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

describe('SupabaseJobPostingRepository.getMyVenueRoleSalaries', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('빈 ids 는 RPC 를 호출하지 않고 빈 Map 을 반환한다', async () => {
    const repo = new SupabaseJobPostingRepository();
    const result = await repo.getMyVenueRoleSalaries([]);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('RPC 이름과 p_ids 파라미터를 정확히 전달한다', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const repo = new SupabaseJobPostingRepository();

    await repo.getMyVenueRoleSalaries(['venue-1', 'venue-2']);

    expect(mockRpc).toHaveBeenCalledWith('get_my_venue_role_salaries', {
      p_ids: ['venue-1', 'venue-2'],
    });
  });

  it('응답 행을 컨테이너별 PostingRoleCatalogEntry[] 맵으로 변환한다', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          job_posting_id: 'venue-1',
          role: 'dealer',
          custom_role: null,
          salary_type: 'hourly',
          salary_amount: 20000,
        },
        {
          job_posting_id: 'venue-1',
          role: 'other',
          custom_role: '칩러너',
          salary_type: 'daily',
          salary_amount: '90000',
        },
        {
          job_posting_id: 'venue-2',
          role: 'floor',
          custom_role: null,
          salary_type: 'monthly',
          salary_amount: 3000000,
        },
      ],
      error: null,
    });
    const repo = new SupabaseJobPostingRepository();

    const result = await repo.getMyVenueRoleSalaries(['venue-1', 'venue-2']);

    expect(result.get('venue-1')).toEqual([
      { role: 'dealer', customRole: undefined, salary: { type: 'hourly', amount: 20000 } },
      { role: 'other', customRole: '칩러너', salary: { type: 'daily', amount: 90000 } },
    ]);
    expect(result.get('venue-2')).toEqual([
      { role: 'floor', customRole: undefined, salary: { type: 'monthly', amount: 3000000 } },
    ]);
  });

  it('salary_type 이 null/비화이트리스트면 salary 를 undefined 로 둔다', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          job_posting_id: 'v',
          role: 'dealer',
          custom_role: null,
          salary_type: null,
          salary_amount: null,
        },
        {
          job_posting_id: 'v',
          role: 'floor',
          custom_role: null,
          salary_type: 'weekly',
          salary_amount: 1,
        },
      ],
      error: null,
    });
    const repo = new SupabaseJobPostingRepository();

    const result = await repo.getMyVenueRoleSalaries(['v']);

    expect(result.get('v')).toEqual([
      { role: 'dealer', customRole: undefined, salary: undefined },
      { role: 'floor', customRole: undefined, salary: undefined },
    ]);
  });
});
