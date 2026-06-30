/**
 * JobPostingRepository — 컨테이너(status='container') fail-closed 중앙 deny contract test
 *
 * @description 주간 배치 그리드의 운영처 컨테이너는 공개/운영자 조회에 절대 노출되면 안 된다(R2).
 *   설계 §5: "N곳 allow-list 관례" → "1곳 deny 강제". repo 의 4개 reader(getList/getByOwnerId/
 *   getManagedJobPostings/getTypeCounts)는 기본적으로 `.neq('status','container')` 로 컨테이너를
 *   제외하고, 컨테이너 자체를 조회할 때만 includeContainer 로 opt-in 한다.
 *
 *   이 deny 는 플래그/명시 status 와 무관하게 항상 적용된다(누수 방지는 조건부가 아니다).
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

function neqContainerCalls(chain: Record<string, jest.Mock>) {
  return chain.neq.mock.calls.filter((c) => c[0] === 'status' && c[1] === 'container');
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('JobPostingRepository — 컨테이너 fail-closed deny', () => {
  const repo = new SupabaseJobPostingRepository();

  describe('getList', () => {
    it('기본(명시 status 없음): 컨테이너를 .neq 로 제외한다', async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await repo.getList();

      expect(neqContainerCalls(chain)).toHaveLength(1);
    });

    it('명시 status 가 있어도 컨테이너 deny 는 무조건 적용된다', async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await repo.getList({ status: 'active' });

      expect(neqContainerCalls(chain)).toHaveLength(1);
    });
  });

  describe('getByOwnerId', () => {
    it('운영자 본인 공고 조회에서 컨테이너를 .neq 로 제외한다', async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await repo.getByOwnerId('owner-1');

      expect(neqContainerCalls(chain)).toHaveLength(1);
    });
  });

  describe('getManagedJobPostings', () => {
    it('관리 가능 공고 조회에서 컨테이너를 .neq 로 제외한다', async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await repo.getManagedJobPostings();

      expect(neqContainerCalls(chain)).toHaveLength(1);
    });
  });

  describe('getTypeCounts', () => {
    it('타입별 카운트 집계에서 컨테이너를 .neq 로 제외한다', async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      await repo.getTypeCounts();

      expect(neqContainerCalls(chain)).toHaveLength(1);
    });
  });
});
