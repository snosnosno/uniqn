/**
 * WorkLogRepositoryVenue.updateSlot — 시간 저장 규약 contract test (2-A)
 *
 * §K 정본: `time_slot` 은 **출근 예정 시각 단일값 'HH:mm'** 또는 미기록(=미정)이다.
 * 범위 저장('18:00 - 02:00')은 폐지됐고, 범위를 생산하던 유일한 지점이 바로 이 함수였다.
 *
 * 검증 대상:
 * - 단일값 저장: startTime 하나만으로 time_slot 이 갱신된다(예전엔 종료가 없으면 아예 안 썼다).
 * - 미정 저장: timeUndecided 면 time_slot 을 **null 로 비운다**. '미정'은 명시 선택으로만 도달한다.
 * - 부분 업데이트 보존: 시간 축을 안 보내면 time_slot 키 자체가 update 페이로드에 없다
 *   (색상·메모만 고치려던 저장이 기존 시간을 덮어쓰면 안 된다 — GRID-1 회귀 가드).
 * - 형식 fail-closed: 범위 문자열·자유 텍스트는 ValidationError 로 거부하고 update 를 아예 안 친다.
 */
import { updateSlot } from '../WorkLogRepositoryVenue';
import { ValidationError } from '@/errors';

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

let updateSpy: jest.Mock;

/** supabase.from(...).update(payload).eq('id', ...) 체인 목. update 인자를 캡처한다. */
function installChain() {
  const chain: Record<string, unknown> = {};
  updateSpy = jest.fn(() => chain);
  chain.update = updateSpy;
  chain.eq = jest.fn(() => Promise.resolve({ error: null }));
  mockFrom.mockReturnValue(chain);
}

/** 캡처된 update 페이로드. */
function capturedPayload(): Record<string, unknown> {
  return updateSpy.mock.calls[0][0] as Record<string, unknown>;
}

beforeEach(() => {
  mockFrom.mockReset();
  installChain();
});

describe('updateSlot — 출근 예정 시각 단일값 저장', () => {
  it('startTime 하나만으로 time_slot 을 단일값으로 갱신한다', async () => {
    await updateSlot('wl-1', { startTime: '19:00' });

    expect(capturedPayload().time_slot).toBe('19:00');
  });

  it("timeUndecided 면 time_slot 을 null 로 비운다('미정'은 명시 선택)", async () => {
    await updateSlot('wl-1', { timeUndecided: true });

    expect(capturedPayload().time_slot).toBeNull();
  });

  it('미정이 startTime 보다 우선한다(인원 추가 경로와 동일 우선순위)', async () => {
    await updateSlot('wl-1', { startTime: '19:00', timeUndecided: true });

    expect(capturedPayload().time_slot).toBeNull();
  });

  it('시간 축을 안 보내면 time_slot 키 자체가 없다(색상·메모만 수정 시 기존 시간 보존)', async () => {
    await updateSlot('wl-1', { color: 'primary-500', memo: '홀 담당' });

    const payload = capturedPayload();
    expect(payload).not.toHaveProperty('time_slot');
    expect(payload.color).toBe('primary-500');
    expect(payload.notes).toBe('홀 담당');
  });
});

describe('updateSlot — 형식 fail-closed', () => {
  it('범위 문자열은 ValidationError 로 거부하고 update 를 치지 않는다', async () => {
    await expect(updateSlot('wl-1', { startTime: '18:00 - 02:00' })).rejects.toThrow(
      ValidationError
    );

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('자유 텍스트 시간은 ValidationError 로 거부한다(피커 0패딩만 통과)', async () => {
    await expect(updateSlot('wl-1', { startTime: '저녁 6시' })).rejects.toThrow(ValidationError);

    expect(updateSpy).not.toHaveBeenCalled();
  });
});
