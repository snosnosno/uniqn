/**
 * JobPostingRepository.getTypeCounts — capacity_full 칩 카운트 정합 contract test
 *
 * @description 공고 타입별 칩 카운트는 브라우즈 목록(getList)과 동일한 가시성 집합을
 *              세야 한다: 명시 status 가 없으면 active + capacity_full.
 *              active 만 집계하면 정원이 찬(capacity_full) 공고가 칩 카운트에서
 *              누락되어, 실제로는 브라우즈 가능한 타입이 0건으로 표시된다
 *              (EF-jobsearch-11, pitfall_enum_divergence_read_disappearance — getList 와
 *              동일 클래스). 명시 status 가 주어지면 그 status 만 .eq 로 필터한다.
 *
 * contract level (Supabase 호출 패턴) + tally 정확성만 검증.
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: jest.fn(),
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

function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    'select',
    'eq',
    'in',
    'is',
    'order',
    'limit',
    'range',
    'gte',
    'lte',
    'gt',
    'lt',
    'neq',
    'contains',
    'overlaps',
    'or',
    'not',
    'filter',
    'match',
    'returns',
  ]) {
    chain[m] = jest.fn(() => chain);
  }
  (chain as { then?: unknown }).then = function then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(returnValue).then(onfulfilled, onrejected);
  };
  return chain as Record<string, jest.Mock> & PromiseLike<unknown>;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('JobPostingRepository.getTypeCounts — capacity_full 칩 카운트 정합', () => {
  const repo = new SupabaseJobPostingRepository();

  it('명시 status 가 없으면 active + capacity_full 을 .in 으로 집계한다 (정원 마감 포함)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getTypeCounts();

    expect(chain.in).toHaveBeenCalledWith('status', ['active', 'capacity_full']);
    // 기본 경로에서는 status 를 .eq 로 좁히지 않는다
    const statusEqCalls = chain.eq.mock.calls.filter((c) => c[0] === 'status');
    expect(statusEqCalls).toHaveLength(0);
  });

  it('명시 status 가 주어지면 그 status 만 .eq 로 필터한다', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getTypeCounts({ status: 'active' as never });

    expect(chain.eq).toHaveBeenCalledWith('status', 'active');
    const statusInCalls = chain.in.mock.calls.filter((c) => c[0] === 'status');
    expect(statusInCalls).toHaveLength(0);
  });

  it('region 필터가 주어지면 location->>region 으로 .eq 한다 (칩 카운트 지역 정합, A1)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getTypeCounts({ region: '서울 강남구' });

    expect(chain.eq).toHaveBeenCalledWith('location->>region', '서울 강남구');
    // region 미지정 기본 경로는 location->>region 으로 좁히지 않는다
    expect(chain.in).toHaveBeenCalledWith('status', ['active', 'capacity_full']);
  });

  it('region 미지정이면 location->>region eq 를 호출하지 않는다', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getTypeCounts();

    const regionEqCalls = chain.eq.mock.calls.filter((c) => c[0] === 'location->>region');
    expect(regionEqCalls).toHaveLength(0);
  });

  it('정원 마감(capacity_full) 공고도 타입별 카운트에 합산된다', async () => {
    const chain = makeChain({
      data: [
        { posting_type: 'regular', tournament_config: null },
        { posting_type: 'urgent', tournament_config: null },
        { posting_type: 'fixed', tournament_config: null },
        { posting_type: 'tournament', tournament_config: { approvalStatus: 'approved' } },
        // 미승인 대회는 합산 제외
        { posting_type: 'tournament', tournament_config: { approvalStatus: 'pending' } },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const counts = await repo.getTypeCounts();

    expect(counts).toEqual({
      regular: 1,
      urgent: 1,
      fixed: 1,
      tournament: 1,
      total: 4,
    });
  });
});
