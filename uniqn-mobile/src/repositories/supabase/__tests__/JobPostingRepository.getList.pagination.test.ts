/**
 * JobPostingRepository.getList — 페이지네이션 커서·정렬 방향 회귀 테스트
 *
 * @description 감사 2-1(무한스크롤 커서 + 정렬 방향 이중 파손) 회귀 가드.
 *
 *   기존 구현은 `paginatedQuery` 의 keyset 커서(`lt`/`gt`)를 비유일 `work_date` 에
 *   그대로 걸었다. `work_date` 는 text·nullable·비유일이라 페이지 경계에 동점 행이
 *   걸리면 다음 페이지가 `lt(work_date, 마지막값)` 으로 **동점 행을 통째로 건너뛴다**.
 *   고정(fixed) 공고는 `work_date` 가 항상 `''` 라 전 행이 동점 → 21번째부터 영구 절단.
 *
 *   또한 서버는 `work_date DESC`(가장 먼 미래 우선)로 페이지를 주는데 클라이언트
 *   (`sortJobPostings`)는 누적 결과를 매번 "임박 순"으로 재정렬한다 — 방향이 모순이라
 *   오늘·내일 근무가 마지막 페이지에 실린다.
 *
 * 이 스위트는 호출 패턴이 아니라 **실제 페이지네이션 결과**를 검증한다.
 * PostgREST 의 필터/정렬/범위 의미를 흉내 내는 인메모리 엔진에 행을 넣고
 * `getList` 를 마지막 페이지까지 돌려, 서버가 실제로 내어준 행 id 를 모은다.
 *
 * Zod 비의존: `lastDoc`·`hasMore` 는 파싱 결과가 아니라 raw 행에서 계산되므로
 * 단언은 "엔진이 내어준 raw 행 id" 기준으로 한다(파싱 증발과 무관하게 계약을 고정).
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import type { JobPostingFilters } from '@/types';
import type { PaginationCursor } from '@/types/common';

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

// ── 인메모리 PostgREST 엔진 ──────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

interface OrderSpec {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

/** PostgREST `or=(a.is.null,a.gte.x)` 의 단일 조건 세그먼트를 술어로 변환 */
function parseOrSegment(segment: string): Predicate {
  const [column, op, ...rest] = segment.split('.');
  const rawValue = rest.join('.');
  if (op === 'is' && rawValue === 'null') {
    return (row) => isNullish(row[column as string]);
  }
  if (op === 'gte') {
    return (row) => !isNullish(row[column as string]) && String(row[column as string]) >= rawValue;
  }
  if (op === 'lte') {
    return (row) => !isNullish(row[column as string]) && String(row[column as string]) <= rawValue;
  }
  throw new Error(`fake engine: 지원하지 않는 or 세그먼트 - ${segment}`);
}

/**
 * Postgres 기본 NULL 정렬: ASC → NULLS LAST, DESC → NULLS FIRST.
 * supabase-js `.order(col, { nullsFirst })` 가 주어지면 그 값을 따른다.
 */
function compareByOrder(a: Row, b: Row, spec: OrderSpec): number {
  const av = a[spec.column];
  const bv = b[spec.column];
  const aNull = isNullish(av);
  const bNull = isNullish(bv);
  if (aNull && bNull) return 0;
  if (aNull) return spec.nullsFirst ? -1 : 1;
  if (bNull) return spec.nullsFirst ? 1 : -1;
  const as = String(av);
  const bs = String(bv);
  if (as === bs) return 0;
  const cmp = as < bs ? -1 : 1;
  return spec.ascending ? cmp : -cmp;
}

interface EngineResult {
  /** 각 페이지에서 엔진이 실제로 내어준 행 id (pageSize+1 프리페치 포함 전체) */
  servedIds: string[][];
}

