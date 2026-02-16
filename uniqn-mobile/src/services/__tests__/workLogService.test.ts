/**
 * UNIQN Mobile - Work Log Service Tests
 *
 * @description 근무 기록 서비스 테스트
 * @version 1.0.0
 */

// ============================================================================
// Mocks (jest.mock is hoisted, so use inline factory functions)
// ============================================================================

jest.mock('@/repositories', () => ({
  workLogRepository: {
    getByStaffId: jest.fn(),
    getByDate: jest.fn(),
    getById: jest.fn(),
    getStats: jest.fn(),
    getMonthlyPayroll: jest.fn(),
    subscribeById: jest.fn(),
    subscribeByStaffIdWithFilters: jest.fn(),
    subscribeTodayActive: jest.fn(),
    updateWorkTimeTransaction: jest.fn(),
    updatePayrollStatusTransaction: jest.fn(),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/utils/security', () => ({
  maskSensitiveId: jest.fn((id: string) => `***${id.slice(-4)}`),
  sanitizeLogData: jest.fn((data: unknown) => data),
}));

jest.mock('@/utils/date', () => ({
  toDateString: jest.fn(() => '2025-01-15'),
}));

jest.mock('@/errors', () => ({
  ...jest.requireActual('@/errors'),
  isAppError: jest.fn(),
  BusinessError: class MockBusinessError extends Error {
    code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage || code);
      this.code = code;
      this.name = 'BusinessError';
    }
  },
  ERROR_CODES: {
    BUSINESS_INVALID_WORKLOG: 'E6010',
    BUSINESS_ALREADY_SETTLED: 'E6011',
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

jest.mock('@/schemas', () => ({
  parseWorkLogDocument: jest.fn((data: unknown) => data),
}));

jest.mock('@/shared/realtime', () => ({
  RealtimeManager: {
    subscribe: jest.fn((_key: string, subscribeFn: () => () => void) => {
      const unsub = subscribeFn();
      return unsub;
    }),
    Keys: {
      workLog: jest.fn((id: string) => `workLog:${id}`),
      workLogsByRange: jest.fn(
        (staffId: string, start?: string, end?: string) => `workLogs:${staffId}:${start}:${end}`
      ),
      todayWorkStatus: jest.fn((staffId: string, date: string) => `todayWork:${staffId}:${date}`),
    },
  },
}));

jest.mock('../analyticsService', () => ({
  trackSettlementComplete: jest.fn(),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  getMyWorkLogs,
  getWorkLogsByDate,
  getWorkLogById,
  getTodayCheckedInWorkLog,
  isCurrentlyWorking,
  getWorkLogStats,
  getMonthlyPayroll,
  updateWorkTime,
  updatePayrollStatus,
  subscribeToWorkLog,
  subscribeToMyWorkLogs,
  subscribeToTodayWorkStatus,
} from '../workLogService';
import { workLogRepository } from '@/repositories';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { trackSettlementComplete } from '../analyticsService';
import type { WorkLog } from '@/types';

// Get typed mock references
const mockRepo = workLogRepository as jest.Mocked<typeof workLogRepository>;
const mockHandleServiceError = handleServiceError as jest.Mock;

// ============================================================================
// Test Data Helpers
// ============================================================================

function createMockWorkLogData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'worklog-1',
    staffId: 'staff-1',
    jobPostingId: 'job-1',
    date: '2025-01-15',
    status: 'checked_in',
    role: 'dealer',
    checkInTime: { seconds: 1700000000, nanoseconds: 0 },
    checkOutTime: null,
    payrollStatus: 'pending',
    payrollAmount: 0,
    notes: null,
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    updatedAt: { seconds: 1700000000, nanoseconds: 0 },
    ...overrides,
  };
}

function createMockWorkLogStats() {
  return {
    totalDays: 10,
    totalHours: 80,
    avgHoursPerDay: 8,
    totalEarnings: 1500000,
    pendingEarnings: 500000,
    completedEarnings: 1000000,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('WorkLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleServiceError.mockImplementation((error: unknown) => {
      if (error instanceof Error) return error;
      return new Error(String(error));
    });
  });

  // ==========================================================================
  // getMyWorkLogs
  // ==========================================================================
  describe('getMyWorkLogs', () => {
    it('should return work logs from repository with default page size', async () => {
      const mockWorkLogs = [
        createMockWorkLogData({ id: 'wl-1' }),
        createMockWorkLogData({ id: 'wl-2' }),
      ];
      mockRepo.getByStaffId.mockResolvedValue(mockWorkLogs as any);

      const result = await getMyWorkLogs('staff-1');

      expect(mockRepo.getByStaffId).toHaveBeenCalledWith('staff-1', 50);
      expect(result).toHaveLength(2);
    });

    it('should use custom page size when provided', async () => {
      mockRepo.getByStaffId.mockResolvedValue([]);

      await getMyWorkLogs('staff-1', 10);

      expect(mockRepo.getByStaffId).toHaveBeenCalledWith('staff-1', 10);
    });

    it('should return empty array when no work logs exist', async () => {
      mockRepo.getByStaffId.mockResolvedValue([]);

      const result = await getMyWorkLogs('staff-1');

      expect(result).toEqual([]);
    });

    it('should propagate repository errors via handleServiceError', async () => {
      const repoError = new Error('Firestore error');
      mockRepo.getByStaffId.mockRejectedValue(repoError);
      mockHandleServiceError.mockReturnValue(repoError);

      await expect(getMyWorkLogs('staff-1')).rejects.toThrow('Firestore error');
      expect(mockHandleServiceError).toHaveBeenCalledWith(repoError, {
        operation: '근무 기록 목록 조회',
        component: 'workLogService',
        context: expect.objectContaining({ staffId: expect.any(String) }),
      });
    });
  });

  // ==========================================================================
  // getWorkLogsByDate
  // ==========================================================================
  describe('getWorkLogsByDate', () => {
    it('should return work logs for a specific date', async () => {
      const mockWorkLogs = [createMockWorkLogData()];
      mockRepo.getByDate.mockResolvedValue(mockWorkLogs as any);

      const result = await getWorkLogsByDate('staff-1', '2025-01-15');

      expect(mockRepo.getByDate).toHaveBeenCalledWith('staff-1', '2025-01-15');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no logs for date', async () => {
      mockRepo.getByDate.mockResolvedValue([]);

      const result = await getWorkLogsByDate('staff-1', '2025-01-20');

      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      const repoError = new Error('Date query failed');
      mockRepo.getByDate.mockRejectedValue(repoError);
      mockHandleServiceError.mockReturnValue(repoError);

      await expect(getWorkLogsByDate('staff-1', '2025-01-15')).rejects.toThrow('Date query failed');
    });
  });

  // ==========================================================================
  // getWorkLogById
  // ==========================================================================
  describe('getWorkLogById', () => {
    it('should return work log by id', async () => {
      const mockWorkLog = createMockWorkLogData();
      mockRepo.getById.mockResolvedValue(mockWorkLog as any);

      const result = await getWorkLogById('worklog-1');

      expect(mockRepo.getById).toHaveBeenCalledWith('worklog-1');
      expect(result).toEqual(mockWorkLog);
    });

    it('should return null when work log not found', async () => {
      mockRepo.getById.mockResolvedValue(null);

      const result = await getWorkLogById('non-existent');

      expect(result).toBeNull();
    });

    it('should propagate repository errors', async () => {
      const repoError = new Error('Not found');
      mockRepo.getById.mockRejectedValue(repoError);
      mockHandleServiceError.mockReturnValue(repoError);

      await expect(getWorkLogById('bad-id')).rejects.toThrow('Not found');
    });
  });

  // ==========================================================================
  // getTodayCheckedInWorkLog
  // ==========================================================================
  describe('getTodayCheckedInWorkLog', () => {
    it('should return checked-in work log for today', async () => {
      const checkedInLog = createMockWorkLogData({ status: 'checked_in' });
      mockRepo.getByDate.mockResolvedValue([checkedInLog] as any);

      const result = await getTodayCheckedInWorkLog('staff-1');

      expect(result).toEqual(checkedInLog);
    });

    it('should return null when no checked-in work log exists', async () => {
      const scheduledLog = createMockWorkLogData({ status: 'scheduled' });
      mockRepo.getByDate.mockResolvedValue([scheduledLog] as any);

      const result = await getTodayCheckedInWorkLog('staff-1');

      expect(result).toBeNull();
    });

    it('should return null when no work logs exist for today', async () => {
      mockRepo.getByDate.mockResolvedValue([]);

      const result = await getTodayCheckedInWorkLog('staff-1');

      expect(result).toBeNull();
    });

    it('should find checked-in log among multiple logs', async () => {
      const logs = [
        createMockWorkLogData({ id: 'wl-1', status: 'completed' }),
        createMockWorkLogData({ id: 'wl-2', status: 'checked_in' }),
        createMockWorkLogData({ id: 'wl-3', status: 'scheduled' }),
      ];
      mockRepo.getByDate.mockResolvedValue(logs as any);

      const result = await getTodayCheckedInWorkLog('staff-1');

      expect(result).toEqual(logs[1]);
    });

    it('should propagate errors from getWorkLogsByDate', async () => {
      const error = new Error('Query failed');
      mockRepo.getByDate.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getTodayCheckedInWorkLog('staff-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // isCurrentlyWorking
  // ==========================================================================
  describe('isCurrentlyWorking', () => {
    it('should return true when staff has checked-in work log', async () => {
      const checkedInLog = createMockWorkLogData({ status: 'checked_in' });
      mockRepo.getByDate.mockResolvedValue([checkedInLog] as any);

      const result = await isCurrentlyWorking('staff-1');

      expect(result).toBe(true);
    });

    it('should return false when no checked-in work log', async () => {
      mockRepo.getByDate.mockResolvedValue([]);

      const result = await isCurrentlyWorking('staff-1');

      expect(result).toBe(false);
    });

    it('should return false when only completed logs exist', async () => {
      const completedLog = createMockWorkLogData({ status: 'completed' });
      mockRepo.getByDate.mockResolvedValue([completedLog] as any);

      const result = await isCurrentlyWorking('staff-1');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // getWorkLogStats
  // ==========================================================================
  describe('getWorkLogStats', () => {
    it('should return work log statistics from repository', async () => {
      const mockStats = createMockWorkLogStats();
      mockRepo.getStats.mockResolvedValue(mockStats as any);

      const result = await getWorkLogStats('staff-1');

      expect(mockRepo.getStats).toHaveBeenCalledWith('staff-1');
      expect(result).toEqual(mockStats);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Stats failed');
      mockRepo.getStats.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getWorkLogStats('staff-1')).rejects.toThrow('Stats failed');
    });
  });

  // ==========================================================================
  // getMonthlyPayroll
  // ==========================================================================
  describe('getMonthlyPayroll', () => {
    it('should return monthly payroll summary from repository', async () => {
      const mockSummary = {
        totalAmount: 3000000,
        pendingAmount: 1000000,
        completedAmount: 2000000,
        workLogs: [createMockWorkLogData()],
      };
      mockRepo.getMonthlyPayroll.mockResolvedValue(mockSummary as any);

      const result = await getMonthlyPayroll('staff-1', 2025, 1);

      expect(mockRepo.getMonthlyPayroll).toHaveBeenCalledWith('staff-1', 2025, 1);
      expect(result.totalAmount).toBe(3000000);
      expect(result.pendingAmount).toBe(1000000);
      expect(result.completedAmount).toBe(2000000);
      expect(result.workLogs).toHaveLength(1);
    });

    it('should return empty workLogs array when summary has no workLogs', async () => {
      const mockSummary = {
        totalAmount: 0,
        pendingAmount: 0,
        completedAmount: 0,
        workLogs: undefined,
      };
      mockRepo.getMonthlyPayroll.mockResolvedValue(mockSummary as any);

      const result = await getMonthlyPayroll('staff-1', 2025, 2);

      expect(result.workLogs).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Payroll query failed');
      mockRepo.getMonthlyPayroll.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getMonthlyPayroll('staff-1', 2025, 1)).rejects.toThrow('Payroll query failed');
    });
  });

  // ==========================================================================
  // updateWorkTime
  // ==========================================================================
  describe('updateWorkTime', () => {
    it('should update work time using transaction', async () => {
      mockRepo.updateWorkTimeTransaction.mockResolvedValue(undefined);

      const updates = {
        checkInTime: new Date('2025-01-15T09:00:00'),
        checkOutTime: new Date('2025-01-15T18:00:00'),
        notes: 'Updated notes',
      };

      await expect(updateWorkTime('worklog-1', updates)).resolves.toBeUndefined();
      expect(mockRepo.updateWorkTimeTransaction).toHaveBeenCalledWith('worklog-1', updates);
    });

    it('should throw when repository rejects (not found)', async () => {
      mockRepo.updateWorkTimeTransaction.mockRejectedValue(
        new Error('근무 기록을 찾을 수 없습니다')
      );

      await expect(updateWorkTime('worklog-1', {})).rejects.toThrow();
    });

    it('should throw when repository rejects (invalid data)', async () => {
      mockRepo.updateWorkTimeTransaction.mockRejectedValue(
        new Error('근무 기록 데이터가 올바르지 않습니다')
      );

      await expect(updateWorkTime('worklog-1', {})).rejects.toThrow();
    });

    it('should throw when repository rejects (already settled)', async () => {
      mockRepo.updateWorkTimeTransaction.mockRejectedValue(
        new Error('이미 정산이 완료된 기록입니다')
      );

      await expect(updateWorkTime('worklog-1', { notes: 'test' })).rejects.toThrow();
    });

    it('should only include provided fields in update', async () => {
      mockRepo.updateWorkTimeTransaction.mockResolvedValue(undefined);

      await updateWorkTime('worklog-1', { notes: 'Only notes updated' });

      expect(mockRepo.updateWorkTimeTransaction).toHaveBeenCalledWith('worklog-1', {
        notes: 'Only notes updated',
      });
    });

    it('should include checkInTime when provided', async () => {
      mockRepo.updateWorkTimeTransaction.mockResolvedValue(undefined);

      const checkInTime = new Date('2025-01-15T09:00:00');
      await updateWorkTime('worklog-1', { checkInTime });

      expect(mockRepo.updateWorkTimeTransaction).toHaveBeenCalledWith('worklog-1', {
        checkInTime,
      });
    });

    it('should propagate errors via handleServiceError', async () => {
      const error = new Error('Transaction failed');
      mockRepo.updateWorkTimeTransaction.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(updateWorkTime('worklog-1', {})).rejects.toThrow('Transaction failed');
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // updatePayrollStatus
  // ==========================================================================
  describe('updatePayrollStatus', () => {
    it('should update payroll status using transaction', async () => {
      mockRepo.updatePayrollStatusTransaction.mockResolvedValue(undefined);

      await expect(
        updatePayrollStatus('worklog-1', 'completed' as any, 150000)
      ).resolves.toBeUndefined();
      expect(mockRepo.updatePayrollStatusTransaction).toHaveBeenCalledWith(
        'worklog-1',
        'completed',
        150000
      );
    });

    it('should throw when repository rejects (not found)', async () => {
      mockRepo.updatePayrollStatusTransaction.mockRejectedValue(
        new Error('근무 기록을 찾을 수 없습니다')
      );

      await expect(updatePayrollStatus('worklog-1', 'completed' as any)).rejects.toThrow();
    });

    it('should throw when repository rejects (invalid data)', async () => {
      mockRepo.updatePayrollStatusTransaction.mockRejectedValue(
        new Error('근무 기록 데이터가 올바르지 않습니다')
      );

      await expect(updatePayrollStatus('worklog-1', 'completed' as any)).rejects.toThrow();
    });

    it('should throw when repository rejects (already settled)', async () => {
      mockRepo.updatePayrollStatusTransaction.mockRejectedValue(
        new Error('이미 정산이 완료된 기록입니다')
      );

      await expect(updatePayrollStatus('worklog-1', 'completed' as any)).rejects.toThrow();
    });

    it('should include payrollAmount when amount is provided', async () => {
      mockRepo.updatePayrollStatusTransaction.mockResolvedValue(undefined);

      await updatePayrollStatus('worklog-1', 'completed' as any, 200000);

      expect(mockRepo.updatePayrollStatusTransaction).toHaveBeenCalledWith(
        'worklog-1',
        'completed',
        200000
      );
    });

    it('should pass status and amount to repository transaction', async () => {
      mockRepo.updatePayrollStatusTransaction.mockResolvedValue(undefined);

      await updatePayrollStatus('worklog-1', 'completed' as any, 150000);

      expect(mockRepo.updatePayrollStatusTransaction).toHaveBeenCalledWith(
        'worklog-1',
        'completed',
        150000
      );
    });

    it('should pass status without amount when not provided', async () => {
      mockRepo.updatePayrollStatusTransaction.mockResolvedValue(undefined);

      await updatePayrollStatus('worklog-1', 'processing' as any);

      expect(mockRepo.updatePayrollStatusTransaction).toHaveBeenCalledWith(
        'worklog-1',
        'processing',
        undefined
      );
    });

    it('should call trackSettlementComplete when status is completed with amount', async () => {
      mockRepo.updatePayrollStatusTransaction.mockResolvedValue(undefined);

      await updatePayrollStatus('worklog-1', 'completed' as any, 150000);

      expect(trackSettlementComplete).toHaveBeenCalledWith(150000, 1);
    });

    it('should not call trackSettlementComplete when status is not completed', async () => {
      mockRepo.updatePayrollStatusTransaction.mockResolvedValue(undefined);

      await updatePayrollStatus('worklog-1', 'processing' as any);

      expect(trackSettlementComplete).not.toHaveBeenCalled();
    });

    it('should not call trackSettlementComplete when amount is undefined', async () => {
      mockRepo.updatePayrollStatusTransaction.mockResolvedValue(undefined);

      await updatePayrollStatus('worklog-1', 'completed' as any);

      expect(trackSettlementComplete).not.toHaveBeenCalled();
    });

    it('should propagate errors via handleServiceError', async () => {
      const error = new Error('Transaction failed');
      mockRepo.updatePayrollStatusTransaction.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(updatePayrollStatus('worklog-1', 'completed' as any)).rejects.toThrow(
        'Transaction failed'
      );
      expect(mockHandleServiceError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // subscribeToWorkLog
  // ==========================================================================
  describe('subscribeToWorkLog', () => {
    it('should subscribe to work log via repository', () => {
      const mockUnsubscribe = jest.fn();
      mockRepo.subscribeById.mockReturnValue(mockUnsubscribe);
      const onUpdate = jest.fn();
      const onError = jest.fn();

      const unsubscribe = subscribeToWorkLog('worklog-1', {
        onUpdate,
        onError,
      });

      expect(mockRepo.subscribeById).toHaveBeenCalledWith(
        'worklog-1',
        expect.any(Function),
        expect.any(Function)
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call onUpdate callback with work log data', () => {
      const mockWorkLog = createMockWorkLogData();
      mockRepo.subscribeById.mockImplementation(
        (
          _id: string,
          onData: (workLog: WorkLog | null) => void,
          _onError: (error: Error) => void
        ) => {
          onData(mockWorkLog as unknown as WorkLog);
          return jest.fn();
        }
      );
      const onUpdate = jest.fn();

      subscribeToWorkLog('worklog-1', { onUpdate });

      expect(onUpdate).toHaveBeenCalledWith(mockWorkLog);
    });

    it('should call onUpdate with null when work log does not exist', () => {
      mockRepo.subscribeById.mockImplementation(
        (
          _id: string,
          onData: (workLog: WorkLog | null) => void,
          _onError: (error: Error) => void
        ) => {
          onData(null);
          return jest.fn();
        }
      );
      const onUpdate = jest.fn();

      subscribeToWorkLog('worklog-1', { onUpdate });

      expect(onUpdate).toHaveBeenCalledWith(null);
    });

    it('should call onError callback when error occurs', () => {
      const error = new Error('Subscription error');
      mockRepo.subscribeById.mockImplementation(
        (
          _id: string,
          _onData: (workLog: WorkLog | null) => void,
          onError: (error: Error) => void
        ) => {
          onError(error);
          return jest.fn();
        }
      );
      const onUpdate = jest.fn();
      const onError = jest.fn();
      mockHandleServiceError.mockReturnValue(error);

      subscribeToWorkLog('worklog-1', { onUpdate, onError });

      expect(onError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // subscribeToMyWorkLogs
  // ==========================================================================
  describe('subscribeToMyWorkLogs', () => {
    it('should subscribe to work logs list via repository', () => {
      const mockUnsubscribe = jest.fn();
      mockRepo.subscribeByStaffIdWithFilters.mockReturnValue(mockUnsubscribe);
      const onUpdate = jest.fn();

      const unsubscribe = subscribeToMyWorkLogs('staff-1', {
        onUpdate,
      });

      expect(mockRepo.subscribeByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-1',
        { dateRange: undefined, pageSize: 50 },
        expect.any(Function),
        expect.any(Function)
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('should pass date range and custom page size', () => {
      const mockUnsubscribe = jest.fn();
      mockRepo.subscribeByStaffIdWithFilters.mockReturnValue(mockUnsubscribe);
      const onUpdate = jest.fn();

      subscribeToMyWorkLogs('staff-1', {
        dateRange: { start: '2025-01-01', end: '2025-01-31' },
        pageSize: 25,
        onUpdate,
      });

      expect(mockRepo.subscribeByStaffIdWithFilters).toHaveBeenCalledWith(
        'staff-1',
        {
          dateRange: { start: '2025-01-01', end: '2025-01-31' },
          pageSize: 25,
        },
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should call onUpdate with work logs array', () => {
      const mockWorkLogs = [createMockWorkLogData(), createMockWorkLogData({ id: 'wl-2' })];
      mockRepo.subscribeByStaffIdWithFilters.mockImplementation(
        (
          _id: string,
          _opts: { dateRange?: { start: string; end: string }; pageSize?: number },
          onData: (workLogs: WorkLog[]) => void,
          _onError: (error: Error) => void
        ) => {
          onData(mockWorkLogs as unknown as WorkLog[]);
          return jest.fn();
        }
      );
      const onUpdate = jest.fn();

      subscribeToMyWorkLogs('staff-1', { onUpdate });

      expect(onUpdate).toHaveBeenCalledWith(mockWorkLogs);
    });

    it('should call onError when subscription error occurs', () => {
      const error = new Error('Subscription error');
      mockRepo.subscribeByStaffIdWithFilters.mockImplementation(
        (
          _id: string,
          _opts: { dateRange?: { start: string; end: string }; pageSize?: number },
          _onData: (workLogs: WorkLog[]) => void,
          onError: (error: Error) => void
        ) => {
          onError(error);
          return jest.fn();
        }
      );
      const onUpdate = jest.fn();
      const onError = jest.fn();
      mockHandleServiceError.mockReturnValue(error);

      subscribeToMyWorkLogs('staff-1', { onUpdate, onError });

      expect(onError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // subscribeToTodayWorkStatus
  // ==========================================================================
  describe('subscribeToTodayWorkStatus', () => {
    it('should subscribe to today work status via repository', () => {
      const mockUnsubscribe = jest.fn();
      mockRepo.subscribeTodayActive.mockReturnValue(mockUnsubscribe);
      const onUpdate = jest.fn();

      const unsubscribe = subscribeToTodayWorkStatus('staff-1', { onUpdate });

      expect(mockRepo.subscribeTodayActive).toHaveBeenCalledWith(
        'staff-1',
        '2025-01-15',
        ['confirmed', 'checked_in'],
        expect.any(Function),
        expect.any(Function)
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call onUpdate with work log when active log found', () => {
      const activeLog = createMockWorkLogData({ status: 'checked_in' });
      mockRepo.subscribeTodayActive.mockImplementation(
        (
          _staffId: string,
          _today: string,
          _statuses: string[],
          onData: (workLog: WorkLog | null) => void,
          _onError: (error: Error) => void
        ) => {
          onData(activeLog as unknown as WorkLog);
          return jest.fn();
        }
      );
      const onUpdate = jest.fn();

      subscribeToTodayWorkStatus('staff-1', { onUpdate });

      expect(onUpdate).toHaveBeenCalledWith(activeLog);
    });

    it('should call onUpdate with null when no active log', () => {
      mockRepo.subscribeTodayActive.mockImplementation(
        (
          _staffId: string,
          _today: string,
          _statuses: string[],
          onData: (workLog: WorkLog | null) => void,
          _onError: (error: Error) => void
        ) => {
          onData(null);
          return jest.fn();
        }
      );
      const onUpdate = jest.fn();

      subscribeToTodayWorkStatus('staff-1', { onUpdate });

      expect(onUpdate).toHaveBeenCalledWith(null);
    });

    it('should call onError when subscription error occurs', () => {
      const error = new Error('Today status error');
      mockRepo.subscribeTodayActive.mockImplementation(
        (
          _staffId: string,
          _today: string,
          _statuses: string[],
          _onData: (workLog: WorkLog | null) => void,
          onError: (error: Error) => void
        ) => {
          onError(error);
          return jest.fn();
        }
      );
      const onUpdate = jest.fn();
      const onError = jest.fn();
      mockHandleServiceError.mockReturnValue(error);

      subscribeToTodayWorkStatus('staff-1', { onUpdate, onError });

      expect(onError).toHaveBeenCalled();
    });
  });
});
