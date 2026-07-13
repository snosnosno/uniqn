/**
 * UNIQN Mobile - settlementMutation 서비스 테스트
 *
 * @description 개인 정산 설정 수정의 인가 주체(actorId)가 세션 사용자에서
 * 파생되는지 검증. 클라이언트(훅)가 넘긴 값이 인가·수정이력에 개입할 수 없어야 한다.
 */

import { updateWorkLogCustomSettlement } from '@/services/work/settlement/settlementMutation';
import { DEFAULT_TAX_SETTINGS } from '@/utils/settlement';

const mockRepoUpdateWorkLogCustomSettlement = jest.fn();

jest.mock('@/repositories', () => ({
  settlementRepository: {
    updateWorkLogCustomSettlement: (...args: unknown[]) =>
      mockRepoUpdateWorkLogCustomSettlement(...args),
  },
}));

const mockRequireCurrentUser = jest.fn();

jest.mock('@/services/auth/authCoreService', () => ({
  requireCurrentUser: () => mockRequireCurrentUser(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

function createData() {
  return {
    customSalaryInfo: { type: 'hourly', amount: 15000 },
    customTaxSettings: DEFAULT_TAX_SETTINGS,
    modificationEntry: {
      modifiedAt: '2026-07-11T00:00:00.000Z',
      reason: '정산 금액 수정',
    } as Record<string, unknown>,
  };
}

describe('updateWorkLogCustomSettlement', () => {
  beforeEach(() => {
    mockRequireCurrentUser.mockResolvedValue({ id: 'session-user-1' });
  });

  it('세션 사용자를 actorId로 리포지토리에 전달한다', async () => {
    await updateWorkLogCustomSettlement('wl-1', createData());

    expect(mockRepoUpdateWorkLogCustomSettlement).toHaveBeenCalledTimes(1);
    const [workLogId, , actorId] = mockRepoUpdateWorkLogCustomSettlement.mock.calls[0];
    expect(workLogId).toBe('wl-1');
    expect(actorId).toBe('session-user-1');
  });

  it('수정 이력 modifiedBy를 세션 사용자로 기록한다 (클라이언트 값 무시)', async () => {
    const data = createData();
    data.modificationEntry.modifiedBy = 'spoofed-owner';

    await updateWorkLogCustomSettlement('wl-1', data);

    const [, sentData] = mockRepoUpdateWorkLogCustomSettlement.mock.calls[0];
    expect(
      (sentData as { modificationEntry: Record<string, unknown> }).modificationEntry.modifiedBy
    ).toBe('session-user-1');
    // 원본 입력은 변형하지 않는다 (불변성)
    expect(data.modificationEntry.modifiedBy).toBe('spoofed-owner');
  });

  it('미로그인 시 에러를 던지고 리포지토리를 호출하지 않는다', async () => {
    mockRequireCurrentUser.mockRejectedValue(new Error('인증이 필요합니다.'));

    await expect(updateWorkLogCustomSettlement('wl-1', createData())).rejects.toThrow(
      '인증이 필요합니다.'
    );
    expect(mockRepoUpdateWorkLogCustomSettlement).not.toHaveBeenCalled();
  });
});
