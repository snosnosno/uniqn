/**
 * 근무 시간(실적) 수정 — 두 경로가 같은 관문을 통과한다 (SET-1 후속)
 *
 * @description SET-1 은 "정산 탭에서 시간을 수정해도 status 가 'scheduled' 로 남아 같은 화면의
 *   '정산하기' 가 서버 게이트에서 영구 거부된다" 였다. 형제 경로(ConfirmedStaffRepository)는
 *   승격하고 있었는데 정산 경로만 빠뜨린 것 — 즉 **규칙이 두 벌이라 생긴 어긋남**이다.
 *   1차 수선은 두 경로가 같은 클라 헬퍼(resolveWorkTimeStatus)를 통과하게 만든 것이었지만,
 *   규칙이 클라에 두 벌 남아 있다는 사실 자체는 그대로였다.
 *
 *   2026-08-06 그 규칙 전체가 서버 `update_work_log_slot` 안으로 들어갔다(20260806140000).
 *   status 파생·이력 append·정산 잠금·권한은 이제 서버 한 곳에만 있으므로 **어긋남이
 *   구조적으로 불가능**하다. 그래서 이 파일이 지키는 대상도 옮겨진다:
 *
 *     (전) 두 경로가 같은 status 를 UPDATE payload 에 쓴다
 *     (후) 두 경로가 같은 RPC 를 **같은 패치로** 부르고, work_logs 를 직접 UPDATE 하지 않는다
 *
 *   status 값 자체의 계약(생애주기 4종 한정 · no_show 불가침 · completed 강등 금지)은
 *   pgTAP `work_log_slot_attendance_rpc.test.sql` 8~11번이 서버에서 직접 고정한다.
 *   같은 규칙의 클라 서술본은 `workLogTimeStatus.test.ts` 에 @deprecated 로 남아 대조용이다.
 */

import { SupabaseConfirmedStaffRepository } from '../ConfirmedStaffRepository';
import { SupabaseSettlementRepository } from '../SettlementRepository';
import { ERROR_CODES } from '@/errors';

const WORK_LOG_ID = 'wl-1';
const ACTOR_ID = 'owner-1';
const REASON = '실제 출근 시각과 달라 정정합니다';

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

/** 캡처된 RPC 패치(첫 호출의 p_patch). */
function capturedPatch(): Record<string, unknown> {
  return (mockRpc.mock.calls[0][1] as { p_patch: Record<string, unknown> }).p_patch;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({
    data: { success: true, assignmentSynced: true, assignmentSyncReason: null },
    error: null,
  });
});

describe('정산 화면 경로(SettlementRepository) — 실적 쓰기는 RPC 단일 관문', () => {
  it('출퇴근 시각을 ISO 로 실어 update_work_log_slot 1회만 부른다', async () => {
    await new SupabaseSettlementRepository().updateWorkTimeWithTransaction(
      {
        workLogId: WORK_LOG_ID,
        checkInTime: new Date('2026-07-01T10:00:00.000Z'),
        checkOutTime: new Date('2026-07-01T19:00:00.000Z'),
        reason: REASON,
      },
      ACTOR_ID
    );

    // 선행 조회(work_logs·job_postings)도 직접 UPDATE 도 사라졌다 — 왕복이 1회다.
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('update_work_log_slot', {
      p_work_log_id: WORK_LOG_ID,
      p_patch: {
        checkIn: '2026-07-01T10:00:00.000Z',
        checkOut: '2026-07-01T19:00:00.000Z',
        reason: REASON,
        editedBy: ACTOR_ID,
      },
    });
  });

  it('한쪽 축만 보내면 반대 축 키는 패치에 없다(미변경 — 서버가 기존 값을 유지한다)', async () => {
    await new SupabaseSettlementRepository().updateWorkTimeWithTransaction(
      {
        workLogId: WORK_LOG_ID,
        checkOutTime: new Date('2026-07-01T19:00:00.000Z'),
        reason: REASON,
      },
      ACTOR_ID
    );

    const patch = capturedPatch();
    expect(patch).not.toHaveProperty('checkIn');
    expect(patch.checkOut).toBe('2026-07-01T19:00:00.000Z');
  });

  it('시각 삭제(null)는 JSON null 로 전달된다 — truthy 판정으로 삼키지 않는다', async () => {
    await new SupabaseSettlementRepository().updateWorkTimeWithTransaction(
      { workLogId: WORK_LOG_ID, checkInTime: null, checkOutTime: null, reason: REASON },
      ACTOR_ID
    );

    expect(capturedPatch()).toMatchObject({ checkIn: null, checkOut: null });
  });

  it('정산 완료 잠금은 서버가 판정하고 AlreadySettledError 로 올라온다', async () => {
    // 흡수 전에는 클라가 payrollStatus 를 읽어 던졌다. 이제 서버가 실적 키에만 잠금을 건다.
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'ALREADY_SETTLED: 정산이 완료된 근무는 시간을 수정할 수 없습니다' },
    });

    await expect(
      new SupabaseSettlementRepository().updateWorkTimeWithTransaction(
        { workLogId: WORK_LOG_ID, checkInTime: new Date('2026-07-01T10:00:00.000Z') },
        ACTOR_ID
      )
    ).rejects.toMatchObject({
      name: 'AlreadySettledError',
      code: ERROR_CODES.BUSINESS_ALREADY_SETTLED,
    });
  });
});

describe('두 시간 수정 경로가 같은 관문을 통과한다 (대칭)', () => {
  it('정산 화면 경로와 스태프 관리 경로가 동일한 RPC 패치를 보낸다', async () => {
    const checkInTime = new Date('2026-07-01T10:00:00.000Z');
    const checkOutTime = new Date('2026-07-01T19:00:00.000Z');

    await new SupabaseSettlementRepository().updateWorkTimeWithTransaction(
      { workLogId: WORK_LOG_ID, checkInTime, checkOutTime, reason: REASON },
      ACTOR_ID
    );
    await new SupabaseConfirmedStaffRepository().updateWorkTimeWithTransaction({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      modifiedBy: ACTOR_ID,
      checkInTime,
      checkOutTime,
      reason: REASON,
    });

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc.mock.calls[0]).toEqual(mockRpc.mock.calls[1]);
    // 값까지 못박는다 — 두 호출이 나란히 틀려도 위 단언은 통과하기 때문이다.
    expect(mockRpc.mock.calls[0]).toEqual([
      'update_work_log_slot',
      {
        p_work_log_id: WORK_LOG_ID,
        p_patch: {
          checkIn: '2026-07-01T10:00:00.000Z',
          checkOut: '2026-07-01T19:00:00.000Z',
          reason: REASON,
          editedBy: ACTOR_ID,
        },
      },
    ]);
  });

  it('두 경로 모두 work_logs 를 직접 UPDATE 하지 않는다(시간모델 R4 선행 조건)', async () => {
    await new SupabaseSettlementRepository().updateWorkTimeWithTransaction(
      { workLogId: WORK_LOG_ID, checkInTime: null, reason: REASON },
      ACTOR_ID
    );
    await new SupabaseConfirmedStaffRepository().updateWorkTimeWithTransaction({
      workLogId: WORK_LOG_ID,
      actorId: ACTOR_ID,
      modifiedBy: ACTOR_ID,
      checkInTime: null,
      checkOutTime: null,
      reason: REASON,
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
