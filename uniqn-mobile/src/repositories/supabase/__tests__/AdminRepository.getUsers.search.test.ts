/**
 * AdminRepository.getUsers — 검색 서버측 필터 회귀 테스트 (A4)
 *
 * @description 검색어(search)는 range(페이지네이션) **이전에** 서버측 or(ilike) 필터로
 *              적용돼야 하고, total/totalPages/hasNextPage 는 검색이 반영된 count 기반이어야
 *              한다. 과거 구현은 서버 페이지 20행을 받은 뒤 **클라이언트에서** 사후 필터링해
 *              (1) 타 페이지의 매칭을 누락하고 (2) total 을 검색 미반영 count 로 왜곡했다.
 *
 * contract level (Supabase 호출 패턴 + 반환 집계) 만 검증.
 */

import { SupabaseAdminRepository } from '../AdminRepository';

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

function makeChain(returnValue: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  for (const m of [
    'select',
    'eq',
    'in',
    'is',
    'order',
    'limit',
    'range',
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

describe('AdminRepository.getUsers — 검색 서버측 필터', () => {
  const repo = new SupabaseAdminRepository();

  it('검색 시 or(name/email ilike)를 range 이전에 적용하고 total은 검색 count 기반이다', async () => {
    // 서버가 검색 필터를 이미 적용했다고 가정: count=42, 3행 반환.
    // 반환 행 중 하나는 검색어('김')를 텍스트로 포함하지 않는다 — 클라 사후필터가 남아 있으면
    // 이 행이 사라져 users 길이가 3이 아니게 되어 RED.
    const rows = [
      { id: '1', name: '김철수', email: 'kim@example.com' },
      { id: '2', name: '이영희', email: 'lee-kim@example.com' },
      { id: '3', name: 'NO_MATCH', email: 'other@example.com' },
    ];
    const chain = makeChain({ data: rows, error: null, count: 42 });
    mockFrom.mockReturnValue(chain);

    const result = await repo.getUsers({ search: '김' }, 1, 20);

    // or 필터가 name/email ilike 로 걸렸다
    expect(chain.or).toHaveBeenCalledWith('name.ilike.%김%,email.ilike.%김%');
    // range 이전에 or 가 호출됐다 (호출 순서로 검증)
    const orOrder = chain.or.mock.invocationCallOrder[0];
    const rangeOrder = chain.range.mock.invocationCallOrder[0];
    expect(orOrder).toBeLessThan(rangeOrder);
    // total/totalPages/hasNextPage 는 검색 반영 count(42) 기반
    expect(result.total).toBe(42);
    expect(result.totalPages).toBe(3);
    expect(result.hasNextPage).toBe(true);
    // 클라 사후필터 제거: 서버가 준 3행 모두 유지(검색어 미포함 행 포함)
    expect(result.users).toHaveLength(3);
    expect(result.users.map((u) => u.id)).toEqual(['1', '2', '3']);
  });

  it('검색어의 PostgREST 특수문자(% , ( ) " \\)를 제거해 필터 인젝션을 막는다', async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await repo.getUsers({ search: 'a%,b(c)"\\d' }, 1, 20);

    expect(chain.or).toHaveBeenCalledWith('name.ilike.%abcd%,email.ilike.%abcd%');
  });

  it('PostgREST 와일드카드 별칭 *를 제거해 리터럴 부분일치만 남긴다', async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await repo.getUsers({ search: '김*철' }, 1, 20);

    expect(chain.or).toHaveBeenCalledWith('name.ilike.%김철%,email.ilike.%김철%');
  });

  it('검색어가 없으면 or 필터를 걸지 않는다', async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await repo.getUsers({}, 1, 20);

    expect(chain.or).not.toHaveBeenCalled();
  });

  it('특수문자만으로 이뤄진 검색어는 무효화되어 or 필터를 걸지 않는다', async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await repo.getUsers({ search: '%(),' }, 1, 20);

    expect(chain.or).not.toHaveBeenCalled();
  });
});
