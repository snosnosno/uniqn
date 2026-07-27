/**
 * 정산 화면 시간 수정 → status 승격 회귀 가드 (SET-1)
 *
 * @description 정산 탭에서 시간을 수정해도 status 가 'scheduled' 로 남아 같은 화면의 '정산하기'가
 *   서버 게이트(`status !== checked_out && !== completed`)에서 영구 거부됐다 — 정산 탭 안에
 *   탈출구가 0개인 막다른 길. UI 게이트는 타임스탬프로 판정해 통과시키므로 사용자에게는
 *   '버튼은 눌리는데 항상 실패' 로 보인다.
 *
 *   형제 경로(ConfirmedStaffRepository)는 이미 승격하고 있었다. 이 테스트는 두 경로가
 *   같은 헬퍼(resolveWorkTimeStatus)를 통과해 동일한 status 를 쓰는지 함께 고정한다.
 */

import { SupabaseConfirmedStaffRepository } from '../ConfirmedStaffRepository';
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { STATUS } from '@/constants';
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

function makeWorkLog(overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id: WORK_LOG_ID,
    jobPostingId: JOB_POSTING_ID,
    status: STATUS.WORK_LOG.SCHEDULED,
    payrollStatus: STATUS.PAYROLL.PENDING,
    modificationHistory: [],
    checkInTime: null,
    checkOutTime: null,
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

const REASON = '실제 출근 시각과 달라 정정합니다';

describe('SettlementRepository.updateWorkTimeWithTransaction — status 승격', () => {
  it('출퇴근 시각을 모두 채우면 status 를 checked_out 으로 승격한다', async () => {
    const repo = new SupabaseSettlementRepository();

    await repo.updateWorkTimeWithTransaction(
      {
        workLogId: WORK_LOG_ID,
        checkInTime: new Date('2026-07-01T10:00:00.000Z'),
        checkOutTime: new Date('2026-07-01T19:00:00.000Z'),
        reason: REASON,
      },
      ACTOR_ID
    );

    expect(workLogUpdatePayloads).toHaveLength(1);
    expect(workLogUpdatePayloads[0].status).toBe(STATUS.WORK_LOG.CHECKED_OUT);
  });

  it('출근 시각만 채우면 checked_in 으로 승격한다', async () => {
    const repo = new SupabaseSettlementRepository();

    await repo.updateWorkTimeWithTransaction(
      { workLogId: WORK_LOG_ID, checkInTime: new Date('2026-07-01T10:00:00.000Z'), reason: REASON },
      ACTOR_ID
    );

    expect(workLogUpdatePayloads[0].status).toBe(STATUS.WORK_LOG.CHECKED_IN);
  });

  it('기존 시각과 합쳐 판정한다 — 이번에 퇴근만 넣어도 checked_out', async () => {
    currentWorkLog = makeWorkLog({
      status: STATUS.WORK_LOG.CHECKED_IN,
      checkInTime: new Date('2026-07-01T09:00:00.000Z'),
    });
    const repo = new SupabaseSettlementRepository();

    await repo.updateWorkTimeWithTransaction(
      {
        workLogId: WORK_LOG_ID,
        checkOutTime: new Date('2026-07-01T19:00:00.000Z'),
        reason: REASON,
      },
      ACTOR_ID
    );

    expect(workLogUpdatePayloads[0].status).toBe(STATUS.WORK_LOG.CHECKED_OUT);
  });

  it('노쇼 행은 시간 수정으로 status 가 바뀌지 않는다', async () => {
    currentWorkLog = makeWorkLog({ status: STATUS.WORK_LOG.NO_SHOW });
    const repo = new SupabaseSettlementRepository();

    await repo.updateWorkTimeWithTransaction(
      {
        workLogId: WORK_LOG_ID,
        checkInTime: new Date('2026-07-01T10:00:00.000Z'),
        checkOutTime: new Date('2026-07-01T19:00:00.000Z'),
        reason: REASON,
      },
      ACTOR_ID
    );

    expect(workLogUpdatePayloads[0]).not.toHaveProperty('status');
  });
});

describe('두 시간 수정 경로가 같은 status 를 쓴다 (대칭)', () => {
  it('정산 화면 경로와 스태프 관리 경로의 status 가 일치한다', async () => {
    const args = {
      checkInTime: new Date('2026-07-01T10:00:00.000Z'),
      checkOutTime: new Date('2026-07-01T19:00:00.000Z'),
      reason: REASON,
    };

    await new SupabaseSettlementRepository().updateWorkTimeWithTransaction(
      { workLogId: WORK_LOG_ID, ...args },
      ACTOR_ID
    );
    await new SupabaseConfirmedStaffRepository().updateWorkTimeWithTransaction({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      modifiedBy: ACTOR_ID,
      ...args,
    });

    expect(workLogUpdatePayloads).toHaveLength(2);
    expect(workLogUpdatePayloads[0].status).toBe(workLogUpdatePayloads[1].status);
    expect(workLogUpdatePayloads[0].status).toBe(STATUS.WORK_LOG.CHECKED_OUT);
  });
});
