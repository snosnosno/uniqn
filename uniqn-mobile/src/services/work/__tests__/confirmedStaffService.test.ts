import type { WorkLog } from '@/types';
import { confirmedStaffRepository, userRepository, workLogRepository } from '@/repositories';
import { cancelConfirmation } from '@/services/jobs/applicationHistoryService';
import {
  cancelConfirmedStaffConfirmation,
  deleteConfirmedStaff,
  getConfirmedStaff,
  getConfirmedStaffByDate,
  markAsNoShow,
  subscribeToConfirmedStaff,
  updateStaffRole,
  updateStaffStatus,
  updateWorkTime,
} from '../confirmedStaffService';

jest.mock('@/repositories', () => ({
  confirmedStaffRepository: {
    getByJobPostingId: jest.fn(),
    getByJobPostingAndDate: jest.fn(),
    updateRoleWithTransaction: jest.fn(),
    updateWorkTimeWithTransaction: jest.fn(),
    markAsNoShow: jest.fn(),
    updateStatus: jest.fn(),
    addDirectStaff: jest.fn(),
    removeDirectStaff: jest.fn(),
    subscribeByJobPostingId: jest.fn(),
  },
  userRepository: {
    getById: jest.fn(),
  },
  workLogRepository: {
    getById: jest.fn(),
  },
}));

jest.mock('@/services/auth', () => ({
  requireCurrentUser: jest.fn(() => ({ id: 'owner-1' })),
}));
jest.mock('@/services/auth/authCoreService', () => ({
  requireCurrentUser: jest.fn(() => ({ id: 'owner-1' })),
}));

jest.mock('@/services/jobs/applicationHistoryService', () => ({
  cancelConfirmation: jest.fn(),
}));

jest.mock('@/services/jobs/jobManagementService', () => ({
  enqueueScheduleBoardSync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/shared/status', () => {
  const actual = jest.requireActual('@/shared/status');

  return {
    ...actual,
    StatusMapper: {
      ...actual.StatusMapper,
      toConfirmedStaff: jest.fn((status: string) => status),
    },
  };
});

jest.mock('@/shared/time', () => ({
  TimeNormalizer: {
    parseTime: jest.fn((input: unknown) => {
      if (input === null || input === undefined) {
        return null;
      }
      if (input instanceof Date) {
        return input;
      }
      return new Date('2025-01-20T09:00:00Z');
    }),
  },
}));

const mockConfirmedStaffRepository = confirmedStaffRepository as jest.Mocked<
  typeof confirmedStaffRepository
>;
const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockWorkLogRepository = workLogRepository as jest.Mocked<typeof workLogRepository>;
const mockCancelConfirmation = cancelConfirmation as jest.MockedFunction<typeof cancelConfirmation>;

function createMockWorkLog(overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id: 'worklog-1',
    staffId: 'staff-1',
    staffName: 'Staff One',
    jobPostingId: 'job-1',
    jobPostingName: 'Test Job',
    role: 'dealer',
    date: '2025-01-20',
    status: 'scheduled',
    attendanceStatus: 'not_started',
    isSettled: false,
    createdAt: { seconds: 1700000000, nanoseconds: 0 } as never,
    updatedAt: { seconds: 1700000000, nanoseconds: 0 } as never,
    ...overrides,
  } as WorkLog;
}

