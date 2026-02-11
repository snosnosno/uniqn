/**
 * UNIQN Mobile - Confirmed Staff Service Tests
 *
 * @description 확정 스태프 관리 서비스 테스트
 * @version 1.0.0
 */

// ============================================================================
// Mocks (jest.mock is hoisted, so use inline factory functions)
// ============================================================================

jest.mock('@/repositories', () => ({
  confirmedStaffRepository: {
    getByJobPostingId: jest.fn(),
    getByJobPostingAndDate: jest.fn(),
    updateRoleWithTransaction: jest.fn(),
    updateWorkTimeWithTransaction: jest.fn(),
    deleteWithTransaction: jest.fn(),
    markAsNoShow: jest.fn(),
    updateStatus: jest.fn(),
    subscribeByJobPostingId: jest.fn(),
  },
  userRepository: {
    getById: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  ...jest.requireActual('@/errors'),
  toError: jest.fn((e: unknown) => (e instanceof Error ? e : new Error(String(e)))),
  isAppError: jest.fn(() => false),
}));

jest.mock('@/shared/status', () => ({
  StatusMapper: {
    toConfirmedStaff: jest.fn((status: string) => status),
  },
}));

jest.mock('@/shared/time', () => ({
  TimeNormalizer: {
    parseTime: jest.fn((input: unknown) => {
      if (input === null || input === undefined) return null;
      if (input instanceof Date) return input;
      return new Date('2025-01-20T09:00:00');
    }),
  },
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  getConfirmedStaff,
  getConfirmedStaffByDate,
  updateStaffRole,
  updateWorkTime,
  deleteConfirmedStaff,
  markAsNoShow,
  updateStaffStatus,
  subscribeToConfirmedStaff,
} from '../confirmedStaffService';
import { confirmedStaffRepository, userRepository } from '@/repositories';
import type { WorkLog } from '@/types';

// Get typed mock references
const mockConfirmedStaffRepo = confirmedStaffRepository as jest.Mocked<typeof confirmedStaffRepository>;
const mockUserRepo = userRepository as jest.Mocked<typeof userRepository>;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockWorkLog(overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id: 'wl-1',
    staffId: 'staff-1',
    staffName: 'Test Staff',
    jobPostingId: 'job-1',
    jobPostingName: 'Test Job',
    role: 'dealer',
    date: '2025-01-20',
    status: 'scheduled',
    attendanceStatus: 'not_started',
    isSettled: false,
    createdAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    updatedAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    ...overrides,
  } as WorkLog;
}

// ============================================================================
// Tests
// ============================================================================

describe('ConfirmedStaffService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: userRepository returns a user
    mockUserRepo.getById.mockResolvedValue({
      nickname: 'TestNick',
      name: 'TestName',
    } as any);
  });

  // ==========================================================================
  // getConfirmedStaff
  // ==========================================================================
  describe('getConfirmedStaff', () => {
    it('should return staff list, grouped data, and stats', async () => {
      const workLogs = [
        createMockWorkLog({ id: 'wl-1', staffId: 'staff-1', date: '2025-01-20', status: 'scheduled' }),
        createMockWorkLog({ id: 'wl-2', staffId: 'staff-2', date: '2025-01-20', status: 'checked_in' }),
        createMockWorkLog({ id: 'wl-3', staffId: 'staff-1', date: '2025-01-21', status: 'completed' }),
      ];
      mockConfirmedStaffRepo.getByJobPostingId.mockResolvedValue(workLogs);

      const result = await getConfirmedStaff('job-1');

      expect(mockConfirmedStaffRepo.getByJobPostingId).toHaveBeenCalledWith('job-1');
      expect(result.staff).toHaveLength(3);
      expect(result.grouped).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.total).toBe(3);
    });

    it('should return empty result when no work logs', async () => {
      mockConfirmedStaffRepo.getByJobPostingId.mockResolvedValue([]);

      const result = await getConfirmedStaff('job-1');

      expect(result.staff).toHaveLength(0);
      expect(result.grouped).toHaveLength(0);
      expect(result.stats.total).toBe(0);
    });

    it('should resolve staff names from userRepository', async () => {
      mockUserRepo.getById.mockResolvedValue({
        nickname: 'TestNick',
        name: 'TestName',
      } as any);

      const workLogs = [createMockWorkLog({ staffId: 'staff-1' })];
      mockConfirmedStaffRepo.getByJobPostingId.mockResolvedValue(workLogs);

      const result = await getConfirmedStaff('job-1');

      expect(mockUserRepo.getById).toHaveBeenCalledWith('staff-1');
      expect(result.staff[0].staffName).toBe('TestNick');
    });

    it('should use name field if nickname is not available', async () => {
      mockUserRepo.getById.mockResolvedValue({
        nickname: undefined,
        name: 'FallbackName',
      } as any);

      const workLogs = [createMockWorkLog({ staffId: 'staff-1' })];
      mockConfirmedStaffRepo.getByJobPostingId.mockResolvedValue(workLogs);

      const result = await getConfirmedStaff('job-1');

      expect(result.staff[0].staffName).toBe('FallbackName');
    });

    it('should use fallback name when user not found', async () => {
      mockUserRepo.getById.mockResolvedValue(null);

      const workLogs = [createMockWorkLog({ staffId: 'staff-abcd' })];
      mockConfirmedStaffRepo.getByJobPostingId.mockResolvedValue(workLogs);

      const result = await getConfirmedStaff('job-1');

      expect(result.staff[0].staffName).toContain('abcd');
    });

    it('should use fallback name when userRepository throws', async () => {
      mockUserRepo.getById.mockRejectedValue(new Error('User fetch error'));

      const workLogs = [createMockWorkLog({ staffId: 'staff-efgh' })];
      mockConfirmedStaffRepo.getByJobPostingId.mockResolvedValue(workLogs);

      const result = await getConfirmedStaff('job-1');

      expect(result.staff[0].staffName).toContain('efgh');
    });

    it('should deduplicate staff name lookups for same staffId', async () => {
      const workLogs = [
        createMockWorkLog({ id: 'wl-1', staffId: 'staff-1', date: '2025-01-20' }),
        createMockWorkLog({ id: 'wl-2', staffId: 'staff-1', date: '2025-01-21' }),
      ];
      mockConfirmedStaffRepo.getByJobPostingId.mockResolvedValue(workLogs);

      await getConfirmedStaff('job-1');

      // Should only call getById once for the same staffId
      expect(mockUserRepo.getById).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // getConfirmedStaffByDate
  // ==========================================================================
  describe('getConfirmedStaffByDate', () => {
    it('should return staff for a specific date', async () => {
      const workLogs = [
        createMockWorkLog({ id: 'wl-1', staffId: 'staff-1', date: '2025-01-20' }),
      ];
      mockConfirmedStaffRepo.getByJobPostingAndDate.mockResolvedValue(workLogs);

      const result = await getConfirmedStaffByDate('job-1', '2025-01-20');

      expect(mockConfirmedStaffRepo.getByJobPostingAndDate).toHaveBeenCalledWith(
        'job-1',
        '2025-01-20'
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no staff for date', async () => {
      mockConfirmedStaffRepo.getByJobPostingAndDate.mockResolvedValue([]);

      const result = await getConfirmedStaffByDate('job-1', '2025-01-25');

      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // updateStaffRole
  // ==========================================================================
  describe('updateStaffRole', () => {
    it('should call repository with correct parameters for standard role', async () => {
      mockConfirmedStaffRepo.updateRoleWithTransaction.mockResolvedValue(undefined);

      await updateStaffRole({
        workLogId: 'wl-1',
        newRole: 'dealer',
        reason: 'Role change',
        changedBy: 'owner-1',
      });

      expect(mockConfirmedStaffRepo.updateRoleWithTransaction).toHaveBeenCalledWith({
        workLogId: 'wl-1',
        newRole: 'dealer',
        isStandardRole: true,
        reason: 'Role change',
        changedBy: 'owner-1',
      });
    });

    it('should set isStandardRole to false for custom roles', async () => {
      mockConfirmedStaffRepo.updateRoleWithTransaction.mockResolvedValue(undefined);

      await updateStaffRole({
        workLogId: 'wl-1',
        newRole: 'custom_role_xyz',
        reason: 'Custom role',
      });

      expect(mockConfirmedStaffRepo.updateRoleWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          isStandardRole: false,
          newRole: 'custom_role_xyz',
        })
      );
    });

    it('should default changedBy to system', async () => {
      mockConfirmedStaffRepo.updateRoleWithTransaction.mockResolvedValue(undefined);

      await updateStaffRole({
        workLogId: 'wl-1',
        newRole: 'floor',
        reason: 'test',
      });

      expect(mockConfirmedStaffRepo.updateRoleWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          changedBy: 'system',
        })
      );
    });

    it('should propagate repository errors', async () => {
      mockConfirmedStaffRepo.updateRoleWithTransaction.mockRejectedValue(
        new Error('Transaction failed')
      );

      await expect(
        updateStaffRole({ workLogId: 'wl-1', newRole: 'dealer', reason: 'test' })
      ).rejects.toThrow('Transaction failed');
    });
  });

  // ==========================================================================
  // updateWorkTime
  // ==========================================================================
  describe('updateWorkTime', () => {
    it('should call repository with parsed dates', async () => {
      mockConfirmedStaffRepo.updateWorkTimeWithTransaction.mockResolvedValue(undefined);

      await updateWorkTime({
        workLogId: 'wl-1',
        checkInTime: '09:00',
        checkOutTime: '18:00',
        reason: 'Time correction',
        modifiedBy: 'owner-1',
      });

      expect(mockConfirmedStaffRepo.updateWorkTimeWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          workLogId: 'wl-1',
          reason: 'Time correction',
          modifiedBy: 'owner-1',
        })
      );
    });

    it('should handle null time inputs', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { TimeNormalizer } = require('@/shared/time');
      TimeNormalizer.parseTime.mockReturnValue(null);

      mockConfirmedStaffRepo.updateWorkTimeWithTransaction.mockResolvedValue(undefined);

      await updateWorkTime({
        workLogId: 'wl-1',
        checkInTime: null,
        checkOutTime: null,
        reason: 'Reset times',
      });

      expect(mockConfirmedStaffRepo.updateWorkTimeWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          checkInTime: null,
          checkOutTime: null,
          modifiedBy: 'system',
        })
      );
    });

    it('should propagate repository errors', async () => {
      mockConfirmedStaffRepo.updateWorkTimeWithTransaction.mockRejectedValue(
        new Error('Update failed')
      );

      await expect(
        updateWorkTime({
          workLogId: 'wl-1',
          checkInTime: '09:00',
          checkOutTime: '18:00',
          reason: 'test',
        })
      ).rejects.toThrow('Update failed');
    });
  });

  // ==========================================================================
  // deleteConfirmedStaff
  // ==========================================================================
  describe('deleteConfirmedStaff', () => {
    it('should call repository with correct parameters', async () => {
      mockConfirmedStaffRepo.deleteWithTransaction.mockResolvedValue(undefined);

      await deleteConfirmedStaff({
        workLogId: 'wl-1',
        jobPostingId: 'job-1',
        staffId: 'staff-1',
        date: '2025-01-20',
        reason: 'No longer needed',
      });

      expect(mockConfirmedStaffRepo.deleteWithTransaction).toHaveBeenCalledWith({
        workLogId: 'wl-1',
        jobPostingId: 'job-1',
        staffId: 'staff-1',
        reason: 'No longer needed',
      });
    });

    it('should propagate repository errors', async () => {
      mockConfirmedStaffRepo.deleteWithTransaction.mockRejectedValue(
        new Error('Delete failed')
      );

      await expect(
        deleteConfirmedStaff({
          workLogId: 'wl-1',
          jobPostingId: 'job-1',
          staffId: 'staff-1',
          date: '2025-01-20',
        })
      ).rejects.toThrow('Delete failed');
    });
  });

  // ==========================================================================
  // markAsNoShow
  // ==========================================================================
  describe('markAsNoShow', () => {
    it('should call repository with workLogId and reason', async () => {
      mockConfirmedStaffRepo.markAsNoShow.mockResolvedValue(undefined);

      await markAsNoShow('wl-1', 'Did not show up');

      expect(mockConfirmedStaffRepo.markAsNoShow).toHaveBeenCalledWith({
        workLogId: 'wl-1',
        reason: 'Did not show up',
      });
    });

    it('should handle undefined reason', async () => {
      mockConfirmedStaffRepo.markAsNoShow.mockResolvedValue(undefined);

      await markAsNoShow('wl-1');

      expect(mockConfirmedStaffRepo.markAsNoShow).toHaveBeenCalledWith({
        workLogId: 'wl-1',
        reason: undefined,
      });
    });

    it('should propagate repository errors', async () => {
      mockConfirmedStaffRepo.markAsNoShow.mockRejectedValue(new Error('NoShow failed'));

      await expect(markAsNoShow('wl-1')).rejects.toThrow('NoShow failed');
    });
  });

  // ==========================================================================
  // updateStaffStatus
  // ==========================================================================
  describe('updateStaffStatus', () => {
    it('should call repository with workLogId and status', async () => {
      mockConfirmedStaffRepo.updateStatus.mockResolvedValue(undefined);

      await updateStaffStatus('wl-1', 'completed');

      expect(mockConfirmedStaffRepo.updateStatus).toHaveBeenCalledWith('wl-1', 'completed');
    });

    it('should propagate repository errors', async () => {
      mockConfirmedStaffRepo.updateStatus.mockRejectedValue(
        new Error('Status update failed')
      );

      await expect(updateStaffStatus('wl-1', 'cancelled')).rejects.toThrow(
        'Status update failed'
      );
    });
  });

  // ==========================================================================
  // subscribeToConfirmedStaff
  // ==========================================================================
  describe('subscribeToConfirmedStaff', () => {
    it('should call repository subscribe and return unsubscribe function', () => {
      const mockUnsubscribe = jest.fn();
      mockConfirmedStaffRepo.subscribeByJobPostingId.mockReturnValue(mockUnsubscribe);

      const onUpdate = jest.fn();
      const onError = jest.fn();

      const unsubscribe = subscribeToConfirmedStaff('job-1', {
        onUpdate,
        onError,
      });

      expect(mockConfirmedStaffRepo.subscribeByJobPostingId).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({
          onUpdate: expect.any(Function),
          onError: onError,
        })
      );
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should transform work logs in subscription callback', async () => {
      let capturedCallback: (workLogs: WorkLog[]) => void;

      mockConfirmedStaffRepo.subscribeByJobPostingId.mockImplementation(
        (_jobPostingId: string, callbacks: { onUpdate: (workLogs: WorkLog[]) => void }) => {
          capturedCallback = callbacks.onUpdate;
          return jest.fn();
        }
      );

      const onUpdate = jest.fn();
      subscribeToConfirmedStaff('job-1', { onUpdate });

      // Trigger the callback with mock work logs
      const workLogs = [createMockWorkLog({ id: 'wl-1', staffId: 'staff-1' })];
      await capturedCallback!(workLogs);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          staff: expect.any(Array),
          grouped: expect.any(Array),
          stats: expect.any(Object),
        })
      );
    });

    it('should call onError when a critical processing error occurs in subscription', async () => {
      let capturedCallback: (workLogs: WorkLog[]) => void;

      mockConfirmedStaffRepo.subscribeByJobPostingId.mockImplementation(
        (_jobPostingId: string, callbacks: { onUpdate: (workLogs: WorkLog[]) => void }) => {
          capturedCallback = callbacks.onUpdate;
          return jest.fn();
        }
      );

      const onUpdate = jest.fn();
      const onError = jest.fn();
      subscribeToConfirmedStaff('job-1', { onUpdate, onError });

      // Pass null to cause a TypeError in workLogsToConfirmedStaff processing
      // The function expects an array with .map, so a broken item will fail
      await capturedCallback!(null as any);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
