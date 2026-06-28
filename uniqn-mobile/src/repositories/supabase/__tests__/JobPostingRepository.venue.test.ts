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
