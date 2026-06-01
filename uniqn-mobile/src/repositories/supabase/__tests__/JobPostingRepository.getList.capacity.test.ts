/**
 * JobPostingRepository.getList — capacity_full 공개 가시성 contract test
 *
 * @description 구직자 브라우즈 목록(명시 status 없음)은 active + capacity_full 을
 *              조회해야 한다(spec §4/§6 + 공개 RLS M4: 정원 마감은 "정원 마감" 라벨로
 *              사용자에게 노출). active 만 필터하면 정원이 찬 공고가 목록에서 증발한다.
 *              명시 status 가 주어지면 그 status 만 .eq 로 필터한다.
 *
 * contract level (Supabase 호출 패턴) 만 검증.
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

describe('JobPostingRepository.getList — capacity_full 가시성', () => {
  const repo = new SupabaseJobPostingRepository();

  it('명시 status 가 없으면 active + capacity_full 을 .in 으로 조회한다 (정원 마감 노출)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getList();

    expect(chain.in).toHaveBeenCalledWith('status', ['active', 'capacity_full']);
    // 기본 경로에서는 status 를 .eq 로 좁히지 않는다
    const statusEqCalls = chain.eq.mock.calls.filter((c) => c[0] === 'status');
    expect(statusEqCalls).toHaveLength(0);
  });

  it('명시 status 가 주어지면 그 status 만 .eq 로 필터한다', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getList({ status: 'closed' as never });

    expect(chain.eq).toHaveBeenCalledWith('status', 'closed');
    const statusInCalls = chain.in.mock.calls.filter((c) => c[0] === 'status');
    expect(statusInCalls).toHaveLength(0);
  });
});
