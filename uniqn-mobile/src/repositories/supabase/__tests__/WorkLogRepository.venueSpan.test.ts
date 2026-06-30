/**
 * WorkLogRepository.getByVenueSpanInRange — 운영처 스팬 + 날짜범위 정산 reader contract test
 *
 * 주간 배치 그리드 Phase 4(정산). 검증 대상:
 * - E1: venue 스팬은 venue_span_posting_ids(SSOT) RPC 로 취득 → 반환 id 배열을 그대로
 *   work_logs.in('job_posting_id', spanIds) 에 사용(손수 venue_id=:V OR id=:V 재작성 금지).
 * - R5: 날짜범위는 SQL 경계(.gte/.lte) — from=to inclusive 경계 포함.
 * - status NOT IN(cancelled,no_show) 를 .not('status','in',...) 으로 SQL 제외.
 * - 스팬이 비면(외부인 fail-closed) work_logs 조회를 생략한다.
 *
 * contract level(Supabase 호출 패턴)만 검증 — parseWorkLogDocuments 파싱은 무관.
 */
import { SupabaseWorkLogRepository } from '../WorkLogRepository';

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
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

jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'gte', 'lte', 'neq', 'not']) {
    chain[m] = jest.fn(() => chain);
  }
  (chain as { then?: unknown }).then = function then<T1 = unknown, T2 = never>(
    onfulfilled?: ((value: unknown) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(returnValue).then(onfulfilled, onrejected);
  };
  return chain as Record<string, jest.Mock> & PromiseLike<unknown>;
}

const SPAN_IDS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('WorkLogRepository.getByVenueSpanInRange — venue 스팬 + 날짜범위', () => {
  const repo = new SupabaseWorkLogRepository();

  it('E1: venue_span_posting_ids(SSOT) RPC 를 venueId 로 호출한다', async () => {
    mockRpc.mockResolvedValueOnce({ data: SPAN_IDS, error: null });
    mockFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));

    await repo.getByVenueSpanInRange('v1', '2026-07-01', '2026-07-31');

    expect(mockRpc).toHaveBeenCalledWith('venue_span_posting_ids', { p_venue: 'v1' });
  });

  it('스팬 id 조합: RPC 반환 id 배열을 work_logs.in(job_posting_id, spanIds) 에 그대로 사용', async () => {
    mockRpc.mockResolvedValueOnce({ data: SPAN_IDS, error: null });
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.getByVenueSpanInRange('v1', '2026-07-01', '2026-07-31');

    expect(mockFrom).toHaveBeenCalledWith('work_logs');
    expect(chain.in).toHaveBeenCalledWith('job_posting_id', SPAN_IDS);
    // 손수 재작성 방지: venue_id/id eq 직접 필터를 쓰지 않는다.
    const eqCalls = chain.eq.mock.calls.map((c) => c[0]);
    expect(eqCalls).not.toContain('venue_id');
    expect(eqCalls).not.toContain('id');
  });

  it('SETOF uuid 객체형 응답({venue_span_posting_ids}) 도 id 로 정규화', async () => {
    mockRpc.mockResolvedValueOnce({
      data: SPAN_IDS.map((id) => ({ venue_span_posting_ids: id })),
      error: null,
    });
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.getByVenueSpanInRange('v1', '2026-07-01', '2026-07-31');

    expect(chain.in).toHaveBeenCalledWith('job_posting_id', SPAN_IDS);
  });

  it('R5: 날짜범위를 SQL 경계(.gte/.lte)로 적용 — from=to inclusive 경계 포함', async () => {
    mockRpc.mockResolvedValueOnce({ data: SPAN_IDS, error: null });
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    // from === to (단일 날짜) — 경계 포함이어야 한다.
    await repo.getByVenueSpanInRange('v1', '2026-07-15', '2026-07-15');

    expect(chain.gte).toHaveBeenCalledWith('date', '2026-07-15');
    expect(chain.lte).toHaveBeenCalledWith('date', '2026-07-15');
  });

  it('cancelled/no_show 를 .not(status, in, ...) 으로 SQL 제외', async () => {
    mockRpc.mockResolvedValueOnce({ data: SPAN_IDS, error: null });
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.getByVenueSpanInRange('v1', '2026-07-01', '2026-07-31');

    expect(chain.not).toHaveBeenCalledWith('status', 'in', '(cancelled,no_show)');
  });

  it('스팬이 비면(외부인 fail-closed) work_logs 조회를 생략하고 빈 배열 반환', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await repo.getByVenueSpanInRange('v1', '2026-07-01', '2026-07-31');

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('스팬 RPC 에러 전파', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

    await expect(repo.getByVenueSpanInRange('v1', 'a', 'b')).rejects.toThrow('supabase: denied');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('work_logs 조회 에러 전파', async () => {
    mockRpc.mockResolvedValueOnce({ data: SPAN_IDS, error: null });
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: { message: 'permission denied' } })
    );

    await expect(repo.getByVenueSpanInRange('v1', 'a', 'b')).rejects.toThrow(/permission denied/);
  });
});
