import * as svc from '../opsStaffService';

// babel-jest-hoist 규칙: jest.mock 팩토리가 참조하는 외부변수는 `mock` 접두사 필수.
const mockSetTournamentPosting = jest.fn();
const mockImportFromPosting = jest.fn();
const mockAddStaff = jest.fn();
const mockRemoveStaff = jest.fn();
const mockAssignTableStaff = jest.fn();

jest.mock('@/repositories/ops', () => ({
  opsStaffRepository: {
    setTournamentPosting: (...args: unknown[]) => mockSetTournamentPosting(...args),
    importFromPosting: (...args: unknown[]) => mockImportFromPosting(...args),
    addStaff: (...args: unknown[]) => mockAddStaff(...args),
    removeStaff: (...args: unknown[]) => mockRemoveStaff(...args),
    assignTableStaff: (...args: unknown[]) => mockAssignTableStaff(...args),
  },
}));

const TID = '00000000-0000-0000-0000-000000000000';

describe('opsStaffService.setTournamentPosting', () => {
  beforeEach(() => mockSetTournamentPosting.mockReset());

  it('Repository 위임 — 인자를 객체로 조립', async () => {
    mockSetTournamentPosting.mockResolvedValue(undefined);
    await svc.setTournamentPosting(TID, 'actor-1', 'posting-1');
    expect(mockSetTournamentPosting).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      jobPostingId: 'posting-1',
    });
  });

  it('jobPostingId=null(해제) 도 그대로 전달', async () => {
    mockSetTournamentPosting.mockResolvedValue(undefined);
    await svc.setTournamentPosting(TID, 'actor-1', null);
    expect(mockSetTournamentPosting).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      jobPostingId: null,
    });
  });

  it('Repository 에러 → 그대로 전파', async () => {
    mockSetTournamentPosting.mockRejectedValue(new Error('boom'));
    await expect(svc.setTournamentPosting(TID, 'actor-1', 'posting-1')).rejects.toThrow();
  });
});

describe('opsStaffService.importFromPosting', () => {
  beforeEach(() => mockImportFromPosting.mockReset());

  it('Repository 위임 + 결과 반환(imported/skipped)', async () => {
    mockImportFromPosting.mockResolvedValue({ imported: 3, skipped: 1 });
    const r = await svc.importFromPosting(TID, 'actor-1', null);
    expect(r).toEqual({ imported: 3, skipped: 1 });
    expect(mockImportFromPosting).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      date: null,
    });
  });

  it('특정 날짜 지정 시 그대로 전달', async () => {
    mockImportFromPosting.mockResolvedValue({ imported: 1, skipped: 0 });
    await svc.importFromPosting(TID, 'actor-1', '2026-07-10');
    expect(mockImportFromPosting).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      date: '2026-07-10',
    });
  });
});

describe('opsStaffService.addStaff', () => {
  beforeEach(() => mockAddStaff.mockReset());

  it('Repository 위임 — role/customRole 포함', async () => {
    mockAddStaff.mockResolvedValue(undefined);
    await svc.addStaff(TID, 'actor-1', 'staff-1', 'dealer', '보조딜러');
    expect(mockAddStaff).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      staffId: 'staff-1',
      role: 'dealer',
      customRole: '보조딜러',
    });
  });

  it('customRole 미지정 → null 로 정규화', async () => {
    mockAddStaff.mockResolvedValue(undefined);
    await svc.addStaff(TID, 'actor-1', 'staff-1', 'floor');
    expect(mockAddStaff).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      staffId: 'staff-1',
      role: 'floor',
      customRole: null,
    });
  });
});

describe('opsStaffService.removeStaff', () => {
  beforeEach(() => mockRemoveStaff.mockReset());

  it('Repository 위임', async () => {
    mockRemoveStaff.mockResolvedValue(undefined);
    await svc.removeStaff(TID, 'actor-1', 'os1');
    expect(mockRemoveStaff).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      opsStaffId: 'os1',
    });
  });
});

describe('opsStaffService.assignTableStaff', () => {
  beforeEach(() => mockAssignTableStaff.mockReset());

  it('Repository 위임', async () => {
    mockAssignTableStaff.mockResolvedValue(undefined);
    await svc.assignTableStaff(TID, 'actor-1', 'tb1', 'staff-1');
    expect(mockAssignTableStaff).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      tableId: 'tb1',
      staffId: 'staff-1',
    });
  });

  it('staffId=null(해제) 도 그대로 전달', async () => {
    mockAssignTableStaff.mockResolvedValue(undefined);
    await svc.assignTableStaff(TID, 'actor-1', 'tb1', null);
    expect(mockAssignTableStaff).toHaveBeenCalledWith({
      tournamentId: TID,
      actorId: 'actor-1',
      tableId: 'tb1',
      staffId: null,
    });
  });
});
