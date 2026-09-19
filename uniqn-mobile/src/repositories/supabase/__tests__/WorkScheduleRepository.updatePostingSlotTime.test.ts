/**
 * SupabaseWorkScheduleRepository.updatePostingSlotTime — 3-C 저장 경로 contract test
 *
 * 이 파일이 지키는 세 가지:
 *
 * 1) **경로**: 저장은 `update_posting_slot_time` RPC **1회**다. 클라가 work_logs 를 N번
 *    직접 UPDATE 하는 형태로 되돌아가면 원자성이 사라지고(일부만 바뀐 채 실패) 공고 원문
 *    정원 이동이 함께 일어나지 않아 출발지 슬롯이 재개방된다(설계 §10-2).
 *
 * 2) **시간 축은 하나만 실어 보낸다**: `timeUndecided` 가 true 면 `startTime` 을 아예
 *    페이로드에 만들지 않는다. 둘 다 보내면 우선순위가 클라와 서버 두 곳에서 관리돼 갈라진다.
 *
 * 3) **에러 매핑**: 서버 도메인 에러(`SLOT_MISMATCH`·`PERMISSION_DENIED`·데드락)를
 *    사용자가 다음 행동을 고를 수 있는 문구로 바꾼다. 특히 `SLOT_MISMATCH` 는 사용자의
 *    잘못이 아니라 **화면이 낡았다**는 뜻이라 "새로고침" 을 말해야 한다.
 */
import { SupabaseWorkScheduleRepository } from '../WorkScheduleRepository';
import { isAppError } from '@/errors';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      if (error) throw new Error(`supabase: ${error.message ?? 'unknown'}`);
    },
  };
});

const repo = new SupabaseWorkScheduleRepository();

const BASE = {
  jobPostingId: 'jp-1',
  date: '2026-09-05',
  roleKey: 'dealer',
  fromSlotKey: '18:00',
  workLogIds: ['wl-a', 'wl-b'],
} as const;

const OK_RESPONSE = {
  success: true,
  total: 2,
  updated: 2,
  assignmentSynced: 2,
  skipped: [],
  capacitySkipReason: null,
};

beforeEach(() => {
  mockRpc.mockReset();
});

describe('updatePostingSlotTime — 저장 경로', () => {
  it('RPC 를 정확히 1회, 축 4종 + 대상 배열 + 패치로 호출한다', async () => {
    mockRpc.mockResolvedValue({ data: OK_RESPONSE, error: null });

    await repo.updatePostingSlotTime({ ...BASE, startTime: '19:00' });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('update_posting_slot_time', {
      p_job_posting_id: 'jp-1',
      p_date: '2026-09-05',
      p_role_key: 'dealer',
      p_from_slot_key: '18:00',
      p_work_log_ids: ['wl-a', 'wl-b'],
      p_patch: { startTime: '19:00' },
    });
  });

  it('🔴 timeUndecided 가 startTime 을 밀어낸다 — 패치에 startTime 키가 없다', async () => {
    mockRpc.mockResolvedValue({ data: OK_RESPONSE, error: null });

    await repo.updatePostingSlotTime({ ...BASE, startTime: '19:00', timeUndecided: true });

    const patch = mockRpc.mock.calls[0]![1].p_patch as Record<string, unknown>;
    expect(patch).toEqual({ timeUndecided: true });
    expect('startTime' in patch).toBe(false);
  });

  it('읽기 전용 배열을 넘겨도 변형 가능한 배열로 복사해 보낸다', async () => {
    mockRpc.mockResolvedValue({ data: OK_RESPONSE, error: null });
    const ids: readonly string[] = Object.freeze(['wl-a']);

    await repo.updatePostingSlotTime({ ...BASE, workLogIds: ids, startTime: '19:00' });

    const sent = mockRpc.mock.calls[0]![1].p_work_log_ids as string[];
    expect(sent).toEqual(['wl-a']);
    expect(sent).not.toBe(ids);
  });
});

describe('updatePostingSlotTime — 결과 투영', () => {
  it('부분 성공을 숨기지 않는다 — skipped 와 사유를 그대로 올린다', async () => {
    mockRpc.mockResolvedValue({
      data: {
        ...OK_RESPONSE,
        updated: 2,
        assignmentSynced: 1,
        skipped: [{ workLogId: 'wl-b', reason: 'ambiguous_match' }],
      },
      error: null,
    });

    const result = await repo.updatePostingSlotTime({ ...BASE, startTime: '19:00' });

    expect(result.updated).toBe(2);
    expect(result.assignmentSynced).toBe(1);
    expect(result.skipped).toEqual([{ workLogId: 'wl-b', reason: 'ambiguous_match' }]);
  });

  it('capacitySkipReason 의 JSON null 을 optional 필드로 흘리지 않는다', async () => {
    mockRpc.mockResolvedValue({ data: OK_RESPONSE, error: null });

    const result = await repo.updatePostingSlotTime({ ...BASE, startTime: '19:00' });

    expect(result.capacitySkipReason).toBeUndefined();
    expect('capacitySkipReason' in result).toBe(false);
  });

  it('정원 이동을 건너뛴 사유는 그대로 올린다(컨테이너·고정공고)', async () => {
    mockRpc.mockResolvedValue({
      data: { ...OK_RESPONSE, capacitySkipReason: 'fixed_schedule' },
      error: null,
    });

    const result = await repo.updatePostingSlotTime({ ...BASE, startTime: '19:00' });

    expect(result.capacitySkipReason).toBe('fixed_schedule');
  });
});

describe('updatePostingSlotTime — 에러 매핑', () => {
  async function expectUserMessage(rpcError: unknown, expected: string | RegExp) {
    mockRpc.mockResolvedValue({ data: null, error: rpcError });
    try {
      await repo.updatePostingSlotTime({ ...BASE, startTime: '19:00' });
      throw new Error('던지지 않았다');
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      const message = (error as { userMessage: string }).userMessage;
      if (typeof expected === 'string') expect(message).toBe(expected);
      else expect(message).toMatch(expected);
    }
  }

  it('🔴 SLOT_MISMATCH 는 "새로고침" 을 말한다 — 사용자가 잘못 고른 것이 아니다', async () => {
    await expectUserMessage(
      { message: 'SLOT_MISMATCH: 선택한 인원 중 1명이 이 슬롯에 없습니다 (요청 2 / 일치 1)' },
      /새로고침/
    );
  });

  it('데드락(40P01)은 재시도할 이유를 알린다 — N건 반복이라 단건보다 창이 넓다', async () => {
    await expectUserMessage(
      { code: '40P01', message: 'deadlock detected' },
      '다른 작업과 겹쳤어요. 잠시 후 다시 시도해주세요.'
    );
  });

  it('PERMISSION_DENIED 는 서버 문구를 그대로 노출한다(문구 이중 관리 금지)', async () => {
    await expectUserMessage(
      { message: 'PERMISSION_DENIED: 권한이 있는 공고의 근무 시간만 변경할 수 있습니다' },
      '권한이 있는 공고의 근무 시간만 변경할 수 있습니다'
    );
  });

  it('INVALID_INPUT 도 서버 문구를 그대로 노출한다', async () => {
    await expectUserMessage(
      { message: 'INVALID_INPUT: 이미 같은 시간입니다' },
      '이미 같은 시간입니다'
    );
  });
});
