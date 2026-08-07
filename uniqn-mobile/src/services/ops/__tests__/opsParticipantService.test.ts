import * as svc from '../opsParticipantService';

// babel-jest-hoist 규칙: jest.mock 팩토리가 참조하는 외부변수는 `mock` 접두사 필수.
const mockRegisterWithEvent = jest.fn();
const mockAddRebuy = jest.fn();
const mockAddAddon = jest.fn();
const mockBustParticipant = jest.fn();
const mockUndoBust = jest.fn();
const mockCorrectPrize = jest.fn();
const mockSetChips = jest.fn();
const mockSetNoShow = jest.fn();
const mockUnclaim = jest.fn();

jest.mock('@/repositories/ops', () => ({
  opsParticipantRepository: {
    registerWithEvent: (...args: unknown[]) => mockRegisterWithEvent(...args),
    addRebuy: (...args: unknown[]) => mockAddRebuy(...args),
    addAddon: (...args: unknown[]) => mockAddAddon(...args),
    bustParticipant: (...args: unknown[]) => mockBustParticipant(...args),
    undoBust: (...args: unknown[]) => mockUndoBust(...args),
    correctPrize: (...args: unknown[]) => mockCorrectPrize(...args),
    setChips: (...args: unknown[]) => mockSetChips(...args),
    setNoShow: (...args: unknown[]) => mockSetNoShow(...args),
    unclaimParticipant: (...args: unknown[]) => mockUnclaim(...args),
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

describe('opsParticipantService.setParticipantChips (결함① — Zod 경계)', () => {
  beforeEach(() => {
    mockSetChips.mockReset();
    mockSetChips.mockResolvedValue({ participantId: TID, chips: 45000, chipsBefore: 30000 });
  });

  it('유효 입력 → parsed 필드로 Repository 위임 + 결과 반환', async () => {
    const r = await svc.setParticipantChips({ participantId: TID, chips: 45000 }, 'actor-1');
    expect(r).toEqual({ participantId: TID, chips: 45000, chipsBefore: 30000 });
    expect(mockSetChips).toHaveBeenCalledWith(TID, 'actor-1', 45000);
  });

  // 0 은 서버도 거부한다(0칩 active 참가자가 live_stats 의 playing/average_stack 을 오염).
  it('0칩 → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.setParticipantChips({ participantId: TID, chips: 0 }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockSetChips).not.toHaveBeenCalled();
  });

  it('음수 칩 → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.setParticipantChips({ participantId: TID, chips: -1 }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockSetChips).not.toHaveBeenCalled();
  });

  it('상한(20억) 초과 → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.setParticipantChips({ participantId: TID, chips: 2_000_000_001 }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockSetChips).not.toHaveBeenCalled();
  });

  it('소수 칩 → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.setParticipantChips({ participantId: TID, chips: 1000.5 }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockSetChips).not.toHaveBeenCalled();
  });

  it('비-uuid participantId → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.setParticipantChips({ participantId: 'not-uuid', chips: 45000 }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockSetChips).not.toHaveBeenCalled();
  });
});

describe('opsParticipantService.setParticipantNoShow (결함② — Zod 경계)', () => {
  beforeEach(() => {
    mockSetNoShow.mockReset();
    mockSetNoShow.mockResolvedValue({
      participantId: TID,
      status: 'no_show',
      statusBefore: 'checked_in',
    });
  });

  it('표시(true) → parsed 필드로 Repository 위임 + 결과 반환', async () => {
    const r = await svc.setParticipantNoShow({ participantId: TID, noShow: true }, 'actor-1');
    expect(r).toEqual({ participantId: TID, status: 'no_show', statusBefore: 'checked_in' });
    expect(mockSetNoShow).toHaveBeenCalledWith(TID, 'actor-1', true);
  });

  it('취소(false) 도 같은 경로로 위임된다(undo-first 왕복)', async () => {
    mockSetNoShow.mockResolvedValue({
      participantId: TID,
      status: 'checked_in',
      statusBefore: 'no_show',
    });
    const r = await svc.setParticipantNoShow({ participantId: TID, noShow: false }, 'actor-1');
    expect(r.status).toBe('checked_in');
    expect(mockSetNoShow).toHaveBeenCalledWith(TID, 'actor-1', false);
  });

  // noShow 누락은 서버에서도 접히지만, 왕복하면 "성공했는데 아무 일도 없음"이 된다.
  it('noShow 누락 → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.setParticipantNoShow(
        { participantId: TID } as unknown as { participantId: string; noShow: boolean },
        'actor-1'
      );
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockSetNoShow).not.toHaveBeenCalled();
  });

  it('비-uuid participantId → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.setParticipantNoShow({ participantId: 'not-uuid', noShow: true }, 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockSetNoShow).not.toHaveBeenCalled();
  });
});

describe('opsParticipantService.unclaimParticipant (결함⑤ — 죽은 회로 배선)', () => {
  beforeEach(() => {
    mockUnclaim.mockReset();
    mockUnclaim.mockResolvedValue(undefined);
  });

  it('유효 uuid → Repository 위임', async () => {
    await svc.unclaimParticipant(TID, 'actor-1');
    expect(mockUnclaim).toHaveBeenCalledWith(TID, 'actor-1');
  });

  it('비-uuid participantId → ValidationError(E3005), Repository 미호출', async () => {
    expect.assertions(2);
    try {
      await svc.unclaimParticipant('not-uuid', 'actor-1');
    } catch (e) {
      expect((e as { code: string }).code).toBe('E3005');
    }
    expect(mockUnclaim).not.toHaveBeenCalled();
  });
});
