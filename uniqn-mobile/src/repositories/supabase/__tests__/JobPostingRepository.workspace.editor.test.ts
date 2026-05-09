/**
 * Phase 2A — JobPostingRepository.getManagedJobPostings editor contract test
 *
 * @description editor 가 활성 워크스페이스의 owner 공고를 RLS jp_select 통과로 조회.
 *              client 는 status filter 만 추가, user_id WHERE 는 사용 안 함
 *              (auth.uid() 가 RLS 단일 진실 — client uid 신뢰 불가).
 *
 * 본 테스트는 contract level (Supabase 호출 패턴) 만 검증.
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';

// ── Mock Supabase ────────────────────────────────────────────────────────────
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
    'update',
    'insert',
    'delete',
    'upsert',
    'gte',
    'lte',
    'gt',
    'lt',
    'neq',
    'contains',
    'overlaps',
    'or',
    'and',
    'not',
    'filter',
    'match',
    'returns',
  ]) {
    chain[m] = jest.fn(() => chain);
  }
  for (const m of ['single', 'maybeSingle', 'csv']) {
    chain[m] = jest.fn(() => Promise.resolve(returnValue));
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

describe('JobPostingRepository.getManagedJobPostings — Phase 2A editor contract', () => {
  const repo = new SupabaseJobPostingRepository();

  it('Supabase from(job_postings) + status filter + order(created_at desc) 호출', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.getManagedJobPostings('active');

    expect(mockFrom).toHaveBeenCalledWith('job_postings');
    expect(chain.eq).toHaveBeenCalledWith('status', 'active');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('status 미지정 시 status filter 추가 안 함 (RLS jp_select 가 status 필터 분기)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.getManagedJobPostings();

    expect(chain.eq).not.toHaveBeenCalled();
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('client 는 owner_id WHERE 를 추가하지 않음 (RLS auth.uid() 단일 진실)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.getManagedJobPostings('active');

    const eqCalls = chain.eq.mock.calls.map((call) => call[0]);
    expect(eqCalls).not.toContain('owner_id');
    expect(eqCalls).not.toContain('user_id');
  });

  it('빈 결과 시에도 정상 종료 (RLS 가 0 row 반환 → 빈 배열)', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    const result = await repo.getManagedJobPostings('active');
    expect(result).toEqual([]);
  });

  it('error 응답 시 handleSupabaseError 트리거', async () => {
    const chain = makeChain({ data: null, error: { message: 'permission denied' } });
    mockFrom.mockReturnValueOnce(chain);

    await expect(repo.getManagedJobPostings('active')).rejects.toThrow(/permission denied/);
  });

  it('Phase 2A.후속 — workspaceId 가 주어지면 .eq("workspace_id", id) 를 호출한다', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.getManagedJobPostings('active', 'ws-abc-123');

    expect(chain.eq).toHaveBeenCalledWith('status', 'active');
    expect(chain.eq).toHaveBeenCalledWith('workspace_id', 'ws-abc-123');
  });

  it('Phase 2A.후속 — workspaceId 가 undefined 이면 workspace_id 필터를 추가하지 않는다', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.getManagedJobPostings('active');

    const workspaceCall = chain.eq.mock.calls.find((c: unknown[]) => c[0] === 'workspace_id');
    expect(workspaceCall).toBeUndefined();
  });
});
