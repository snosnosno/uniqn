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

    await repo.search('강남 홀덤', 300);

    const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
    expect(orArgs).toContain(
      'title.ilike.%강남 홀덤%,location->>name.ilike.%강남 홀덤%,owner_name.ilike.%강남 홀덤%,description.ilike.%강남 홀덤%'
    );
  });

  it('브라우즈 목록과 같은 가시성 술어를 건다 (정원 마감 포함·컨테이너 제외·끝난 공고 제외)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('딜러', 300);

    expect(chain.in).toHaveBeenCalledWith('status', ['active', 'capacity_full']);
    expect(chain.neq).toHaveBeenCalledWith('status', 'container');
    const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
    expect(orArgs.some((arg) => arg.startsWith('last_work_date.is.null,last_work_date.gte.'))).toBe(
      true
    );
  });

  // 🔑 "끝난 공고"의 기준일은 기기 로컬 날짜가 아니라 KST 오늘이다 — last_work_date 는 한국 달력 날짜이고
  //    달력 배지 RPC·자동 마감 크론이 KST 로 센다. UTC 15:00 = KST 다음 날 00:00 이라, 이 시각에는
  //    로컬(UTC 기기라면 08-12)과 KST(08-13)가 갈린다. 기기가 KST 여도 값은 같아 어디서 돌려도 통과한다.
  it('끝난 공고 하한은 KST 오늘이다 (기기 시간대와 무관)', async () => {
    jest.useFakeTimers({ now: new Date('2026-08-12T15:30:00Z') });
    try {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await repo.search('딜러', 300);

      const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
      expect(orArgs).toContain('last_work_date.is.null,last_work_date.gte.2026-08-13');
    } finally {
      jest.useRealTimers();
    }
  });

  it('상한만큼만 가져온다 (hasMore 판별용 +1 행 포함)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('딜러', 300);

    expect(chain.range).toHaveBeenCalledWith(0, 300);
  });

  it('미승인 대회는 서버에서 거른다 — 후보 상한 자리를 헛되이 차지하지 않게', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('딜러', 300);

    const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
    expect(orArgs).toContain(
      'posting_type.is.null,posting_type.neq.tournament,tournament_config->>approvalStatus.eq.approved'
    );
  });

  // 특수문자를 "지우면" `(주)포커` → `주포커` 가 되어 `(주)포커엔터` 와 연속 일치하지 않는다.
  // 특수문자를 경계로 나눠 가장 긴 조각만 서버에 보내고, 정밀 판정은 서비스가 원문으로 한다.
  it('특수문자로 나뉜 조각 중 가장 긴 것만 서버 패턴으로 쓴다 — (주)포커 → 포커', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('(주)포커', 300);

    const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
    expect(orArgs.find((arg) => arg.startsWith('title.ilike.'))).toBe(
      'title.ilike.%포커%,location->>name.ilike.%포커%,owner_name.ilike.%포커%,description.ilike.%포커%'
    );
  });

  it('구분자·와일드카드(_ 포함)는 서버 패턴에 남지 않는다 (필터 인젝션 방지)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.search('홀덤),status.eq.closed%*_x', 300);

    const orArgs = chain.or.mock.calls.map((c) => c[0] as string);
    const searchArg = orArgs.find((arg) => arg.startsWith('title.ilike.')) ?? '';
    expect(searchArg).toBe(
      'title.ilike.%status.eq.closed%,location->>name.ilike.%status.eq.closed%,owner_name.ilike.%status.eq.closed%,description.ilike.%status.eq.closed%'
    );
    expect(searchArg.split(',')).toHaveLength(4);
  });

  it.each(['%*()', '((a', '_'])(
    '서버에 보낼 조각이 2글자 미만이면 조회하지 않는다: %s',
    async (term) => {
      const result = await repo.search(term, 300);

      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    }
  );
});
