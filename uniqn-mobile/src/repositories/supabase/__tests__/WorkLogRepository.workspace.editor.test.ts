/**
 * Phase 3B — WorkLogRepository editor contract test
 *
 * @description editor 가 공유 공고의 work_logs 를 RLS wl_select / wl_update 통과로
 *              SELECT/UPDATE. client 는 job_posting_id 또는 work_log id 만 추가,
 *              owner_id WHERE 는 사용 안 함 (auth.uid() 가 RLS 단일 진실).
 *
 * 본 테스트는 contract level (Supabase 호출 패턴) 만 검증.
 */

import { SupabaseWorkLogRepository } from '../WorkLogRepository';

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

describe('WorkLogRepository — Phase 3B editor contract', () => {
  const repo = new SupabaseWorkLogRepository();

  describe('getByJobPostingId — SELECT 흐름', () => {
    it('Supabase from(work_logs) + job_posting_id filter + order(date desc) 호출', async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValueOnce(chain);

      await repo.getByJobPostingId('job-posting-id');

      expect(mockFrom).toHaveBeenCalledWith('work_logs');
      expect(chain.eq).toHaveBeenCalledWith('job_posting_id', 'job-posting-id');
      expect(chain.order).toHaveBeenCalledWith('date', { ascending: false });
    });

    it('client 는 owner_id / staff_id WHERE 를 추가하지 않음 (RLS auth.uid() 단일 진실)', async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValueOnce(chain);

      await repo.getByJobPostingId('job-posting-id');

      const eqCalls = chain.eq.mock.calls.map((call) => call[0]);
      expect(eqCalls).not.toContain('owner_id');
      expect(eqCalls).not.toContain('staff_id');
    });

    it('빈 결과 시에도 정상 종료 (RLS 가 0 row 반환 → 빈 배열)', async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValueOnce(chain);

      const result = await repo.getByJobPostingId('job-posting-id');
      expect(result).toEqual([]);
    });

    it('error 응답 시 handleSupabaseError 트리거', async () => {
      const chain = makeChain({ data: null, error: { message: 'permission denied' } });
      mockFrom.mockReturnValueOnce(chain);

      await expect(repo.getByJobPostingId('job-posting-id')).rejects.toThrow(/permission denied/);
    });
  });

  describe('updatePayrollStatus — UPDATE 흐름', () => {
    it('Supabase from(work_logs) + update + id WHERE 만 호출 (workspace 분기는 RLS 가 처리)', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(chain);

      await repo.updatePayrollStatus('work-log-id', 'pending');

      expect(mockFrom).toHaveBeenCalledWith('work_logs');
      expect(chain.update).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'work-log-id');
    });

    it('client 는 owner_id / workspace_id WHERE 를 추가하지 않음', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(chain);

      await repo.updatePayrollStatus('work-log-id', 'pending');

      const eqCalls = chain.eq.mock.calls.map((call) => call[0]);
      expect(eqCalls).not.toContain('owner_id');
      expect(eqCalls).not.toContain('workspace_id');
    });

    it('error 응답 시 handleSupabaseError 트리거 (RLS 거부 시 permission denied)', async () => {
      const chain = makeChain({ data: null, error: { message: 'permission denied' } });
      mockFrom.mockReturnValueOnce(chain);

      await expect(repo.updatePayrollStatus('work-log-id', 'pending')).rejects.toThrow(
        /permission denied/
      );
    });
  });
});
