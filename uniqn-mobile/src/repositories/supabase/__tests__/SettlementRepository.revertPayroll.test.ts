/**
 * 지급 완료 되돌리기 계약 (SETTLE-3)
 *
 * @description `updatePayrollStatusWithTransaction` 은 구현·반환까지 돼 있는데 **소비처가 레포
 *   전체에 0곳** 이라 오지급 정정 수단이 앱에 없었다. DB 쪽은 이미 이 경로를 전제해 뒀다 —
 *   마이그레이션 20260712010000 헤더가 'employer 가 payroll_status 를 completed→pending 으로
 *   되돌린 뒤 수정하는 2단계 경로는 허용한다' 고 명문화한다.
 *
 *   금전 상태를 역행시키는 조작이므로 되돌리기에는 (1) 사유 강제 (2) 감사 이력 (3) payroll_date
 *   클리어를 서버측에서 강제한다. 사유 없이 되돌릴 수 있으면 '누가 왜 되돌렸나' 가 사라진다.
 */

import { SupabaseSettlementRepository } from '../SettlementRepository';
import { STATUS } from '@/constants';
import { ValidationError } from '@/errors';
import type { WorkLog, JobPosting } from '@/types';

const WORK_LOG_ID = 'wl-1';
const JOB_POSTING_ID = 'jp-1';
const ACTOR_ID = 'owner-1';

let workLogUpdatePayloads: Record<string, unknown>[] = [];
let currentWorkLog: WorkLog;

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

jest.mock('../postingAuthority', () => ({
  resolvePostingAuthority: jest.fn().mockResolvedValue({ role: 'owner' }),
  canManagePosting: jest.fn().mockReturnValue(true),
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

function makeWorkLog(overrides: Record<string, unknown> = {}): WorkLog {
  return {
    id: WORK_LOG_ID,
    jobPostingId: JOB_POSTING_ID,
    status: STATUS.WORK_LOG.CHECKED_OUT,
    payrollStatus: STATUS.PAYROLL.COMPLETED,
    payrollAmount: 120000,
    settlementModificationHistory: [],
    ...overrides,
  } as unknown as WorkLog;
}

function installSupabaseChain() {
  mockFrom.mockImplementation((table: string) => {
    let pendingUpdate: Record<string, unknown> | undefined;
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: (data: Record<string, unknown>) => {
        pendingUpdate = data;
        return chain;
      },
      eq: () => {
        if (pendingUpdate !== undefined) {
          if (table === 'work_logs') workLogUpdatePayloads.push(pendingUpdate);
          return Promise.resolve({ data: null, error: null });
        }
        return chain;
      },
      maybeSingle: () =>
        Promise.resolve({
          data:
            table === 'work_logs'
              ? { id: WORK_LOG_ID, job_posting_id: JOB_POSTING_ID }
              : { id: JOB_POSTING_ID, owner_id: ACTOR_ID, workspace_id: 'ws-1' },
          error: null,
        }),
    };
    return chain;
  });
}

beforeEach(() => {
  workLogUpdatePayloads = [];
  currentWorkLog = makeWorkLog();
  mockParseWorkLog.mockImplementation(() => currentWorkLog);
  mockParseJobPosting.mockReturnValue({
    id: JOB_POSTING_ID,
    ownerId: ACTOR_ID,
    workspaceId: 'ws-1',
  } as unknown as JobPosting);
  installSupabaseChain();
});

const REASON = '금액을 잘못 산정해 지급 완료를 취소합니다';

describe('updatePayrollStatusWithTransaction — 지급 완료 되돌리기', () => {
  it('사유 없이 완료를 되돌리려 하면 거부한다', async () => {
    const repo = new SupabaseSettlementRepository();

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID)
    ).rejects.toBeInstanceOf(ValidationError);

    expect(workLogUpdatePayloads).toHaveLength(0);
  });

  it('공백뿐인 사유도 거부한다', async () => {
    const repo = new SupabaseSettlementRepository();

    await expect(
      repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
        reason: '   ',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('사유와 함께 되돌리면 payroll_date 를 클리어한다', async () => {
    const repo = new SupabaseSettlementRepository();

    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
      reason: REASON,
    });

    expect(workLogUpdatePayloads).toHaveLength(1);
    expect(workLogUpdatePayloads[0].payroll_status).toBe(STATUS.PAYROLL.PENDING);
    expect(workLogUpdatePayloads[0].payroll_date).toBeNull();
  });

  it('되돌리기는 감사 이력(누가·언제·왜)을 남긴다', async () => {
    const repo = new SupabaseSettlementRepository();

    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
      reason: REASON,
    });

    const history = workLogUpdatePayloads[0].settlement_modification_history as Record<
      string,
      unknown
    >[];
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      type: 'payroll_status_revert',
      previousStatus: STATUS.PAYROLL.COMPLETED,
      newStatus: STATUS.PAYROLL.PENDING,
      reason: REASON,
      modifiedBy: ACTOR_ID,
    });
    expect(history[0].modifiedAt).toEqual(expect.any(String));
  });

  it('기존 감사 이력을 보존하고 뒤에 덧붙인다', async () => {
    currentWorkLog = makeWorkLog({
      settlementModificationHistory: [{ type: 'amount_edit', reason: '수당 정정' }],
    });
    const repo = new SupabaseSettlementRepository();

    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.PENDING, ACTOR_ID, {
      reason: REASON,
    });

    const history = workLogUpdatePayloads[0].settlement_modification_history as Record<
      string,
      unknown
    >[];
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ type: 'amount_edit' });
  });

  it('완료가 아닌 건의 상태 변경은 사유 없이도 통과한다 (기존 동작 보존)', async () => {
    currentWorkLog = makeWorkLog({ payrollStatus: STATUS.PAYROLL.PENDING });
    const repo = new SupabaseSettlementRepository();

    await repo.updatePayrollStatusWithTransaction(WORK_LOG_ID, STATUS.PAYROLL.COMPLETED, ACTOR_ID);

    expect(workLogUpdatePayloads).toHaveLength(1);
    expect(workLogUpdatePayloads[0].payroll_status).toBe(STATUS.PAYROLL.COMPLETED);
    // 완료 처리는 지급일을 찍는다.
    expect(workLogUpdatePayloads[0].payroll_date).toEqual(expect.any(String));
    expect(workLogUpdatePayloads[0]).not.toHaveProperty('settlement_modification_history');
  });
});