function makeFakeTable(rows: Row[], served: EngineResult) {
  function builder() {
    const predicates: Predicate[] = [];
    const orders: OrderSpec[] = [];
    let limitN: number | null = null;
    let rangeFromTo: [number, number] | null = null;

    const chain: Record<string, unknown> = {};

    const self = () => chain as never;

    chain.select = () => self();
    chain.returns = () => self();

    chain.eq = (column: string, value: unknown) => {
      predicates.push((row) => String(row[column]) === String(value));
      return self();
    };
    chain.neq = (column: string, value: unknown) => {
      predicates.push((row) => String(row[column]) !== String(value));
      return self();
    };
    chain.in = (column: string, values: unknown[]) => {
      const set = new Set(values.map((v) => String(v)));
      predicates.push((row) => set.has(String(row[column])));
      return self();
    };
    chain.gte = (column: string, value: unknown) => {
      predicates.push((row) => !isNullish(row[column]) && String(row[column]) >= String(value));
      return self();
    };
    chain.lte = (column: string, value: unknown) => {
      predicates.push((row) => !isNullish(row[column]) && String(row[column]) <= String(value));
      return self();
    };
    chain.gt = (column: string, value: unknown) => {
      predicates.push((row) => !isNullish(row[column]) && String(row[column]) > String(value));
      return self();
    };
    chain.lt = (column: string, value: unknown) => {
      predicates.push((row) => !isNullish(row[column]) && String(row[column]) < String(value));
      return self();
    };
    chain.not = (column: string, op: string, value: unknown) => {
      if (op === 'is' && value === null) {
        predicates.push((row) => !isNullish(row[column]));
        return self();
      }
      throw new Error(`fake engine: 지원하지 않는 not - ${column}.${op}`);
    };
    chain.or = (expression: string) => {
      const segments = expression.split(',').map((s) => parseOrSegment(s.trim()));
      predicates.push((row) => segments.some((seg) => seg(row)));
      return self();
    };
    chain.contains = (column: string, values: unknown[]) => {
      predicates.push((row) => {
        const arr = row[column];
        if (!Array.isArray(arr)) return false;
        return values.every((v) => arr.map(String).includes(String(v)));
      });
      return self();
    };
    chain.order = (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean }
    ): never => {
      const ascending = options?.ascending ?? true;
      orders.push({
        column,
        ascending,
        // Postgres 기본값: ASC → NULLS LAST, DESC → NULLS FIRST
        nullsFirst: options?.nullsFirst ?? !ascending,
      });
      return self();
    };
    chain.limit = (n: number) => {
      limitN = n;
      return self();
    };
    chain.range = (from: number, to: number) => {
      rangeFromTo = [from, to];
      return self();
    };

    (chain as { then?: unknown }).then = function then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      let result = rows.filter((row) => predicates.every((p) => p(row)));

      if (orders.length > 0) {
        result = [...result].sort((a, b) => {
          for (const spec of orders) {
            const cmp = compareByOrder(a, b, spec);
            if (cmp !== 0) return cmp;
          }
          return 0;
        });
      }

      if (rangeFromTo) {
        result = result.slice(rangeFromTo[0], rangeFromTo[1] + 1);
      } else if (limitN !== null) {
        result = result.slice(0, limitN);
      }

      served.servedIds.push(result.map((r) => String(r.id)));

      return Promise.resolve({ data: result, error: null }).then(onfulfilled, onrejected);
    };

    return chain;
  }

  return builder;
}

/** 마지막 페이지까지 getList 를 돌려 서버가 내어준 행 id 를 순서대로 모은다 */
async function drainAllPages(
  repo: SupabaseJobPostingRepository,
  rows: Row[],
  filters: JobPostingFilters | undefined,
  pageSize: number
): Promise<{ pages: string[][]; allIds: string[] }> {
  const served: EngineResult = { servedIds: [] };
  const builder = makeFakeTable(rows, served);
  mockFrom.mockImplementation(() => builder());

  const pages: string[][] = [];
  let cursor: PaginationCursor = undefined;
  // 무한 루프 방지 — 행 수보다 많은 페이지가 나올 수 없다
  for (let guard = 0; guard <= rows.length + 2; guard += 1) {
    const before = served.servedIds.length;
    const page = await repo.getList(filters, pageSize, cursor);
    // 엔진이 이 호출에 내어준 raw 행에서 실제 페이지분(pageSize)만 취한다
    const rawServed = served.servedIds[before] ?? [];
    pages.push(rawServed.slice(0, pageSize));
    if (!page.hasMore) break;
    cursor = page.lastDoc;
  }

  return { pages, allIds: pages.flat() };
}

