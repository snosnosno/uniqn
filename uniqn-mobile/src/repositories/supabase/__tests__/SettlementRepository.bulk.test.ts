// src/repositories/supabase/__tests__/SettlementRepository.bulk.test.ts
//
// bulkSettlementWithTransaction 회귀 테스트 (머니 패스).
// 청크 내 per-row UPDATE를 Promise.all로 병렬화한 변경의 동치(순서·집계·부분실패 격리)를
// 잠근다. 직렬·병렬 어느 구현이든 동일하게 통과해야 하며, 집계/순서 회귀를 적발한다.
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { STATUS } from '@/constants';
import type { WorkLog, JobPosting } from '@/types';
import type { BulkSettlementContext } from '../../interfaces';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockParseWorkLog = jest.fn();
const mockParseJobPosting = jest.fn();
jest.mock('@/schemas', () => {
  const actual = jest.requireActual('@/schemas');
  return {
    ...actual,
    parseWorkLogDocument: (...a: unknown[]) => mockParseWorkLog(...a),
    parseJobPostingDocument: (...a: unknown[]) => mockParseJobPosting(...a),
  };
});

const OWNER = 'owner-1';

// 파서 mock이 id로 조회하는 픽스처
const workLogFixtures = new Map<string, WorkLog>();
const jobPostingFixtures = new Map<string, JobPosting>();

// supabase mock 체인 상태
let workLogSelectResult: { data: unknown; error: unknown };
let jobPostingSelectResult: { data: unknown; error: unknown };
let updateResultById: Record<string, { error: unknown }>;
let updateCalls: { id: string; data: Record<string, unknown> }[];

function makeFromChain(table: string) {
  let pendingUpdate: Record<string, unknown> | undefined;
  const chain: Record<string, unknown> = {
    select: () => chain,
    // read 종단: SELECT ... IN(...)
    in: () => Promise.resolve(table === 'work_logs' ? workLogSelectResult : jobPostingSelectResult),
    update: (data: Record<string, unknown>) => {
      pendingUpdate = data;
      return chain;
    },
    // write 종단: UPDATE ... EQ('id', id)
    eq: (_col: string, id: string) => {
      updateCalls.push({ id, data: pendingUpdate ?? {} });
      return Promise.resolve(updateResultById[id] ?? { error: null });
    },
  };
  return chain;
}

function makeWorkLog(id: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id,
    jobPostingId: 'jp-1',
    status: STATUS.WORK_LOG.CHECKED_OUT,
    payrollStatus: STATUS.PAYROLL.PENDING,
    ...overrides,
  } as unknown as WorkLog;
}

function makeJobPosting(id: string, ownerId: string): JobPosting {
  return { id, ownerId, compensation: undefined } as unknown as JobPosting;
}

let repo: SupabaseSettlementRepository;
const AMOUNTS: Record<string, number> = { 'wl-1': 1000, 'wl-2': 2000, 'wl-3': 3000 };

beforeEach(() => {
  mockFrom.mockReset();
  mockParseWorkLog.mockReset();
  mockParseJobPosting.mockReset();
  workLogFixtures.clear();
  jobPostingFixtures.clear();
  updateResultById = {};
  updateCalls = [];

  mockFrom.mockImplementation((table: string) => makeFromChain(table));
  mockParseWorkLog.mockImplementation((doc: { id: string }) => workLogFixtures.get(doc.id) ?? null);
  mockParseJobPosting.mockImplementation(
    (doc: { id: string }) => jobPostingFixtures.get(doc.id) ?? null
  );

  repo = new SupabaseSettlementRepository();
  // private calculateSettlementAmount: 정산 도메인 전체를 모킹하지 않고 금액만 결정적으로 고정
  jest
    .spyOn(
      repo as unknown as { calculateSettlementAmount: (wl: WorkLog) => number },
      'calculateSettlementAmount'
    )
    .mockImplementation((wl: WorkLog) => AMOUNTS[wl.id] ?? 0);
});

