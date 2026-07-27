/**
 * 수동 상태 변경 감사 이력 — buildManualStatusAudit + updateStatus 배선
 *
 * @description 근무시간은 곧 돈인데 '출근 예정으로 변경'이 QR 로 찍힌 check_in_ts/check_out_ts 를
 *   **이력 없이 지우고**(ATT-1·STAFF-2), 수동 출근/퇴근 처리도 누가 언제 만든 시각인지 남기지
 *   않았다(ATT-2). 시간 수정 경로(updateWorkTimeWithTransaction)는 사유+이력을 강제하는데
 *   수동 상태 변경만 비대칭이었다.
 *
 *   modification_history 길이 증가는 DB 트리거(notify_on_work_log_update)를 발화시켜 스태프에게
 *   변경 알림까지 보낸다 — 새 트리거 없이 통보 공백(값→NULL 전이를 체크인 트리거가 못 봄)도 함께 닫힌다.
 */

import {
  buildManualStatusAudit,
  SupabaseConfirmedStaffRepository,
} from '../ConfirmedStaffRepository';
import { STATUS } from '@/constants';
import type { WorkLog } from '@/types';

const WORK_LOG_ID = 'wl-1';
const JOB_POSTING_ID = 'jp-1';
const ACTOR_ID = 'owner-1';
const CHECK_IN = '2026-07-01T09:58:00.000Z';
const CHECK_OUT = '2026-07-01T18:03:00.000Z';
const NOW = '2026-07-02T01:00:00.000Z';

describe('buildManualStatusAudit — 타임스탬프가 실제로 바뀔 때만 이력을 만든다', () => {
  it('출근 예정으로 되돌리면 지워지는 두 시각을 이력에 남긴다', () => {
    const audit = buildManualStatusAudit(
      STATUS.WORK_LOG.SCHEDULED,
      { check_in_ts: null, check_out_ts: null },
      CHECK_IN,
      CHECK_OUT
    );

    expect(audit).not.toBeNull();
    expect(audit?.newStartTime).toBeNull();
    expect(audit?.newEndTime).toBeNull();
    expect(audit?.reason).toContain('출근 예정');
  });

  it('기록이 없던 행을 출근 예정으로 두면 이력을 만들지 않는다', () => {
    expect(
      buildManualStatusAudit(
        STATUS.WORK_LOG.SCHEDULED,
        { check_in_ts: null, check_out_ts: null },
        null,
        null
      )
    ).toBeNull();
  });

  it('수동 출근 처리로 새 시각이 생기면 이력을 만든다', () => {
    const audit = buildManualStatusAudit(
      STATUS.WORK_LOG.CHECKED_IN,
      { check_in_ts: NOW, check_out_ts: null },
      null,
      null
    );

    expect(audit?.newStartTime).toBe(NOW);
    expect(audit?.newEndTime).toBeUndefined();
    expect(audit?.reason).toContain('출근');
  });

  it('이미 출근 기록이 있는 행을 다시 출근 처리하면 변화가 없어 이력을 만들지 않는다', () => {
    expect(
      buildManualStatusAudit(
        STATUS.WORK_LOG.CHECKED_IN,
        { check_in_ts: CHECK_IN, check_out_ts: null },
        CHECK_IN,
        null
      )
    ).toBeNull();
  });

  it('퇴근 처리로 종료 시각만 생기면 종료 축만 이력에 담는다', () => {
    const audit = buildManualStatusAudit(
      STATUS.WORK_LOG.CHECKED_OUT,
      { check_in_ts: CHECK_IN, check_out_ts: NOW },
      CHECK_IN,
      null
    );

    expect(audit?.newStartTime).toBeUndefined();
    expect(audit?.newEndTime).toBe(NOW);
  });

  it('타임스탬프 축이 없는 status(노쇼 등)는 이력을 만들지 않는다', () => {
    expect(buildManualStatusAudit(STATUS.WORK_LOG.NO_SHOW, {}, CHECK_IN, CHECK_OUT)).toBeNull();
  });
});

// ============================================================================
// 리포지토리 배선 — updateStatus 가 감사 이력을 실제로 payload 에 싣는가
// ============================================================================

let updatePayloads: Record<string, unknown>[] = [];
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
jest.mock('@/schemas', () => {
  const actual = jest.requireActual('@/schemas');
  return { ...actual, parseWorkLogDocument: (...a: unknown[]) => mockParseWorkLog(...a) };
});

beforeEach(() => {
  updatePayloads = [];
  mockParseWorkLog.mockReturnValue({
    id: WORK_LOG_ID,
    jobPostingId: JOB_POSTING_ID,
    status: STATUS.WORK_LOG.CHECKED_OUT,
    payrollStatus: STATUS.PAYROLL.PENDING,
    modificationHistory: [],
    checkInTime: new Date(CHECK_IN),
    checkOutTime: new Date(CHECK_OUT),
  } as unknown as WorkLog);

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
          if (table === 'work_logs') updatePayloads.push(pendingUpdate);
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
});

describe('updateStatus — 감사 이력 배선', () => {
  it('출근 예정으로 되돌리면 modification_history 와 플래그를 함께 쓴다', async () => {
    const repo = new SupabaseConfirmedStaffRepository();

    await repo.updateStatus({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      status: STATUS.WORK_LOG.SCHEDULED,
    });

    expect(updatePayloads).toHaveLength(1);
    const payload = updatePayloads[0];
    expect(payload.has_time_modification_logs).toBe(true);

    const history = payload.modification_history as { modifiedBy: string; reason: string }[];
    expect(history).toHaveLength(1);
    expect(history[0].modifiedBy).toBe(ACTOR_ID);
    expect(history[0].reason).toContain('출근 예정');
  });

  it('타임스탬프가 바뀌지 않으면 이력 키를 아예 넣지 않는다', async () => {
    const repo = new SupabaseConfirmedStaffRepository();

    // 이미 checked_out 이고 두 시각이 모두 있으므로 같은 status 로 바꿔도 변화가 없다
    await repo.updateStatus({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      status: STATUS.WORK_LOG.CHECKED_OUT,
    });

    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0]).not.toHaveProperty('modification_history');
    expect(updatePayloads[0]).not.toHaveProperty('has_time_modification_logs');
  });
});
