import * as svc from '../opsParticipantService';

// babel-jest-hoist 규칙: jest.mock 팩토리가 참조하는 외부변수는 `mock` 접두사 필수.
const mockRegisterWithEvent = jest.fn();
const mockAddRebuy = jest.fn();
const mockAddAddon = jest.fn();

jest.mock('@/repositories/ops', () => ({
  opsParticipantRepository: {
    registerWithEvent: (...args: unknown[]) => mockRegisterWithEvent(...args),
    addRebuy: (...args: unknown[]) => mockAddRebuy(...args),
    addAddon: (...args: unknown[]) => mockAddAddon(...args),
  },
}));

const TID = '00000000-0000-0000-0000-000000000000';

describe('opsParticipantService.registerParticipant', () => {
  beforeEach(() => {
    mockRegisterWithEvent.mockReset();
  });

  it('유효 입력 → Repository 위임 + 결과 반환', async () => {
    mockRegisterWithEvent.mockResolvedValue({ participantId: 'p1', entryNumber: 1 });
    const r = await svc.registerParticipant({ tournamentId: TID, name: 'Alice' }, 'actor-1');
    expect(r).toEqual({ participantId: 'p1', entryNumber: 1 });
    expect(mockRegisterWithEvent).toHaveBeenCalledWith(
      { tournamentId: TID, name: 'Alice' },
      'actor-1'
    );
  });

  it('빈 이름 → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.registerParticipant({ tournamentId: TID, name: '' }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockRegisterWithEvent).not.toHaveBeenCalled();
  });
});