function makePosting(overrides: Row): Row {
  return {
    id: 'p-000',
    status: 'active',
    posting_type: 'regular',
    work_date: '2027-01-01',
    last_work_date: '2027-01-01',
    work_dates: null,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('getList 페이지네이션 — 동점 work_date 유실 회귀', () => {
  const repo = new SupabaseJobPostingRepository();

  it('페이지 경계에 동점 work_date 가 걸려도 모든 공고가 정확히 한 번씩 나온다', async () => {
    const PAGE = 20;
    // 동점 구간이 **페이지 경계를 관통**하도록 배치한다.
    //   현행 정렬(work_date DESC) 기준 순서: 상단 15건(4월) → 동점 10건(3/20) → 하단 5건(2월)
    //   1페이지 = 4월 15건 + 동점 5건 → 커서 = '2027-03-20'
    //   2페이지 = lt('2027-03-20') → 남은 동점 5건을 통째로 건너뛰고 2월 5건만 반환
    // 즉 동점 5건이 영구 유실된다. 단언은 순서가 아니라 "전량 정확히 한 번"이라
    // 수정 후 정렬 방향이 바뀌어도 그대로 유효하다.
    const rows: Row[] = [];
    for (let i = 0; i < 15; i += 1) {
      const day = String(i + 1).padStart(2, '0');
      rows.push(
        makePosting({
          id: `upper-${day}`,
          work_date: `2027-04-${day}`,
          last_work_date: `2027-04-${day}`,
        })
      );
    }
    for (let i = 0; i < 10; i += 1) {
      rows.push(
        makePosting({
          id: `tied-${String(i).padStart(2, '0')}`,
          work_date: '2027-03-20',
          last_work_date: '2027-03-20',
        })
      );
    }
    for (let i = 0; i < 5; i += 1) {
      const day = String(i + 1).padStart(2, '0');
      rows.push(
        makePosting({
          id: `lower-${day}`,
          work_date: `2027-02-${day}`,
          last_work_date: `2027-02-${day}`,
        })
      );
    }

    const { allIds } = await drainAllPages(repo, rows, undefined, PAGE);

    // 유실 0건
    expect(new Set(allIds).size).toBe(rows.length);
    expect([...new Set(allIds)].sort()).toEqual(rows.map((r) => String(r.id)).sort());
    // 중복 0건
    expect(allIds).toHaveLength(rows.length);
  });

  it('고정(fixed) 공고는 work_date 가 전부 빈 문자열이어도 20건 넘게 끝까지 조회된다', async () => {
    const PAGE = 20;
    const rows: Row[] = [];
    for (let i = 0; i < 25; i += 1) {
      rows.push(
        makePosting({
          id: `fixed-${String(i).padStart(2, '0')}`,
          posting_type: 'fixed',
          // deriveWorkDateFieldsFromSchedule: fixed 공고는 workDate = ''
          work_date: '',
          last_work_date: null,
          created_at: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
        })
      );
    }

    const { allIds } = await drainAllPages(repo, rows, { postingType: 'fixed' }, PAGE);

    expect(new Set(allIds).size).toBe(25);
    expect(allIds).toHaveLength(25);
  });
});

describe('getList 정렬 방향 — 클라이언트 sortJobPostings 계약과 일치', () => {
  const repo = new SupabaseJobPostingRepository();

  it('구직자 브라우즈 첫 페이지는 임박한 근무부터 준다 (가장 먼 미래 우선이 아니다)', async () => {
    const PAGE = 3;
    const rows: Row[] = [
      makePosting({ id: 'far', work_date: '2027-12-31', last_work_date: '2027-12-31' }),
      makePosting({ id: 'near', work_date: '2027-01-02', last_work_date: '2027-01-02' }),
      makePosting({ id: 'mid', work_date: '2027-06-15', last_work_date: '2027-06-15' }),
    ];

    const { pages } = await drainAllPages(repo, rows, undefined, PAGE);

    expect(pages[0]).toEqual(['near', 'mid', 'far']);
  });

  it('마지막 근무일이 지난 공고는 구직자 브라우즈에서 제외한다', async () => {
    const PAGE = 20;
    const rows: Row[] = [
      makePosting({ id: 'past', work_date: '2020-01-01', last_work_date: '2020-01-01' }),
      makePosting({ id: 'future', work_date: '2027-01-02', last_work_date: '2027-01-02' }),
      // 지난주 시작했지만 다음주까지 이어지는 다중일 공고는 계속 보여야 한다
      makePosting({ id: 'ongoing', work_date: '2020-01-01', last_work_date: '2099-12-31' }),
    ];

    const { allIds } = await drainAllPages(repo, rows, undefined, PAGE);

    expect(allIds).toContain('future');
    expect(allIds).toContain('ongoing');
    expect(allIds).not.toContain('past');
  });

  it('칩 카운트(getTypeCounts)가 목록과 같은 하한을 쓴다 — "N건 보기" 숫자 정합', async () => {
    // 한쪽만 하한을 걸면 칩은 5건이라는데 목록은 3건만 나오는 불일치가 생긴다.
    const rows: Row[] = [
      makePosting({ id: 'past', work_date: '2020-01-01', last_work_date: '2020-01-01' }),
      makePosting({ id: 'future', work_date: '2027-01-02', last_work_date: '2027-01-02' }),
      makePosting({
        id: 'fixed',
        posting_type: 'fixed',
        work_date: '',
        last_work_date: null,
      }),
    ];

    const served: EngineResult = { servedIds: [] };
    mockFrom.mockImplementation(() => makeFakeTable(rows, served)());

    const counts = await repo.getTypeCounts();

    // 종료 공고는 세지 않고, 날짜 없는 고정 공고는 계속 센다.
    expect(counts.total).toBe(2);
    expect(counts.regular).toBe(1);
    expect(counts.fixed).toBe(1);
  });

  it('명시 status(closed) 조회는 과거 하한을 걸지 않는다 (운영자·관리자 뷰 보존)', async () => {
    const PAGE = 20;
    const rows: Row[] = [
      makePosting({
        id: 'closed-old',
        status: 'closed',
        work_date: '2020-01-01',
        last_work_date: '2020-01-01',
      }),
      makePosting({
        id: 'closed-new',
        status: 'closed',
        work_date: '2020-06-01',
        last_work_date: '2020-06-01',
      }),
    ];

    const { allIds } = await drainAllPages(repo, rows, { status: 'closed' as never }, PAGE);

    expect(new Set(allIds)).toEqual(new Set(['closed-old', 'closed-new']));
  });
});
