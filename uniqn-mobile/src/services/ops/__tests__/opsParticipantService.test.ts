import * as svc from '../opsParticipantService';

// babel-jest-hoist 규칙: jest.mock 팩토리가 참조하는 외부변수는 `mock` 접두사 필수.
const mockRegisterWithEvent = jest.fn();
const mockAddRebuy = jest.fn();
const mockAddAddon = jest.fn();
const mockBustParticipant = jest.fn();
const mockUndoBust = jest.fn();
const mockCorrectPrize = jest.fn();

jest.mock('@/repositories/ops', () => ({
  opsParticipantRepository: {
    registerWithEvent: (...args: unknown[]) => mockRegisterWithEvent(...args),
    addRebuy: (...args: unknown[]) => mockAddRebuy(...args),
    addAddon: (...args: unknown[]) => mockAddAddon(...args),
    bustParticipant: (...args: unknown[]) => mockBustParticipant(...args),
    undoBust: (...args: unknown[]) => mockUndoBust(...args),
    correctPrize: (...args: unknown[]) => mockCorrectPrize(...args),
  },
}));

const TID = '00000000-0000-0000-0000-000000000000';
const OTHER_ID = '11111111-1111-1111-1111-111111111111';

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

describe('opsParticipantService.bustParticipant (1f — eliminatorId 가드)', () => {
  beforeEach(() => {
    mockBustParticipant.mockReset();
    mockBustParticipant.mockResolvedValue({
      finishPosition: 5,
      prizeAmount: null,
      winnerFinalized: false,
      winner: null,
    });
  });

  it('eliminatorId 미지정 → Repository 위임(undefined 전달)', async () => {
    await svc.bustParticipant(TID, 'actor-1');
    expect(mockBustParticipant).toHaveBeenCalledWith(TID, 'actor-1', undefined);
  });

  it('유효 eliminatorId → Repository 위임', async () => {
    await svc.bustParticipant(TID, 'actor-1', OTHER_ID);
    expect(mockBustParticipant).toHaveBeenCalledWith(TID, 'actor-1', OTHER_ID);
  });

  it('비-uuid eliminatorId → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.bustParticipant(TID, 'actor-1', 'not-a-uuid');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockBustParticipant).not.toHaveBeenCalled();
  });

  it('빈 문자열 eliminatorId → ValidationError(E3005), Repository 미호출(RPC 22P02 방지)', async () => {
    expect.assertions(2);
    try {
      await svc.bustParticipant(TID, 'actor-1', '');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockBustParticipant).not.toHaveBeenCalled();
  });
});

describe('opsParticipantService.undoBust (1f)', () => {
  beforeEach(() => {
    mockUndoBust.mockReset();
  });

  it('Repository 위임 + 결과 반환', async () => {
    const result = {
      participantId: TID,
      restoredChips: 30000,
      status: 'active',
      seated: true,
      tableNo: 1,
      seatNo: 3,
    };
    mockUndoBust.mockResolvedValue(result);
    const r = await svc.undoBust(TID, 'actor-1');
    expect(r).toEqual(result);
    expect(mockUndoBust).toHaveBeenCalledWith(TID, 'actor-1');
  });
});

describe('opsParticipantService.correctPrize (1f — Zod 경계)', () => {
  beforeEach(() => {
    mockCorrectPrize.mockReset();
    mockCorrectPrize.mockResolvedValue({
      participantId: TID,
      amountBefore: 10000,
      amountAfter: 50000,
    });
  });

  it('유효 입력 → parsed 필드로 Repository 위임', async () => {
    await svc.correctPrize({ participantId: TID, amount: 50000 }, 'actor-1');
    expect(mockCorrectPrize).toHaveBeenCalledWith(TID, 'actor-1', 50000, null);
  });

  it('amount=null(회수) → Repository 위임', async () => {
    await svc.correctPrize({ participantId: TID, amount: null, reason: '실격' }, 'actor-1');
    expect(mockCorrectPrize).toHaveBeenCalledWith(TID, 'actor-1', null, '실격');
  });

  it('비-uuid participantId → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.correctPrize({ participantId: 'not-uuid', amount: 0 }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockCorrectPrize).not.toHaveBeenCalled();
  });

  it('음수 amount → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.correctPrize({ participantId: TID, amount: -1 }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockCorrectPrize).not.toHaveBeenCalled();
  });
});