describe('confirmedStaffService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository.getById.mockResolvedValue({
      nickname: 'Staff Nick',
      name: 'Staff Name',
    } as never);
  });

  it('builds grouped confirmed staff data from repository work logs', async () => {
    mockConfirmedStaffRepository.getByJobPostingId.mockResolvedValue([
      createMockWorkLog({ id: 'worklog-1', status: 'scheduled' }),
      createMockWorkLog({ id: 'worklog-2', staffId: 'staff-2', status: 'checked_in' }),
    ]);

    const result = await getConfirmedStaff('job-1');

    expect(mockConfirmedStaffRepository.getByJobPostingId).toHaveBeenCalledWith('job-1');
    expect(result.staff).toHaveLength(2);
    expect(result.grouped.length).toBeGreaterThan(0);
    expect(result.stats.total).toBe(2);
  });

  it('fetches confirmed staff by date', async () => {
    mockConfirmedStaffRepository.getByJobPostingAndDate.mockResolvedValue([createMockWorkLog()]);

    const result = await getConfirmedStaffByDate('job-1', '2025-01-20');

    expect(mockConfirmedStaffRepository.getByJobPostingAndDate).toHaveBeenCalledWith(
      'job-1',
      '2025-01-20'
    );
    expect(result).toHaveLength(1);
  });

  it('maps role updates to repository transaction input', async () => {
    mockConfirmedStaffRepository.updateRoleWithTransaction.mockResolvedValue(undefined);

    await updateStaffRole({
      workLogId: 'worklog-1',
      newRole: 'dealer',
      reason: 'Role correction',
    });

    expect(mockConfirmedStaffRepository.updateRoleWithTransaction).toHaveBeenCalledWith({
      workLogId: 'worklog-1',
      newRole: 'dealer',
      isStandardRole: true,
      reason: 'Role correction',
      // changedBy 미전달 시에도 'system'이 아니라 세션 actorId 로 스탬프된다
      changedBy: 'owner-1',
      actorId: 'owner-1',
    });
  });

  it('maps work time updates with parsed dates', async () => {
    mockConfirmedStaffRepository.updateWorkTimeWithTransaction.mockResolvedValue(undefined);

    await updateWorkTime({
      workLogId: 'worklog-1',
      checkInTime: '09:00',
      checkOutTime: '18:00',
      reason: 'Manual correction',
    });

    expect(mockConfirmedStaffRepository.updateWorkTimeWithTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        workLogId: 'worklog-1',
        reason: 'Manual correction',
        modifiedBy: 'owner-1',
      })
    );
  });

  it('updateStaffRole는 클라이언트가 넘긴 changedBy를 무시하고 세션 actorId로 스탬프한다', async () => {
    mockConfirmedStaffRepository.updateRoleWithTransaction.mockResolvedValue(undefined);

    await updateStaffRole({
      workLogId: 'worklog-1',
      newRole: 'dealer',
      reason: 'Role correction',
      changedBy: 'spoofed-attacker',
    });

    expect(mockConfirmedStaffRepository.updateRoleWithTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ changedBy: 'owner-1', actorId: 'owner-1' })
    );
  });

  it('updateWorkTime은 클라이언트가 넘긴 modifiedBy를 무시하고 세션 actorId로 스탬프한다', async () => {
    mockConfirmedStaffRepository.updateWorkTimeWithTransaction.mockResolvedValue(undefined);

    await updateWorkTime({
      workLogId: 'worklog-1',
      checkInTime: '09:00',
      checkOutTime: '18:00',
      reason: 'Manual correction',
      modifiedBy: 'spoofed-attacker',
    });

    expect(mockConfirmedStaffRepository.updateWorkTimeWithTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ modifiedBy: 'owner-1', actorId: 'owner-1' })
    );
  });

  it('확정 스태프 해제는 실제 applicationId 와 employer_initiates 로 RPC 를 호출한다', async () => {
    mockWorkLogRepository.getById.mockResolvedValue(
      createMockWorkLog({ staffId: 'staff-1', jobPostingId: 'job-1', applicationId: 'app-1' })
    );
    mockCancelConfirmation.mockResolvedValue(undefined as never);

    await cancelConfirmedStaffConfirmation({
      workLogId: 'worklog-1',
      jobPostingId: 'job-1',
      staffId: 'staff-1',
      date: '2025-01-20',
      reason: 'Release slot',
    });

    expect(mockCancelConfirmation).toHaveBeenCalledWith(
      'app-1',
      'owner-1',
      'Release slot',
      'employer_initiates'
    );
  });

  it('합성 키(jobPostingId_staffId)가 아니라 실제 applicationId 를 넘긴다 (22P02 회귀 방지)', async () => {
    mockWorkLogRepository.getById.mockResolvedValue(
      createMockWorkLog({ staffId: 'staff-1', jobPostingId: 'job-1', applicationId: 'app-42' })
    );
    mockCancelConfirmation.mockResolvedValue(undefined as never);

    await cancelConfirmedStaffConfirmation({
      workLogId: 'worklog-1',
      jobPostingId: 'job-1',
      staffId: 'staff-1',
      date: '2025-01-20',
    });

    const [passedApplicationId] = mockCancelConfirmation.mock.calls[0];
    expect(passedApplicationId).toBe('app-42');
    expect(passedApplicationId).not.toBe('job-1_staff-1');
  });

  it('keeps deleteConfirmedStaff as backward-compatible alias', async () => {
    mockWorkLogRepository.getById.mockResolvedValue(
      createMockWorkLog({ staffId: 'staff-1', jobPostingId: 'job-1', applicationId: 'app-1' })
    );
    mockCancelConfirmation.mockResolvedValue(undefined as never);

    await deleteConfirmedStaff({
      workLogId: 'worklog-1',
      jobPostingId: 'job-1',
      staffId: 'staff-1',
      date: '2025-01-20',
    });

    expect(mockCancelConfirmation).toHaveBeenCalledWith(
      'app-1',
      'owner-1',
      undefined,
      'employer_initiates'
    );
  });

  it('routes direct-added staff (no applicationId) to removeDirectStaff', async () => {
    mockWorkLogRepository.getById.mockResolvedValue(
      createMockWorkLog({ staffId: 'staff-1', jobPostingId: 'job-1', applicationId: undefined })
    );
    mockConfirmedStaffRepository.removeDirectStaff.mockResolvedValue(undefined);

    await cancelConfirmedStaffConfirmation({
      workLogId: 'worklog-1',
      jobPostingId: 'job-1',
      staffId: 'staff-1',
      date: '2025-01-20',
    });

    expect(mockConfirmedStaffRepository.removeDirectStaff).toHaveBeenCalledWith({
      workLogId: 'worklog-1',
    });
    expect(mockCancelConfirmation).not.toHaveBeenCalled();
  });

  it('marks no-show with current owner id', async () => {
    mockConfirmedStaffRepository.markAsNoShow.mockResolvedValue(undefined);

    await markAsNoShow('worklog-1', 'No arrival');

    expect(mockConfirmedStaffRepository.markAsNoShow).toHaveBeenCalledWith({
      workLogId: 'worklog-1',
      actorId: 'owner-1',
      reason: 'No arrival',
    });
  });

  it('updates confirmed staff status with current owner id', async () => {
    mockConfirmedStaffRepository.updateStatus.mockResolvedValue(undefined);

    await updateStaffStatus('worklog-1', 'completed');

    expect(mockConfirmedStaffRepository.updateStatus).toHaveBeenCalledWith({
      workLogId: 'worklog-1',
      actorId: 'owner-1',
      status: 'completed',
    });
  });

  it('subscribes and transforms repository updates', async () => {
    let onUpdate: ((workLogs: WorkLog[]) => void | Promise<void>) | undefined;

    mockConfirmedStaffRepository.subscribeByJobPostingId.mockImplementation(
      (_jobPostingId: string, callbacks: { onUpdate: typeof onUpdate }) => {
        onUpdate = callbacks.onUpdate;
        return jest.fn();
      }
    );

    const callback = jest.fn();
    subscribeToConfirmedStaff('job-1', { onUpdate: callback });

    await onUpdate?.([createMockWorkLog()]);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        staff: expect.any(Array),
        grouped: expect.any(Array),
        stats: expect.any(Object),
      })
    );
  });
});
