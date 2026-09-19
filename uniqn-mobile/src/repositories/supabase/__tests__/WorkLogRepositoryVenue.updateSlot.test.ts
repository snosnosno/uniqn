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
 *
 * 3) **실적 3상 계약**: checkIn/checkOut 은 `undefined`=미변경 / `null`=삭제 / `Date`=기록 이다.
 *    truthy 판정(`if (input.checkIn)`)으로 짜면 null 삭제가 조용히 무시되므로 세 상태를
 *    각각 고정한다. 실적 쓰기는 이 경로가 유일하다 — 직접 UPDATE 2곳은 여기로 흡수됐다.
 */
import { updateSlot } from '../WorkLogRepositoryVenue';
import { ValidationError, ERROR_CODES } from '@/errors';
import { settledLockMessage } from '@/domains/settlement';
import { MAX_WORK_TIME_REASON_LENGTH } from '@/domains/staff';

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

describe('updateSlot — 실적(출퇴근) 3상 계약', () => {
  it('checkIn 을 ISO 문자열로 패치에 실어 보낸다', async () => {
    await updateSlot('wl-1', { checkIn: new Date('2026-08-10T09:00:00Z') });

    expect(mockRpc).toHaveBeenCalledWith('update_work_log_slot', {
      p_work_log_id: 'wl-1',
      p_patch: { checkIn: '2026-08-10T09:00:00.000Z' },
    });
  });

  it('checkIn: null 은 JSON null 로 보내 삭제를 표현한다', async () => {
    await updateSlot('wl-1', { checkIn: null });

    expect(mockRpc).toHaveBeenCalledWith('update_work_log_slot', {
      p_work_log_id: 'wl-1',
      p_patch: { checkIn: null },
    });
  });

  it('checkIn 을 주지 않으면 패치에 키 자체가 없다 (미변경)', async () => {
    await updateSlot('wl-1', { memo: '메모만' });

    expect('checkIn' in capturedPatch()).toBe(false);
  });

  it('checkOut 도 같은 3상 계약을 따른다', async () => {
    await updateSlot('wl-1', { checkOut: new Date('2026-08-10T18:30:00Z') });

    expect(capturedPatch()).toEqual({ checkOut: '2026-08-10T18:30:00.000Z' });
  });

  it('checkOut: null 은 JSON null 로 보낸다(퇴근 기록 삭제)', async () => {
    await updateSlot('wl-1', { checkOut: null });

    expect(capturedPatch()).toEqual({ checkOut: null });
  });

  it('checkOut 을 주지 않으면 패치에 키 자체가 없다', async () => {
    await updateSlot('wl-1', { checkIn: new Date('2026-08-10T09:00:00Z') });

    expect('checkOut' in capturedPatch()).toBe(false);
  });

  it('예정·실적·수정사유를 한 패치로 함께 보낸다(저장 한 번 = 호출 한 번)', async () => {
    await updateSlot('wl-1', {
      startTime: '09:00',
      checkIn: new Date('2026-08-10T09:12:00Z'),
      checkOut: null,
      reason: '실제 출근 시각과 달라 정정합니다',
      editedBy: 'owner-1',
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(capturedPatch()).toEqual({
      startTime: '09:00',
      checkIn: '2026-08-10T09:12:00.000Z',
      checkOut: null,
      reason: '실제 출근 시각과 달라 정정합니다',
      editedBy: 'owner-1',
    });
  });
});

describe('updateSlot — 커스텀 역할명(customRole) 3상 계약', () => {
  it('문자열이면 그대로 실어 보낸다', async () => {
    await updateSlot('wl-1', { staffRole: 'other', customRole: '바리스타' });

    expect(capturedPatch()).toEqual({ staffRole: 'other', customRole: '바리스타' });
  });

  it('🔴 null 은 JSON null 로 보내 이름 삭제를 표현한다', async () => {
    // `if (input.customRole)` 로 짜면 여기서 키가 사라져 **삭제가 조용히 무시된다**.
    await updateSlot('wl-1', { customRole: null });

    expect('customRole' in capturedPatch()).toBe(true);
    expect(capturedPatch()).toEqual({ customRole: null });
  });

  it('주지 않으면 패치에 키 자체가 없다 (미변경)', async () => {
    await updateSlot('wl-1', { staffRole: 'floor' });

    expect('customRole' in capturedPatch()).toBe(false);
  });

  it('🔑 클라에서 다듬거나 거르지 않는다 — 검증과 문구의 단일 소스는 서버다', async () => {
    // 길이·XSS·enum 라벨 충돌은 서버(20260807120000·130000)가 판정하고, 그 한글 문장이
    // `toUpdateSlotError` 의 `userMessage` 로 그대로 노출된다. 여기서 같은 뜻의 관문을 만들면
    // 두 곳에서 관리하게 되어 조용히 갈라진다(memo·color 와 의도적으로 다른 판단).
    await updateSlot('wl-1', { staffRole: 'other', customRole: '  플로어장  ' });

    expect(capturedPatch()).toEqual({ staffRole: 'other', customRole: '  플로어장  ' });
  });
});

describe('updateSlot — 수정 사유(reason)', () => {
  it('reason 을 주지 않으면 패치에 키 자체가 없다', async () => {
    await updateSlot('wl-1', { checkIn: null });

    expect('reason' in capturedPatch()).toBe(false);
  });

  it('빈 사유는 빈 문자열로 정규화해서 보낸다(서버 기본값과 동일)', async () => {
    await updateSlot('wl-1', { checkIn: null, reason: '   ' });

    expect(capturedPatch().reason).toBe('');
  });

  it('XSS 사유는 ValidationError 로 거부하고 RPC 를 치지 않는다', async () => {
    await expect(
      updateSlot('wl-1', { checkIn: null, reason: '<script>alert(1)</script>' })
    ).rejects.toThrow(ValidationError);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('상한 초과 사유는 ValidationError 로 거부하고 RPC 를 치지 않는다', async () => {
    await expect(
      updateSlot('wl-1', { checkIn: null, reason: '가'.repeat(MAX_WORK_TIME_REASON_LENGTH + 1) })
    ).rejects.toThrow(ValidationError);

    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('updateSlot — 정산 완료 잠금(ALREADY_SETTLED)', () => {
  // 서버가 실적 키에만 거는 잠금(20260806140000:351). 매핑이 없으면 원시 SQL 메시지가
  // 사용자에게 그대로 뜬다 — 흡수 전 두 리포지토리가 던지던 AlreadySettledError 로 되돌린다.
  it('AlreadySettledError(E6009)로 변환한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'ALREADY_SETTLED: 정산이 완료된 근무는 시간을 수정할 수 없습니다' },
    });

    await expect(updateSlot('wl-1', { checkIn: null })).rejects.toMatchObject({
      name: 'AlreadySettledError',
      code: ERROR_CODES.BUSINESS_ALREADY_SETTLED,
    });
  });

  it('안내 문구는 정산 잠금 단일 소스(settledLockMessage)를 쓴다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'ALREADY_SETTLED: 정산이 완료된 근무는 시간을 수정할 수 없습니다' },
    });

    await expect(updateSlot('wl-1', { checkIn: null })).rejects.toThrow(
      settledLockMessage('시간을 수정할')
    );
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
