/**
 * 수동 상태 변경 — updateStatus 가 서버 RPC 한 번으로 끝나는가 (감사 data-01)
 *
 * @description 예전에 이 경로는 조회 → 권한 검증 → 타임스탬프 파생 → 이력 조립 → 직접 UPDATE
 *   를 클라에서 다단계로 했다. 그중 이력 조립이 `modification_history` 를 **읽어서 통째로
 *   덮어쓰는** read-modify-write 였고, 잠금이 없어 같은 행의 시간 편집과 겹치면 뒤에 끝난 쪽이
 *   앞의 항목을 지웠다 — 이력 jsonb Lost Update 의 4번째 경로다.
 *
 *   흡수 후의 계약을 여기서 고정한다: **RPC 정확히 1회 + work_logs 직접 UPDATE 0회.**
 *
 * 🔗 이력 append·타임스탬프 역파생·정산 잠금의 **동작**은 서버 계약이므로
 *    `supabase/tests/work_log_slot_attendance_rpc.test.sql` 44~59번이 본다.
 *    (구 `buildStatusTimestampPatch`/`buildManualStatusAudit` 유닛 테스트가 보던 것이 그쪽으로 갔다.)
 *    이 파일은 **배선**만 본다 — 두 곳에서 같은 것을 보면 조용히 갈라진다.
 */

import { SupabaseConfirmedStaffRepository } from '../ConfirmedStaffRepository';
import { STATUS } from '@/constants';

const WORK_LOG_ID = 'wl-1';
const ACTOR_ID = 'owner-1';

let updateCallCount = 0;
const mockRpc = jest.fn();
const mockFrom = jest.fn();

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

beforeEach(() => {
  updateCallCount = 0;
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: { success: true, assignmentSynced: true }, error: null });

  mockFrom.mockImplementation(() => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: () => {
        updateCallCount += 1;
        return chain;
      },
      eq: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    };
    return chain;
  });
});

describe('updateStatus — 서버 RPC 배선', () => {
  it('상태 변경은 update_work_log_slot RPC 1회로 끝나고 직접 UPDATE 를 하지 않는다', async () => {
    const repo = new SupabaseConfirmedStaffRepository();

    await repo.updateStatus({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      status: STATUS.WORK_LOG.SCHEDULED,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('update_work_log_slot', {
      p_work_log_id: WORK_LOG_ID,
      p_patch: expect.objectContaining({
        status: STATUS.WORK_LOG.SCHEDULED,
        editedBy: ACTOR_ID,
      }),
    });

    // 🔑 이 단언이 data-01 의 회귀 가드다. 클라가 work_logs 를 직접 쓰면 이력 RMW 가 돌아온다.
    expect(updateCallCount).toBe(0);
  });

  it('이력 사유를 클라가 실어 보낸다 — 서버에 제품 문구를 하드코딩하지 않기 때문', async () => {
    const repo = new SupabaseConfirmedStaffRepository();

    await repo.updateStatus({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      status: STATUS.WORK_LOG.CHECKED_IN,
    });

    const patch = mockRpc.mock.calls[0][1].p_patch as { reason: string };
    expect(patch.reason).toContain('출근');
  });

  it('상태 패치는 시각 축과 함께 보내지 않는다 — 서버가 동시 지정을 거부한다', async () => {
    const repo = new SupabaseConfirmedStaffRepository();

    await repo.updateStatus({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      status: STATUS.WORK_LOG.COMPLETED,
    });

    const patch = mockRpc.mock.calls[0][1].p_patch as Record<string, unknown>;
    expect(patch).not.toHaveProperty('checkIn');
    expect(patch).not.toHaveProperty('checkOut');
    expect(Object.keys(patch).sort()).toEqual(['editedBy', 'reason', 'status']);
  });

  it('노쇼·취소 상태는 RPC 왕복 없이 즉시 거부한다 (전용 경로가 정본)', async () => {
    const repo = new SupabaseConfirmedStaffRepository();

    await expect(
      repo.updateStatus({
        workLogId: WORK_LOG_ID,
        actorId: ACTOR_ID,
        status: STATUS.WORK_LOG.NO_SHOW,
      })
    ).rejects.toThrow();

    expect(mockRpc).not.toHaveBeenCalled();
    expect(updateCallCount).toBe(0);
  });
});
