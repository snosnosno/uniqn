/**
 * Phase 3C — EventQRRepository editor contract test
 *
 * @description editor 가 공유 공고의 QR 코드를 RLS qr_select / qr_update 통과로
 *              SELECT/UPDATE. client 는 id 또는 (job_posting_id, work_date) 만 추가,
 *              owner_id WHERE 는 사용 안 함 (auth.uid() 가 RLS 단일 진실).
 *
 * INSERT 정책 (qr_insert) 은 의도적으로 user_id 만 허용 — editor 는 owner 가 미리
 * 생성한 QR 을 사용하는 시나리오. 본 테스트는 Phase 3C SELECT/UPDATE 분기에 집중.
 *
 * 본 테스트는 contract level (Supabase 호출 패턴) 만 검증.
 */

import { SupabaseEventQRRepository } from '../EventQRRepository';

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

describe('EventQRRepository — Phase 3C editor contract', () => {
  const repo = new SupabaseEventQRRepository();

  describe('getById — SELECT 흐름', () => {
    it('Supabase from(event_qr_codes) + id filter + maybeSingle 호출', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(chain);

      await repo.getById('qr-id');

      expect(mockFrom).toHaveBeenCalledWith('event_qr_codes');
      expect(chain.eq).toHaveBeenCalledWith('id', 'qr-id');
      expect(chain.maybeSingle).toHaveBeenCalled();
    });

    it('client 는 user_id / owner_id WHERE 를 추가하지 않음 (RLS auth.uid() 단일 진실)', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(chain);

      await repo.getById('qr-id');

      const eqCalls = chain.eq.mock.calls.map((call) => call[0]);
      expect(eqCalls).not.toContain('user_id');
      expect(eqCalls).not.toContain('owner_id');
    });

    it('null 결과 시 정상 종료 (RLS 가 0 row 반환 → null)', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(chain);

      const result = await repo.getById('qr-id');
      expect(result).toBeNull();
    });

    it('error 응답 시 handleSupabaseError 트리거', async () => {
      const chain = makeChain({ data: null, error: { message: 'permission denied' } });
      mockFrom.mockReturnValueOnce(chain);

      await expect(repo.getById('qr-id')).rejects.toThrow(/permission denied/);
    });
  });

  describe('deactivate — UPDATE 흐름', () => {
    it('Supabase from(event_qr_codes) + update(is_active=false) + id WHERE 만 호출', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(chain);

      await repo.deactivate('qr-id');

      expect(mockFrom).toHaveBeenCalledWith('event_qr_codes');
      expect(chain.update).toHaveBeenCalledWith({ is_active: false });
      expect(chain.eq).toHaveBeenCalledWith('id', 'qr-id');
    });

    it('client 는 user_id / owner_id WHERE 를 추가하지 않음 (workspace 분기는 RLS 처리)', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(chain);

      await repo.deactivate('qr-id');

      const eqCalls = chain.eq.mock.calls.map((call) => call[0]);
      expect(eqCalls).not.toContain('user_id');
      expect(eqCalls).not.toContain('owner_id');
    });

    it('error 응답 시 handleSupabaseError 트리거 (RLS 거부 시 permission denied)', async () => {
      const chain = makeChain({ data: null, error: { message: 'permission denied' } });
      mockFrom.mockReturnValueOnce(chain);

      await expect(repo.deactivate('qr-id')).rejects.toThrow(/permission denied/);
    });
  });
});
