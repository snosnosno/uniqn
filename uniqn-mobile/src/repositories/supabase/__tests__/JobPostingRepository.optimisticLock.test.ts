/**
 * updateWithTransaction — 낙관적 잠금 + 영향 행 수 검증 (W1-9 / EDIT-2).
 *
 * @description 옛 동작은 `.eq('id', …)` 하나만 걸고 `.select()` 없이 로컬에서 만든 문서를 그대로
 *   반환했다. PostgREST 는 RLS·조건 불일치로 **0행이 갱신돼도 error 를 주지 않으므로**
 *   ① 내가 편집하는 동안 협업자가 저장한 변경이 통째로 덮이고(전송 payload 가 patch 가 아니라
 *   문서 전체다), ② 0행이어도 '공고가 수정되었습니다' 성공 토스트가 떴다.
 *
 *   잠금 키는 `updated_at` **필터**로만 성립한다 — BEFORE 트리거 `job_postings_updated_at`
 *   (baseline:12156)이 `NEW.updated_at = now()` 로 무조건 덮어써서 payload 에 실어 보내는
 *   updated_at 은 아무 의미가 없다.
 */
import { SupabaseJobPostingRepository } from '../JobPostingRepository';

import { ERROR_CODES } from '@/errors/AppError';
import type { PostingSchedule, UpdateJobPostingInput } from '@/types';

interface UpdateCall {
  payload: Record<string, unknown>;
  filters: [string, unknown][];
  selected: string | null;
}

/** jest.mock 팩토리는 이 객체의 **프로퍼티만** 런타임에 읽는다(TDZ 회피). */
const mockDb: {
  calls: UpdateCall[];
  result: { data: unknown[] | null; error: unknown };
} = {
  calls: [],
  result: { data: [{ id: 'placeholder' }], error: null },
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        const call: UpdateCall = { payload, filters: [], selected: null };
        mockDb.calls.push(call);
        const builder = {
          eq: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return builder;
          },
          select: (columns: string) => {
            call.selected = columns;
            return Promise.resolve(mockDb.result);
          },
        };
        return builder;
      },
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    }),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));

const mockLoadMutate = jest.fn();
const mockLoadRoleKeys = jest.fn();
jest.mock('../JobPostingRepositoryHelpers', () => ({
  ...jest.requireActual('../JobPostingRepositoryHelpers'),
  loadAndVerifyMutateAccess: (...args: unknown[]) => mockLoadMutate(...args),
  loadActiveWorkLogRoleKeys: (...args: unknown[]) => mockLoadRoleKeys(...args),
  // canonical 검증은 이 스위트의 관심사가 아니다(쿼리 형상과 0행 처리만 본다).
  assertCanonical: (doc: unknown) => doc,
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const POSTING = '55555555-5555-4555-8555-555555555555';
/** 편집 화면이 진입 시점에 동결한 baseline. */
const BASELINE = '2026-07-01T00:00:00.000Z';

const schedule: PostingSchedule = {
  kind: 'dated',
  primaryDate: '2026-08-01',
  allDates: ['2026-08-01'],
  requirements: [
    {
      date: '2026-08-01',
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
    },
  ],
};

function currentPosting() {
  return {
    id: POSTING,
    ownerId: OWNER,
    ownerName: 'Owner',
    postingType: 'regular',
    title: '주말 딜러 구합니다',
    status: 'active',
    location: { name: '강남' },
    schedule,
    roleCatalog: [{ role: 'dealer' }],
    compensation: { mode: 'shared' },
    questions: { items: [] },
    filledPositions: 0,
    totalPositions: 2,
    viewCount: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: BASELINE,
  };
}

const patch = { title: '제목만 변경' } as UpdateJobPostingInput;

beforeEach(() => {
  mockDb.calls = [];
  mockDb.result = { data: [{ id: POSTING }], error: null };
  mockLoadMutate.mockReset();
  mockLoadMutate.mockResolvedValue(currentPosting());
  mockLoadRoleKeys.mockReset();
  mockLoadRoleKeys.mockResolvedValue(new Set<string>());
});

describe('낙관적 잠금 — 내가 편집을 시작한 그 버전일 때만 쓴다', () => {
  const repo = new SupabaseJobPostingRepository();

  it('baseline 이 있으면 updated_at 을 조건에 실어 보낸다', async () => {
    await repo.updateWithTransaction(POSTING, patch, OWNER, BASELINE);

    expect(mockDb.calls).toHaveLength(1);
    expect(mockDb.calls[0]!.filters).toEqual([
      ['id', POSTING],
      ['updated_at', BASELINE],
    ]);
  });

  it('payload 가 아니라 필터로 잠근다 — BEFORE 트리거가 payload 의 updated_at 을 덮기 때문', async () => {
    await repo.updateWithTransaction(POSTING, patch, OWNER, BASELINE);

    // payload 의 updated_at 은 저장 시각(새 값)이지 baseline 이 아니다.
    expect(mockDb.calls[0]!.payload['updated_at']).not.toBe(BASELINE);
  });

  it('조건에 맞는 행이 없으면(=다른 사람이 먼저 저장) 성공을 반환하지 않고 충돌로 거부한다', async () => {
    mockDb.result = { data: [], error: null };

    await expect(repo.updateWithTransaction(POSTING, patch, OWNER, BASELINE)).rejects.toMatchObject(
      { code: ERROR_CODES.BUSINESS_EDIT_CONFLICT }
    );
  });

  it('충돌 안내는 한글이고, 다시 저장하면 덮어쓴다는 사실을 알려준다', async () => {
    mockDb.result = { data: [], error: null };

    await expect(repo.updateWithTransaction(POSTING, patch, OWNER, BASELINE)).rejects.toMatchObject(
      { userMessage: expect.stringContaining('덮어') }
    );
  });

  it('갱신된 행이 있으면 저장된 공고를 반환한다', async () => {
    const result = await repo.updateWithTransaction(POSTING, patch, OWNER, BASELINE);

    expect(result.title).toBe('제목만 변경');
  });
});

describe('영향 행 수 검증 — 0행 false success 차단', () => {
  const repo = new SupabaseJobPostingRepository();

  it('행 수를 보려면 select 가 필요하다 — 없으면 PostgREST 가 갱신 건수를 돌려주지 않는다', async () => {
    await repo.updateWithTransaction(POSTING, patch, OWNER, BASELINE);

    expect(mockDb.calls[0]!.selected).toBe('id');
  });

  it('baseline 이 null 이면 잠금 필터는 빼되 행 수 검증은 그대로 한다', async () => {
    mockDb.result = { data: [], error: null };

    await expect(repo.updateWithTransaction(POSTING, patch, OWNER, null)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
    });
    expect(mockDb.calls[0]!.filters).toEqual([['id', POSTING]]);
  });

  it('baseline 이 null 이어도 정상 갱신은 통과한다', async () => {
    const result = await repo.updateWithTransaction(POSTING, patch, OWNER, null);

    expect(result.title).toBe('제목만 변경');
  });
});
