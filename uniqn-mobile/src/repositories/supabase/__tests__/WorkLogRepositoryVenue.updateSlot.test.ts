/**
 * WorkLogRepositoryVenue.updateSlot — 저장 경로·시간 규약 contract test
 *
 * 이 파일이 지키는 두 가지:
 *
 * 1) **경로**: 저장은 `work_logs` 직접 UPDATE 가 아니라 서버 RPC `update_work_log_slot` 1회다.
 *    직접 UPDATE 로 되돌아가면 `applications.assignments[]` 가 다시 낡은 채 남아 두 원천이
 *    표류한다(세션 E 는 병합 키로 화면 증상만 막았을 뿐 원천 불일치는 남아 있었다).
 *
 * 2) **시간 규약(§K 정본)**: `time_slot` 은 출근 예정 시각 **단일값 'HH:mm'** 또는 미기록(=미정).
 *    - 단일값 저장: startTime 하나만으로 갱신된다.
 *    - 미정 저장: timeUndecided 가 startTime 보다 우선한다.
 *    - 부분 업데이트 보존: 시간 축을 안 보내면 패치에 시간 키 자체가 없다
 *      (색상·메모만 고치려던 저장이 기존 시간을 덮어쓰면 안 된다 — GRID-1 회귀 가드).
 *    - 형식 fail-closed: 범위 문자열·자유 텍스트는 ValidationError 로 거부하고
 *      **RPC 를 아예 호출하지 않는다**(서버에 도달하기 전에 끊는다).
 */
import { updateSlot } from '../WorkLogRepositoryVenue';
import { ValidationError } from '@/errors';

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

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      if (error) throw new Error(`supabase: ${error.message ?? 'unknown'}`);
    },
  };
});

jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

/** 캡처된 RPC 패치(두 번째 인자의 p_patch). */
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

describe('updateSlot — 저장 경로(RPC 단일 관문)', () => {
  it('work_logs 를 직접 UPDATE 하지 않고 update_work_log_slot RPC 를 부른다', async () => {
    await updateSlot('wl-1', { startTime: '19:00' });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls[0][0]).toBe('update_work_log_slot');
    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_work_log_id: 'wl-1' });
  });

  it('동기화가 건너뛰어져도(assignmentSynced=false) 편집은 실패로 보지 않는다', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, assignmentSynced: false, assignmentSyncReason: 'ambiguous_match' },
      error: null,
    });

    await expect(updateSlot('wl-1', { startTime: '19:00' })).resolves.toBeUndefined();
  });

  it('데드락(40P01)은 재시도 가능한 안내로 변환한다', async () => {
    // 이 RPC(applications→work_logs)와 QR 체크아웃 경로(work_logs→트리거→applications)의
    // 잠금 순서가 역전돼 같은 지원서에서 겹치면 한쪽이 40P01 로 중단된다.
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '40P01', message: 'deadlock detected' },
    });

    await expect(updateSlot('wl-1', { startTime: '19:00' })).rejects.toThrow(
      '다른 작업과 겹쳤어요. 잠시 후 다시 시도해주세요.'
    );
  });

  it('서버가 던진 PERMISSION_DENIED 는 앱 에러로 변환한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 수정할 수 있습니다' },
    });

    await expect(updateSlot('wl-1', { memo: '메모' })).rejects.toThrow(
      '권한이 있는 공고의 근무 기록만 수정할 수 있습니다'
    );
  });
});

describe('updateSlot — 출근 예정 시각 단일값 저장', () => {
  it('startTime 하나만으로 시간 축을 단일값으로 실어 보낸다', async () => {
    await updateSlot('wl-1', { startTime: '19:00' });

    expect(capturedPatch().startTime).toBe('19:00');
  });

  it('무패딩 시각은 정본 표기로 정규화해서 보낸다', async () => {
    await updateSlot('wl-1', { startTime: '9:05' });

    expect(capturedPatch().startTime).toBe('09:05');
  });

  it("timeUndecided 면 미정 축만 보낸다('미정'은 명시 선택)", async () => {
    await updateSlot('wl-1', { timeUndecided: true });

    const patch = capturedPatch();
    expect(patch.timeUndecided).toBe(true);
    expect(patch).not.toHaveProperty('startTime');
  });

  it('미정이 startTime 보다 우선한다(인원 추가 경로와 동일 우선순위)', async () => {
    await updateSlot('wl-1', { startTime: '19:00', timeUndecided: true });

    const patch = capturedPatch();
    expect(patch.timeUndecided).toBe(true);
    expect(patch).not.toHaveProperty('startTime');
  });

  it('시간 축을 안 보내면 패치에 시간 키 자체가 없다(색상·메모만 수정 시 기존 시간 보존)', async () => {
    await updateSlot('wl-1', { color: 'primary-500', memo: '홀 담당' });

    const patch = capturedPatch();
    expect(patch).not.toHaveProperty('startTime');
    expect(patch).not.toHaveProperty('timeUndecided');
    expect(patch.color).toBe('primary-500');
    expect(patch.memo).toBe('홀 담당');
  });
});

describe('updateSlot — 형식 fail-closed (RPC 미호출)', () => {
  it('범위 문자열은 ValidationError 로 거부하고 RPC 를 치지 않는다', async () => {
    await expect(updateSlot('wl-1', { startTime: '18:00 - 02:00' })).rejects.toThrow(
      ValidationError
    );

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('자유 텍스트 시간은 ValidationError 로 거부한다(피커 0패딩만 통과)', async () => {
    await expect(updateSlot('wl-1', { startTime: '저녁 6시' })).rejects.toThrow(ValidationError);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('화이트리스트 밖 색상은 ValidationError 로 거부하고 RPC 를 치지 않는다', async () => {
    await expect(updateSlot('wl-1', { color: '#ff00ff' })).rejects.toThrow(ValidationError);

    expect(mockRpc).not.toHaveBeenCalled();
  });
});
