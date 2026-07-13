// src/repositories/supabase/__tests__/SettlementRepository.customSettlement.test.ts
//
// updateWorkLogCustomSettlement 회귀 테스트 (P1#6 서버측 정산완료 가드).
// 정산이 완료(payrollStatus=COMPLETED)된 근무 기록의 커스텀 급여/수당/세금 설정 수정을
// 서버에서 fail-closed 로 차단하는지 잠근다(UI 방어만으로는 동결된 payroll_amount 정합이 깨진다).
// 형제 updateWorkTimeWithTransaction 과 동일하게 AlreadySettledError 를 던진다.
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { STATUS } from '@/constants';
import { AlreadySettledError, ERROR_CODES } from '@/errors';
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

// supabase mock 체인 상태
let workLogReadResult: { data: unknown; error: unknown };
let jobPostingReadResult: { data: unknown; error: unknown };
let updateResultById: Record<string, { error: unknown }>;
let updateCalls: { id: string; data: Record<string, unknown> }[];

// 파서 mock 이 반환할 픽스처(테스트당 단일 근무기록/공고)
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
        // write 종단: UPDATE ... EQ('id', id)
        updateCalls.push({ id, data: pendingUpdate ?? {} });
        return Promise.resolve(updateResultById[id] ?? { error: null });
      }
      // read: SELECT ... EQ('id', id) → maybeSingle 대기
      return chain;
    },
    // read 종단: SELECT ... EQ(...).maybeSingle()
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
    modificationEntry: { at: '2026-07-11T00:00:00.000Z', by: OWNER },
  };
}

let repo: SupabaseSettlementRepository;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  // owner 는 short-circuit 이라 RPC 미호출. 기본은 권한 없음(fail-closed).
  mockRpc.mockResolvedValue({ data: false, error: null });
  mockParseWorkLog.mockReset();
  mockParseJobPosting.mockReset();
  updateResultById = {};
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

describe('updateWorkLogCustomSettlement', () => {
  it('정산 완료 근무기록 수정 시도 → AlreadySettledError, UPDATE 미발행', async () => {
    workLogFixture = makeWorkLog({ payrollStatus: STATUS.PAYROLL.COMPLETED });

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).rejects.toBeInstanceOf(AlreadySettledError);

    // fail-closed: 정산 완료 건은 커스텀 설정 UPDATE 를 발행하지 않는다
    expect(updateCalls).toHaveLength(0);
  });

  it('정산 완료 근무기록 차단 에러 코드는 BUSINESS_ALREADY_SETTLED 이다', async () => {
    workLogFixture = makeWorkLog({ payrollStatus: STATUS.PAYROLL.COMPLETED });

    await expect(
      repo.updateWorkLogCustomSettlement(WORK_LOG_ID, makeCustomSettlementData(), OWNER)
    ).rejects.toMatchObject({ code: ERROR_CODES.BUSINESS_ALREADY_SETTLED });
  });

  it('미완료(pending) 근무기록은 기존대로 커스텀 설정 UPDATE 발행', async () => {
    workLogFixture = makeWorkLog({ payrollStatus: STATUS.PAYROLL.PENDING });
    const data = makeCustomSettlementData();

    await repo.updateWorkLogCustomSettlement(WORK_LOG_ID, data, OWNER);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].id).toBe(WORK_LOG_ID);
    expect(updateCalls[0].data).toMatchObject({
      custom_salary_info: data.customSalaryInfo,
      custom_allowances: data.customAllowances,
      custom_tax_settings: data.customTaxSettings,
    });
    // 수정 이력 누적: 기존 이력 없으면 새 항목 1건
    expect(updateCalls[0].data.settlement_modification_history).toEqual([data.modificationEntry]);
  });
});
