// src/repositories/supabase/__tests__/SettlementRepository.modificationHistory.test.ts
//
// updateWorkLogCustomSettlement 의 정산 수정 이력 경계 검증(zod safeParse) 계약 테스트.
// work_logs jsonb 이력은 무검증 단언되어 있어, 누적 전 형식만 얇게 확인한다.
// 정상(객체 배열): 그대로 이어붙임. 오염(비배열·비객체): [] 폴백 + logger.error(throw 금지).
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { STATUS } from '@/constants';
import { logger } from '@/utils/logger';
import type { WorkLog, JobPosting } from '@/types';
import type { TaxSettings } from '@/utils/settlement';

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

const mockRpc = jest.requireMock('@/lib/supabase').supabase.rpc as jest.Mock;

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
const WORK_LOG_ID = 'wl-1';
const JOB_POSTING_ID = 'jp-1';

let workLogReadResult: { data: unknown; error: unknown };
let jobPostingReadResult: { data: unknown; error: unknown };
let updateCalls: { id: string; data: Record<string, unknown> }[];
let workLogFixture: WorkLog | null;
let jobPostingFixture: JobPosting | null;

function makeFromChain(table: string) {
  let isUpdate = false;
  let pendingUpdate: Record<string, unknown> | undefined;
  const chain: Record<string, unknown> = {
    select: () => chain,
    update: (data: Record<string, unknown>) => {
      isUpdate = true;
      pendingUpdate = data;
      return chain;
    },
    eq: (_col: string, id: string) => {
      if (isUpdate) {
        updateCalls.push({ id, data: pendingUpdate ?? {} });
        return Promise.resolve({ error: null });
      }
      return chain;
    },
    maybeSingle: () =>
      Promise.resolve(table === 'work_logs' ? workLogReadResult : jobPostingReadResult),
  };
  return chain;
}

function makeWorkLog(overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id: WORK_LOG_ID,
    jobPostingId: JOB_POSTING_ID,
    status: STATUS.WORK_LOG.CHECKED_OUT,
    payrollStatus: STATUS.PAYROLL.PENDING,
    ...overrides,
  } as unknown as WorkLog;
}

function makeJobPosting(ownerId: string): JobPosting {
  return {
    id: JOB_POSTING_ID,
    ownerId,
    workspaceId: 'ws-1',
    compensation: undefined,
  } as unknown as JobPosting;
}

function makeCustomSettlementData() {
  return {
    customSalaryInfo: { type: 'hourly', amount: 12000 },
    customAllowances: { meal: 5000 },
    customTaxSettings: { type: 'none' } as unknown as TaxSettings,
    modificationEntry: { modifiedAt: '2026-07-24T00:00:00.000Z', modifiedBy: OWNER },
  };
}

let repo: SupabaseSettlementRepository;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: false, error: null });
  mockParseWorkLog.mockReset();
  mockParseJobPosting.mockReset();
  (logger.error as jest.Mock).mockClear();
  updateCalls = [];
  workLogFixture = makeWorkLog();
  jobPostingFixture = makeJobPosting(OWNER);
  workLogReadResult = { data: { id: WORK_LOG_ID }, error: null };
  jobPostingReadResult = { data: { id: JOB_POSTING_ID }, error: null };

  mockFrom.mockImplementation((table: string) => makeFromChain(table));
  mockParseWorkLog.mockImplementation(() => workLogFixture);
  mockParseJobPosting.mockImplementation(() => jobPostingFixture);

  repo = new SupabaseSettlementRepository();
});

describe('updateWorkLogCustomSettlement — 정산 수정 이력 경계 검증', () => {
  it('정상(기존 객체 배열) → 새 항목을 이어붙여 UPDATE + logger.error 없음', async () => {
    const prior = { modifiedAt: '2026-07-01T00:00:00.000Z', modifiedBy: 'other', reason: '이전' };
    workLogFixture = makeWorkLog({
      settlementModificationHistory: [prior],
    } as unknown as Partial<WorkLog>);
    const data = makeCustomSettlementData();

    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, data, OWNER);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].data.settlement_modification_history).toEqual([
      prior,
      data.modificationEntry,
    ]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('이력 없음(undefined) → 새 항목 1건만(폴백 [] 위에 누적)', async () => {
    workLogFixture = makeWorkLog();
    const data = makeCustomSettlementData();

    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, data, OWNER);

    expect(updateCalls[0].data.settlement_modification_history).toEqual([data.modificationEntry]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('오염(배열 아님) → [] 폴백 + logger.error, 새 항목 1건만', async () => {
    workLogFixture = makeWorkLog({
      settlementModificationHistory: 'corrupt-not-an-array',
    } as unknown as Partial<WorkLog>);
    const data = makeCustomSettlementData();

    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, data, OWNER);

    expect(updateCalls[0].data.settlement_modification_history).toEqual([data.modificationEntry]);
    expect(logger.error).toHaveBeenCalledWith(
      '정산 수정 이력 형식 오류 — 빈 배열로 폴백',
      expect.objectContaining({ workLogId: WORK_LOG_ID })
    );
  });

  it('오염(항목이 객체 아님) → [] 폴백 + logger.error', async () => {
    workLogFixture = makeWorkLog({
      settlementModificationHistory: ['not-an-object', 42],
    } as unknown as Partial<WorkLog>);
    const data = makeCustomSettlementData();

    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, data, OWNER);

    expect(updateCalls[0].data.settlement_modification_history).toEqual([data.modificationEntry]);
    expect(logger.error).toHaveBeenCalled();
  });
});