/** 모든 worklog가 jp-1(OWNER 소유)에 속하는 단순 시드 */
function seedValid(ids: string[]) {
  for (const id of ids) {
    workLogFixtures.set(id, makeWorkLog(id));
  }
  jobPostingFixtures.set('jp-1', makeJobPosting('jp-1', OWNER));
  workLogSelectResult = { data: ids.map((id) => ({ id })), error: null };
  jobPostingSelectResult = { data: [{ id: 'jp-1' }], error: null };
}

describe('bulkSettlementWithTransaction', () => {
  it('전부 유효: 모든 행 정산 성공 — 순서·합계·행당 단일 UPDATE 보장', async () => {
    seedValid(['wl-1', 'wl-2', 'wl-3']);
    const ctx: BulkSettlementContext = { workLogIds: ['wl-1', 'wl-2', 'wl-3'] };

    const result = await repo.bulkSettlementWithTransaction(ctx, OWNER);

    expect(result.successCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.totalAmount).toBe(6000);
    // 결과 순서는 입력 순서와 동일해야 한다 (Promise.all 순서 보존)
    expect(result.results.map((r) => r.workLogId)).toEqual(['wl-1', 'wl-2', 'wl-3']);
    expect(result.results.map((r) => r.amount)).toEqual([1000, 2000, 3000]);
    expect(result.results.every((r) => r.success)).toBe(true);
    // 각 id 정확히 1회 UPDATE
    expect(updateCalls).toHaveLength(3);
    expect(updateCalls.map((c) => c.id).sort()).toEqual(['wl-1', 'wl-2', 'wl-3']);
  });

  it('부분 실패: 중간 행 UPDATE 실패해도 앞뒤 행 커밋·순서 보존·격리 집계 (롤백 없음)', async () => {
    seedValid(['wl-1', 'wl-2', 'wl-3']);
    updateResultById['wl-2'] = { error: { message: 'db write failed' } };
    const ctx: BulkSettlementContext = { workLogIds: ['wl-1', 'wl-2', 'wl-3'] };

    const result = await repo.bulkSettlementWithTransaction(ctx, OWNER);

    // 순서 보존 + 실패 행만 격리
    expect(result.results.map((r) => r.workLogId)).toEqual(['wl-1', 'wl-2', 'wl-3']);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
    expect(result.results[1].message).toBe('정산 업데이트 실패');
    expect(result.results[2].success).toBe(true);
    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.totalAmount).toBe(4000); // 1000 + 3000 (실패한 wl-2 제외)
    // 롤백 없음: wl-1·wl-3 UPDATE는 그대로 발행됨 (+ 실패한 wl-2 시도)
    expect(updateCalls.map((c) => c.id).sort()).toEqual(['wl-1', 'wl-2', 'wl-3']);
  });

  it('검증 스킵: 이미 정산완료/타인 공고는 메시지 반환 + UPDATE 미발행', async () => {
    workLogFixtures.set(
      'wl-done',
      makeWorkLog('wl-done', { payrollStatus: STATUS.PAYROLL.COMPLETED })
    );
    workLogFixtures.set('wl-foreign', makeWorkLog('wl-foreign', { jobPostingId: 'jp-foreign' }));
    jobPostingFixtures.set('jp-1', makeJobPosting('jp-1', OWNER));
    jobPostingFixtures.set('jp-foreign', makeJobPosting('jp-foreign', 'someone-else'));
    workLogSelectResult = { data: [{ id: 'wl-done' }, { id: 'wl-foreign' }], error: null };
    jobPostingSelectResult = { data: [{ id: 'jp-1' }, { id: 'jp-foreign' }], error: null };

    const result = await repo.bulkSettlementWithTransaction(
      { workLogIds: ['wl-done', 'wl-foreign'] },
      OWNER
    );

    expect(result.successCount).toBe(0);
    expect(result.failedCount).toBe(2);
    expect(result.totalAmount).toBe(0);
    const byId = Object.fromEntries(result.results.map((r) => [r.workLogId, r]));
    expect(byId['wl-done'].message).toBe('이미 정산 완료되었습니다');
    expect(byId['wl-foreign'].message).toBe('본인의 공고가 아닙니다');
    // 검증 실패 행은 UPDATE를 발행하지 않는다
    expect(updateCalls).toHaveLength(0);
  });
});
