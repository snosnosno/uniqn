/**
 * JobPostingRepository.search — 서버측 공고 검색 contract test
 *
 * @description 예전 검색은 공고 300건을 통째로 내려받아 폰에서 문자열로 걸렀다 — 301번째부터
 *              검색에 안 걸리고, 검색어마다 무거운 조회가 나갔다. 이제 PostgREST or(ilike)로
 *              서버에서 거른다. 브라우즈 목록(getList 기본 경로)과 같은 가시성 술어
 *              (active+capacity_full · 컨테이너 제외 · 끝난 공고 제외)를 써야 한다.
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

describe('JobPostingRepository.search — 서버측 검색', () => {
  const repo = new SupabaseJobPostingRepository();

  it('제목·장소명·구인처·본문을 ilike 부분일치로 서버에서 거른다', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('강남 홀덤', 100);

    const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
    expect(orArgs).toContain(
      'title.ilike.%강남 홀덤%,location->>name.ilike.%강남 홀덤%,owner_name.ilike.%강남 홀덤%,description.ilike.%강남 홀덤%'
    );
  });

  it('브라우즈 목록과 같은 가시성 술어를 건다 (정원 마감 포함·컨테이너 제외·끝난 공고 제외)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('딜러', 100);

    expect(chain.in).toHaveBeenCalledWith('status', ['active', 'capacity_full']);
    expect(chain.neq).toHaveBeenCalledWith('status', 'container');
    const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
    expect(orArgs.some((arg) => arg.startsWith('last_work_date.is.null,last_work_date.gte.'))).toBe(
      true
    );
  });

  it('상한만큼만 가져온다 (hasMore 판별용 +1 행 포함)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('딜러', 100);

    expect(chain.range).toHaveBeenCalledWith(0, 100);
  });

  it('PostgREST 구분자·와일드카드 문자는 제거한다 (필터 인젝션 방지)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('홀덤),status.eq.closed%*', 100);

    const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
    const searchArg = orArgs.find((arg) => arg.startsWith('title.ilike.'));
    expect(searchArg).toBe(
      'title.ilike.%홀덤status.eq.closed%,location->>name.ilike.%홀덤status.eq.closed%,owner_name.ilike.%홀덤status.eq.closed%,description.ilike.%홀덤status.eq.closed%'
    );
  });

  it('안전화 후 남는 글자가 없으면 조회하지 않고 빈 목록을 돌려준다', async () => {
    const result = await repo.search('%*()', 100);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
