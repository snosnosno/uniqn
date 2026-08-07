import * as svc from '../opsStaffService';

// babel-jest-hoist 규칙: jest.mock 팩토리가 참조하는 외부변수는 `mock` 접두사 필수.
const mockSetTournamentPosting = jest.fn();
const mockImportFromPosting = jest.fn();
const mockAddStaff = jest.fn();
const mockRemoveStaff = jest.fn();
const mockAssignTableStaff = jest.fn();
const mockResolveWorkLogs = jest.fn();
const mockUpdateSlot = jest.fn();

jest.mock('@/repositories/ops', () => ({
  opsStaffRepository: {
    setTournamentPosting: (...args: unknown[]) => mockSetTournamentPosting(...args),
    importFromPosting: (...args: unknown[]) => mockImportFromPosting(...args),
    addStaff: (...args: unknown[]) => mockAddStaff(...args),
    removeStaff: (...args: unknown[]) => mockRemoveStaff(...args),
    assignTableStaff: (...args: unknown[]) => mockAssignTableStaff(...args),
    resolveWorkLogs: (...args: unknown[]) => mockResolveWorkLogs(...args),
  },
}));

// 근태 쓰기는 ops 전용 RPC 가 아니라 **기존 update_work_log_slot 경유**다(결함 ⑦-2 설계).
jest.mock('@/services/workSchedule/gridWriteService', () => ({
  updateSlot: (...args: unknown[]) => mockUpdateSlot(...args),
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

describe('opsStaffService.resolveWorkLogs (결함 ⑦-2)', () => {
  beforeEach(() => mockResolveWorkLogs.mockReset());

  it('Repository 위임 — 인자를 객체로 조립', async () => {
    mockResolveWorkLogs.mockResolvedValue([]);
    await svc.resolveWorkLogs(TID, 'actor-1');
    expect(mockResolveWorkLogs).toHaveBeenCalledWith({ tournamentId: TID, actorId: 'actor-1' });
  });

  it('해석 결과를 가공하지 않고 그대로 돌려준다', async () => {
    const rows = [
      { opsStaffId: 'os-1', workLogId: 'wl-1', reason: 'ok', writeAllowed: true },
      { opsStaffId: 'os-2', workLogId: null, reason: 'ambiguous', writeAllowed: false },
    ];
    mockResolveWorkLogs.mockResolvedValue(rows);
    await expect(svc.resolveWorkLogs(TID, 'actor-1')).resolves.toEqual(rows);
  });

  it('Repository 에러 → 그대로 전파', async () => {
    mockResolveWorkLogs.mockRejectedValue(new Error('boom'));
    await expect(svc.resolveWorkLogs(TID, 'actor-1')).rejects.toThrow();
  });
});

describe('opsStaffService.recordAttendance (결함 ⑦-2)', () => {
  beforeEach(() => mockUpdateSlot.mockReset());

  it('work_logs 직접 PATCH 가 아니라 update_work_log_slot 경유다', async () => {
    mockUpdateSlot.mockResolvedValue(undefined);
    const t = new Date('2026-08-10T09:00:00.000Z');
    await svc.recordAttendance('wl-1', 'actor-1', { checkIn: t });
    expect(mockUpdateSlot).toHaveBeenCalledTimes(1);
    expect(mockUpdateSlot).toHaveBeenCalledWith('wl-1', {
      checkIn: t,
      reason: 'ops 콘솔 근태 기록',
      editedBy: 'actor-1',
    });
  });

  // 🔴 편도 문 방지의 핵심. `??`·truthy 로 다루면 null 이 조용히 사라져
  //    "기록은 되는데 취소는 안 되는" 상태가 되고, 오조작이 곧 정산 확정으로 굳는다.
  it('🔴 checkOut=null(되돌리기)을 삼키지 않고 그대로 전달한다', async () => {
    mockUpdateSlot.mockResolvedValue(undefined);
    await svc.recordAttendance('wl-1', 'actor-1', { checkOut: null });
    const patch = mockUpdateSlot.mock.calls[0][1] as Record<string, unknown>;
    expect('checkOut' in patch).toBe(true);
    expect(patch.checkOut).toBeNull();
  });

  it('🔴 checkIn=null(출근 기록 취소)도 그대로 전달한다', async () => {
    mockUpdateSlot.mockResolvedValue(undefined);
    await svc.recordAttendance('wl-1', 'actor-1', { checkIn: null });
    const patch = mockUpdateSlot.mock.calls[0][1] as Record<string, unknown>;
    expect('checkIn' in patch).toBe(true);
    expect(patch.checkIn).toBeNull();
  });

  it('보내지 않은 축은 패치에 키를 만들지 않는다 (미변경 축 보존)', async () => {
    mockUpdateSlot.mockResolvedValue(undefined);
    await svc.recordAttendance('wl-1', 'actor-1', { checkIn: new Date() });
    const patch = mockUpdateSlot.mock.calls[0][1] as Record<string, unknown>;
    expect('checkOut' in patch).toBe(false);
  });

  it('서버 에러(ALREADY_SETTLED 등) → 그대로 전파', async () => {
    mockUpdateSlot.mockRejectedValue(new Error('ALREADY_SETTLED'));
    await expect(
      svc.recordAttendance('wl-1', 'actor-1', { checkIn: new Date() })
    ).rejects.toThrow();
  });
});
