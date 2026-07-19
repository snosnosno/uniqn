/**
 * UNIQN Mobile - QR 후보 work_log 조회 테스트
 *
 * @description 고정 공고(date='FIXED_SCHEDULE')와 일반 공고(date=오늘)를
 *   한 쿼리로 모두 조회하는지 검증. 하루 다중 배정은 예외 없이 배열로 반환한다.
 *   (job_posting_id, staff_id, date)에 UNIQUE 제약이 없어 2건 이상이 정상 케이스다.
 *
 * 파싱 계약도 함께 고정한다 — work_logs 행은 zod(workLogDocumentSchema)를 통과해야
 *   반환되므로, created_at/updated_at 이 빠진 행은 조용히 증발한다
 *   (whitelist-silent-drop). 픽스처는 실제 SELECT 화이트리스트와 같은 모양을 쓴다.
 */
import { FIXED_DATE_MARKER } from '@/types/assignment';
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

jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

/** PostgREST 빌더 체인 대역 — 모든 메서드가 자기 자신을 반환하고 await 시 결과를 낸다. */
function makeChain(returnValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
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

const TODAY = '2026-07-20';

/** 실제 work_logs 행 모양(snake_case) — 필수 필드 누락 시 zod 가 행을 버린다. */
function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wl-1',
    staff_id: 'staff-1',
    job_posting_id: 'posting-1',
    date: TODAY,
    status: 'scheduled',
    role: 'dealer',
    time_slot: '09:00~15:00',
    created_at: '2026-07-19T00:00:00+00:00',
    updated_at: '2026-07-19T00:00:00+00:00',
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('SupabaseWorkLogRepository.findQRCandidates', () => {
  const repo = new SupabaseWorkLogRepository();

  it('오늘 날짜와 FIXED_SCHEDULE 을 한 쿼리로 함께 조회한다', async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    await repo.findQRCandidates('posting-1', 'staff-1', TODAY);

    expect(mockFrom).toHaveBeenCalledWith('work_logs');
    expect(chain.eq).toHaveBeenCalledWith('job_posting_id', 'posting-1');
    expect(chain.eq).toHaveBeenCalledWith('staff_id', 'staff-1');
    expect(chain.in).toHaveBeenCalledWith('date', [TODAY, FIXED_DATE_MARKER]);
  });

  it('하루에 배정이 2건이면 예외 없이 2건 모두 반환한다', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({
        data: [
          makeRow({ id: 'wl-1', time_slot: '09:00~15:00' }),
          makeRow({ id: 'wl-2', time_slot: '18:00~24:00' }),
        ],
        error: null,
      })
    );

    const result = await repo.findQRCandidates('posting-1', 'staff-1', TODAY);

    expect(result).toHaveLength(2);
    expect(result.map((w) => w.id)).toEqual(['wl-1', 'wl-2']);
  });

  it('고정 공고 행(date=FIXED_SCHEDULE)도 버려지지 않고 반환된다', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({
        data: [makeRow({ id: 'wl-fixed', date: FIXED_DATE_MARKER, is_fixed_posting: true })],
        error: null,
      })
    );

    const result = await repo.findQRCandidates('posting-1', 'staff-1', TODAY);

    expect(result).toHaveLength(1);
    expect(result[0]?.date).toBe(FIXED_DATE_MARKER);
  });

  it('배정이 없으면 빈 배열을 반환한다', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: [], error: null }));

    const result = await repo.findQRCandidates('posting-1', 'staff-1', TODAY);

    expect(result).toEqual([]);
  });
});
