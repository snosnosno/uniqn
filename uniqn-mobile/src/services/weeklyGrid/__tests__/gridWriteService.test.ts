/**
 * gridWriteService.setVenueSoftTargetBulk — 벌크 soft-target 순차 저장 검증
 *
 * "이번 달 같은 요일 전체 적용"(P1-5)의 벌크 위임이 각 날짜를 순차로 레포에 위임하는지 검증한다.
 * 순차성(병렬 아님)의 핵심 계약: 중간 실패 시 이후 날짜는 호출되지 않아야 한다 — Promise.all 이면
 * 실패 전에 전부 호출됐을 것이므로, "2회에서 멈춤"이 순차 증거다.
 * 나머지 서비스 경로(updateSlot/deleteSlot/createVenueContainer)는 다른 테스트가 담당 —
 * 여기선 벌크만 격리 검증하고, 모듈 로드에 필요한 값 import 는 최소 목으로 충족한다.
 */
import { setVenueSoftTargetBulk } from '../gridWriteService';
import { weeklyGridRepository } from '@/repositories/weeklyGrid';

// 벌크가 실제로 위임하는 유일한 협력자 — 이것만 스파이한다.
jest.mock('@/repositories/weeklyGrid', () => ({
  weeklyGridRepository: {
    setVenueSoftTarget: jest.fn(),
  },
}));

// gridWriteService 모듈이 값으로 import 하는 레포 배럴 — 벌크 경로 미사용, 로드 충족용 최소 목.
jest.mock('@/repositories', () => ({
  workLogRepository: { updateSlot: jest.fn() },
  jobPostingRepository: { getOrCreateVenueContainer: jest.fn() },
}));

// deleteSlot 경로 의존 — 벌크 테스트엔 무관하나 모듈 로드 충족용 최소 목.
jest.mock('@/services/work/confirmedStaffService', () => ({
  cancelConfirmedStaffConfirmation: jest.fn(),
}));

const mockSet = weeklyGridRepository.setVenueSoftTarget as jest.Mock;

describe('gridWriteService.setVenueSoftTargetBulk', () => {
  beforeEach(() => mockSet.mockReset());

  it('dates 각각을 setVenueSoftTarget 에 순차 위임(nth 호출 인수 검증)', async () => {
    mockSet.mockResolvedValue(undefined);

    await setVenueSoftTargetBulk('v1', ['2026-07-05', '2026-07-12', '2026-07-19'], 5);

    expect(mockSet).toHaveBeenCalledTimes(3);
    expect(mockSet).toHaveBeenNthCalledWith(1, 'v1', '2026-07-05', 5);
    expect(mockSet).toHaveBeenNthCalledWith(2, 'v1', '2026-07-12', 5);
    expect(mockSet).toHaveBeenNthCalledWith(3, 'v1', '2026-07-19', 5);
  });

  it('dates 가 비면 레포를 호출하지 않는다', async () => {
    await setVenueSoftTargetBulk('v1', [], 5);

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('중간(2번째) 실패 시 예외를 전파하고 이후 날짜는 호출하지 않는다(순차 계약)', async () => {
    mockSet.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('PERMISSION_DENIED'));

    await expect(
      setVenueSoftTargetBulk('v1', ['2026-07-05', '2026-07-12', '2026-07-19'], 5)
    ).rejects.toThrow('PERMISSION_DENIED');

    // 병렬(Promise.all)이면 3회 모두 호출됐을 것 — 2회에서 멈춘 것이 순차 증거.
    expect(mockSet).toHaveBeenCalledTimes(2);
  });
});
