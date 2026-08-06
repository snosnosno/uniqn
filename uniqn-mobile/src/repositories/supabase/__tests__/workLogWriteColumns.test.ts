/**
 * work_logs UPDATE payload — 실재하지 않는 컬럼 전송 회귀 가드
 *
 * @description 기존 `workLogColumns.test.ts` 는 **SELECT** 화이트리스트만 지켰다. 쓰기 payload 는
 *   무방비였고, 그 사이 두 시간수정 경로가 존재하지 않는 `settlement_breakdown` 을 보내고 있었다.
 *   PostgREST 는 모르는 컬럼이 섞이면 요청 **전체**를 PGRST204 로 거부하므로, 근무 시간 수정이
 *   프로덕션에서 통째로 실패한다(2026-07-27 prod `information_schema.columns` 실측으로 확정 —
 *   work_logs 39개 컬럼에 `settlement_breakdown` 없음).
 *
 *   정산 내역(settlementBreakdown)은 DB 컬럼이 아니라 `ScheduleConverter` 가 읽기 시점에
 *   계산하는 파생값이라, 애초에 무효화할 컬럼이 존재하지 않는다.
 *
 * @remarks 이 테스트는 payload 키가 `WORK_LOG_ALL_COLUMNS` 부분집합인지만 본다. 값 계약은
 *   각 기능별 테스트(statusTimestamp·modificationHistory 등)가 담당한다.
 */

import { SupabaseConfirmedStaffRepository } from '../ConfirmedStaffRepository';
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { WORK_LOG_ALL_COLUMNS, WORK_LOG_COLUMNS } from '../workLogColumns';
import { STATUS } from '@/constants';
import type { WorkLog, JobPosting } from '@/types';

const WORK_LOG_ID = 'wl-1';
const JOB_POSTING_ID = 'jp-1';
const ACTOR_ID = 'owner-1';

let workLogUpdatePayloads: Record<string, unknown>[] = [];

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

// 권한 게이트는 이 테스트의 관심사가 아니다 — 항상 통과시킨다.
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

function makeWorkLog(): WorkLog {
  return {
    id: WORK_LOG_ID,
    jobPostingId: JOB_POSTING_ID,
    status: STATUS.WORK_LOG.CHECKED_OUT,
    payrollStatus: STATUS.PAYROLL.PENDING,
    modificationHistory: [],
    checkInTime: new Date('2026-07-01T09:00:00.000Z'),
    checkOutTime: new Date('2026-07-01T18:00:00.000Z'),
  } as unknown as WorkLog;
}

function makeJobPosting(): JobPosting {
  return {
    id: JOB_POSTING_ID,
    ownerId: ACTOR_ID,
    workspaceId: 'ws-1',
  } as unknown as JobPosting;
}

/** work_logs 읽기 → 고정 row / work_logs 쓰기 → payload 수집 / job_postings 읽기 → 소유자 일치 */
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
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({
    data: { success: true, assignmentSynced: true, assignmentSyncReason: null },
    error: null,
  });
  mockParseWorkLog.mockReturnValue(makeWorkLog());
  mockParseJobPosting.mockReturnValue(makeJobPosting());
  installSupabaseChain();
});

function unknownColumns(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((k) => !WORK_LOG_ALL_COLUMNS.includes(k));
}

describe('WORK_LOG_ALL_COLUMNS — 스키마 정본', () => {
  it('SELECT 화이트리스트는 실재 컬럼의 부분집합이다', () => {
    const missing = WORK_LOG_COLUMNS.split(',').filter((c) => !WORK_LOG_ALL_COLUMNS.includes(c));
    expect(missing).toEqual([]);
  });

  it('settlement_breakdown 은 실재 컬럼이 아니다 (prod 실측 2026-07-27)', () => {
    expect(WORK_LOG_ALL_COLUMNS).not.toContain('settlement_breakdown');
  });
});

/**
 * 근무 시간 수정 2경로는 2026-08-06 부터 컬럼을 직접 쓰지 않고 `update_work_log_slot` 에
 * jsonb 패치를 보낸다. 결함 클래스는 사라지지 않고 **한 층 위로 옮겨졌다**:
 *   (전) 실재하지 않는 컬럼 → PostgREST 가 요청 전체를 PGRST204 로 거부
 *   (후) 허용 목록 밖 패치 키 → 서버가 `INVALID_INPUT: 알 수 없는 수정 항목입니다` 로 거부
 * 둘 다 "오타 하나가 저장 전체를 죽인다" 이므로 가드도 같은 모양으로 따라간다.
 */
const SLOT_PATCH_KEYS = [
  'startTime',
  'timeUndecided',
  'staffRole',
  'color',
  'memo',
  'editedBy',
  'checkIn',
  'checkOut',
  'reason',
] as const;

/** 캡처된 RPC 패치들(update_work_log_slot 호출만). */
function slotPatches(): Record<string, unknown>[] {
  return mockRpc.mock.calls
    .filter(([fn]) => fn === 'update_work_log_slot')
    .map(([, args]) => (args as { p_patch: Record<string, unknown> }).p_patch);
}

function unknownPatchKeys(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter(
    (k) => !(SLOT_PATCH_KEYS as readonly string[]).includes(k as string)
  );
}

describe('근무 시간 수정 — RPC 패치가 서버 허용 키만 담는다', () => {
  it('정산 화면 경로(SettlementRepository)', async () => {
    const repo = new SupabaseSettlementRepository();

    await repo.updateWorkTimeWithTransaction(
      {
        workLogId: WORK_LOG_ID,
        checkInTime: new Date('2026-07-01T10:00:00.000Z'),
        checkOutTime: new Date('2026-07-01T19:00:00.000Z'),
        reason: '실제 출근 시각과 달라 정정합니다',
      },
      ACTOR_ID
    );

    // 컬럼 직접 쓰기는 0건이어야 한다 — 남아 있으면 부분 실패 창이 다시 열린다.
    expect(workLogUpdatePayloads).toEqual([]);
    expect(slotPatches()).toHaveLength(1);
    expect(unknownPatchKeys(slotPatches()[0])).toEqual([]);
  });

  it('스태프 관리 경로(ConfirmedStaffRepository)', async () => {
    const repo = new SupabaseConfirmedStaffRepository();

    await repo.updateWorkTimeWithTransaction({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      modifiedBy: ACTOR_ID,
      checkInTime: new Date('2026-07-01T10:00:00.000Z'),
      checkOutTime: new Date('2026-07-01T19:00:00.000Z'),
      reason: '실제 출근 시각과 달라 정정합니다',
    });

    expect(workLogUpdatePayloads).toEqual([]);
    expect(slotPatches()).toHaveLength(1);
    expect(unknownPatchKeys(slotPatches()[0])).toEqual([]);
  });

  it('정산 메모(notes)만은 RPC 계약 밖이라 좁은 UPDATE 로 남는다 — 실재 컬럼이다', async () => {
    // 현재 이 값을 채워 보내는 호출부는 없다. 계약에 남아 있는 동안만 유효한 가드다.
    const repo = new SupabaseSettlementRepository();

    await repo.updateWorkTimeWithTransaction(
      { workLogId: WORK_LOG_ID, checkInTime: null, notes: '정산 메모' },
      ACTOR_ID
    );

    expect(workLogUpdatePayloads).toHaveLength(1);
    expect(unknownColumns(workLogUpdatePayloads[0])).toEqual([]);
    expect(workLogUpdatePayloads[0]).toEqual({ notes: '정산 메모' });
  });
});
