/**
 * JobPostingRepository — 운영처 컨테이너 전용 read 경로 contract test
 *
 * 컨테이너는 일반 JobPosting 경로(getList/getById, jobPostingDocumentSchema)로 읽으면 strict
 * 필수 충돌로 null 증발한다. 전용 getVenueContainers/getVenueContainerById 는 status='container'
 * 로 좁히고 경량 파서로 VenueContainer 를 반환한다(증발 회피).
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

jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'neq', 'maybeSingle', 'single']) {
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

const containerRow = {
  id: 'c1',
  title: '강남홀덤',
  workspace_id: 'ws1',
  owner_id: 'o1',
  venue_id: 'c1',
  status: 'container',
  schedule: { kind: 'dated', softTargets: { '2026-07-01': 3 } },
};

beforeEach(() => mockFrom.mockReset());

describe('JobPostingRepository — 운영처 컨테이너 read 경로', () => {
  const repo = new SupabaseJobPostingRepository();

  it('getVenueContainers: status=container + workspace 로 좁혀 VenueContainer 반환', async () => {
    const chain = makeChain({ data: [containerRow], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await repo.getVenueContainers('ws1');

    expect(chain.eq).toHaveBeenCalledWith('status', 'container');
    expect(chain.eq).toHaveBeenCalledWith('workspace_id', 'ws1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'c1',
      name: '강남홀덤',
      softTargets: { '2026-07-01': 3 },
    });
  });

  it('getVenueContainerById: status=container 로 좁혀 단건 반환', async () => {
    const chain = makeChain({ data: containerRow, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await repo.getVenueContainerById('c1');

    expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'container');
    expect(result?.name).toBe('강남홀덤');
  });

  it('getVenueContainerById: 없으면 null', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    expect(await repo.getVenueContainerById('nope')).toBeNull();
  });
});

/**
 * B4 — by-id 컨테이너 hydration 차단 (fail-closed)
 *
 * getList/getByOwnerId/getManageable 은 이미 .neq('status','container') 로 컨테이너를
 * 제외하지만, getById/getByIdBatch 는 by-id 직접조회라 carve-out 되어 있었다. work_logs.
 * job_posting_id 가 컨테이너인 행을 스케줄 카드 해소 경로(scheduleService)가 일반
 * JobPosting 카드로 hydrate 하지 않도록, 두 by-id 경로에도 명시적 .neq 차단을 적용한다.
 * (컨테이너의 Zod 증발은 incidental — POSTING_STATUS_VALUES 에 'container' 가 포함되므로
 * status 만으로는 거부되지 않고 다른 필수필드 부재로만 증발 → 스키마 진화에 취약. 명시
 * 쿼리 차단이 견고한 계약.)
 */
describe('JobPostingRepository — B4 by-id 컨테이너 차단', () => {
  const repo = new SupabaseJobPostingRepository();
  const NORMAL_ID = '22222222-2222-4222-8222-222222222222';

  it('getById: status != container 로 좁혀 컨테이너 by-id 노출 차단', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getById('c1');

    // 핵심 carve-out: 컨테이너 status 제외가 쿼리에 적용된다(Red→Green).
    expect(chain.neq).toHaveBeenCalledWith('status', 'container');
    // by-id 계약 무회귀: eq(id) + maybeSingle 패턴 유지.
    expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it('getById: 일반 공고 by-id 조회도 동일 차단을 통과(무회귀) — eq(id)/select 유지', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getById(NORMAL_ID);

    expect(chain.eq).toHaveBeenCalledWith('id', NORMAL_ID);
    expect(chain.select).toHaveBeenCalled();
    expect(chain.neq).toHaveBeenCalledWith('status', 'container');
  });

  it('getByIdBatch: status != container 로 좁혀 컨테이너 배치 노출 차단', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await repo.getByIdBatch(['n1', 'c1']);

    // 핵심 carve-out: 배치에서도 컨테이너 status 제외(Red→Green).
    expect(chain.neq).toHaveBeenCalledWith('status', 'container');
    // by-id 계약 무회귀: in(id) 패턴 유지.
    expect(chain.in).toHaveBeenCalledWith('id', ['n1', 'c1']);
  });

  it('getByIdBatch: 빈 입력은 쿼리 없이 빈 배열(무회귀)', async () => {
    const result = await repo.getByIdBatch([]);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
