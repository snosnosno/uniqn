/**
 * UNIQN Mobile - WorkLogRepository 테스트
 *
 * @description Firebase WorkLog Repository 단위 테스트
 */

import { getDoc, getDocs, updateDoc, onSnapshot } from 'firebase/firestore';
import { FirebaseWorkLogRepository } from '../workLog';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/schemas', () => ({
  parseWorkLogDocument: jest.fn((data: Record<string, unknown>) => {
    if (!data || !data.id) return null;
    return data;
  }),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/utils/date', () => ({
  getTodayString: jest.fn(() => '2025-01-20'),
}));

jest.mock('@/shared/time', () => ({
  TimeNormalizer: {
    parseTime: jest.fn((time: unknown) => {
      if (!time) return null;
      if (time instanceof Date) return time;
      if (typeof time === 'string') return new Date(time);
      if (typeof time === 'object' && time !== null && 'toDate' in time) {
        return (time as { toDate: () => Date }).toDate();
      }
      return null;
    }),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error('서비스 에러');
  }),
}));

jest.mock('@/errors', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

// Mock QueryBuilder
jest.mock('@/utils/firestore/queryBuilder', () => {
  class MockQueryBuilder {
    constructor(_ref: unknown) {}
    whereEqual() {
      return this;
    }
    whereIf() {
      return this;
    }
    where() {
      return this;
    }
    orderBy() {
      return this;
    }
    orderByDesc() {
      return this;
    }
    orderByAsc() {
      return this;
    }
    limit() {
      return this;
    }
    build() {
      return { _query: true };
    }
  }
  return { QueryBuilder: MockQueryBuilder };
});

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    WORK_LOGS: 'workLogs',
    JOB_POSTINGS: 'jobPostings',
  },
  FIELDS: {
    WORK_LOG: {
      staffId: 'staffId',
      jobPostingId: 'jobPostingId',
      date: 'date',
      checkInTime: 'checkInTime',
      status: 'status',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  STATUS: {
    WORK_LOG: {
      SCHEDULED: 'scheduled',
      CHECKED_IN: 'checked_in',
      CHECKED_OUT: 'checked_out',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
    },
    PAYROLL: {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'completed',
    },
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function createMockDocSnap(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
    ref: { id, path: `workLogs/${id}` },
  };
}

function createMockQuerySnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const mockDocs = docs.map((d) => ({
    id: d.id,
    exists: () => true,
    data: () => d.data,
    ref: { id: d.id, path: `workLogs/${d.id}` },
  }));
  return {
    docs: mockDocs,
    empty: mockDocs.length === 0,
    size: mockDocs.length,
    forEach: (cb: (doc: (typeof mockDocs)[0]) => void) => mockDocs.forEach(cb),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('FirebaseWorkLogRepository', () => {
  let repository: FirebaseWorkLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseWorkLogRepository();
  });

  // ==========================================================================
  // getById
  // ==========================================================================
  describe('getById', () => {
    it('should return work log when document exists', async () => {
      const workLogData = {
        id: 'wl-1',
        staffId: 'staff-1',
        jobPostingId: 'job-1',
        date: '2025-01-20',
        status: 'scheduled',
      };

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('wl-1', workLogData));

      const result = await repository.getById('wl-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('wl-1');
      expect(result?.staffId).toBe('staff-1');
    });

    it('should return null when document does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('nonexistent', null));

      const result = await repository.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when parsing fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseWorkLogDocument } = require('@/schemas');
      parseWorkLogDocument.mockReturnValueOnce(null);

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('wl-1', { invalid: 'data' }));

      const result = await repository.getById('wl-1');

      expect(result).toBeNull();
    });

    it('should throw when Firebase getDoc fails', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Firebase error'));

      await expect(repository.getById('wl-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getByStaffId
  // ==========================================================================
  describe('getByStaffId', () => {
    it('should return work logs for the given staff', async () => {
      const workLogs = [
        {
          id: 'wl-1',
          data: { id: 'wl-1', staffId: 'staff-1', date: '2025-01-20', status: 'completed' },
        },
        {
          id: 'wl-2',
          data: { id: 'wl-2', staffId: 'staff-1', date: '2025-01-19', status: 'scheduled' },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(workLogs));

      const result = await repository.getByStaffId('staff-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no work logs found', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getByStaffId('staff-999');

      expect(result).toEqual([]);
    });

    it('should use custom page size', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      await repository.getByStaffId('staff-1', 10);

      // QueryBuilder was called so getDocs should have been called
      expect(getDocs).toHaveBeenCalledTimes(1);
    });

    it('should throw when getDocs fails', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      await expect(repository.getByStaffId('staff-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getByDate
  // ==========================================================================
  describe('getByDate', () => {
    it('should return work logs for the given date', async () => {
      const workLogs = [
        {
          id: 'wl-1',
          data: { id: 'wl-1', staffId: 'staff-1', date: '2025-01-20', status: 'scheduled' },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(workLogs));

      const result = await repository.getByDate('staff-1', '2025-01-20');

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no work logs exist for date', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getByDate('staff-1', '2025-12-31');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getByJobPostingId
  // ==========================================================================
  describe('getByJobPostingId', () => {
    it('should return work logs for the given job posting', async () => {
      const workLogs = [
        {
          id: 'wl-1',
          data: {
            id: 'wl-1',
            staffId: 'staff-1',
            jobPostingId: 'job-1',
            date: '2025-01-20',
            status: 'completed',
          },
        },
        {
          id: 'wl-2',
          data: {
            id: 'wl-2',
            staffId: 'staff-2',
            jobPostingId: 'job-1',
            date: '2025-01-20',
            status: 'checked_in',
          },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(workLogs));

      const result = await repository.getByJobPostingId('job-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no work logs found', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getByJobPostingId('job-999');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getTodayCheckedIn
  // ==========================================================================
  describe('getTodayCheckedIn', () => {
    it('should return today checked-in work log', async () => {
      const workLog = {
        id: 'wl-1',
        staffId: 'staff-1',
        date: '2025-01-20',
        status: 'checked_in',
        checkInTime: '2025-01-20T09:00:00Z',
      };

      (getDocs as jest.Mock).mockResolvedValue(
        createMockQuerySnap([{ id: 'wl-1', data: workLog }])
      );

      const result = await repository.getTodayCheckedIn('staff-1');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('checked_in');
    });

    it('should return null when no checked-in record exists', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getTodayCheckedIn('staff-1');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getByDateRange
  // ==========================================================================
  describe('getByDateRange', () => {
    it('should return work logs within the date range', async () => {
      const workLogs = [
        {
          id: 'wl-1',
          data: { id: 'wl-1', staffId: 'staff-1', date: '2025-01-15', status: 'completed' },
        },
        {
          id: 'wl-2',
          data: { id: 'wl-2', staffId: 'staff-1', date: '2025-01-18', status: 'completed' },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(workLogs));

      const result = await repository.getByDateRange('staff-1', '2025-01-01', '2025-01-31');

      expect(result).toHaveLength(2);
    });

    it('should return empty array for date range with no records', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getByDateRange('staff-1', '2024-01-01', '2024-01-31');

      expect(result).toEqual([]);
    });

    it('should throw when getDocs fails', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      await expect(
        repository.getByDateRange('staff-1', '2025-01-01', '2025-01-31')
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // findByJobPostingStaffDate
  // ==========================================================================
  describe('findByJobPostingStaffDate', () => {
    it('should return work log when matching record exists', async () => {
      const workLog = {
        id: 'wl-1',
        staffId: 'staff-1',
        jobPostingId: 'job-1',
        date: '2025-01-20',
        status: 'scheduled',
      };

      (getDocs as jest.Mock).mockResolvedValue(
        createMockQuerySnap([{ id: 'wl-1', data: workLog }])
      );

      const result = await repository.findByJobPostingStaffDate('job-1', 'staff-1', '2025-01-20');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('wl-1');
    });

    it('should return null when no matching record exists', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.findByJobPostingStaffDate('job-1', 'staff-1', '2025-12-31');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================
  describe('getStats', () => {
    it('should return correct stats for staff', async () => {
      const checkInDate = new Date('2025-01-20T09:00:00Z');
      const checkOutDate = new Date('2025-01-20T17:00:00Z');

      const workLogs = [
        {
          id: 'wl-1',
          data: {
            id: 'wl-1',
            staffId: 'staff-1',
            status: 'completed',
            checkInTime: checkInDate.toISOString(),
            checkOutTime: checkOutDate.toISOString(),
            payrollStatus: 'completed',
            payrollAmount: 150000,
          },
        },
        {
          id: 'wl-2',
          data: {
            id: 'wl-2',
            staffId: 'staff-1',
            status: 'completed',
            checkInTime: checkInDate.toISOString(),
            checkOutTime: checkOutDate.toISOString(),
            payrollStatus: 'pending',
            payrollAmount: 120000,
          },
        },
        {
          id: 'wl-3',
          data: {
            id: 'wl-3',
            staffId: 'staff-1',
            status: 'scheduled',
            checkInTime: null,
            checkOutTime: null,
            payrollStatus: 'pending',
            payrollAmount: 0,
          },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(workLogs));

      const stats = await repository.getStats('staff-1');

      expect(stats.totalWorkLogs).toBe(3);
      expect(stats.completedCount).toBe(2);
      expect(stats.completedPayroll).toBe(150000);
      expect(stats.pendingPayroll).toBe(120000);
      expect(stats.totalHoursWorked).toBeGreaterThan(0);
    });

    it('should return zero stats when no work logs exist', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const stats = await repository.getStats('staff-999');

      expect(stats.totalWorkLogs).toBe(0);
      expect(stats.completedCount).toBe(0);
      expect(stats.totalHoursWorked).toBe(0);
      expect(stats.averageHoursPerDay).toBe(0);
    });
  });

  // ==========================================================================
  // getMonthlyPayroll
  // ==========================================================================
  describe('getMonthlyPayroll', () => {
    it('should return monthly payroll summary', async () => {
      const workLogs = [
        {
          id: 'wl-1',
          data: {
            id: 'wl-1',
            staffId: 'staff-1',
            date: '2025-01-15',
            payrollStatus: 'completed',
            payrollAmount: 150000,
          },
        },
        {
          id: 'wl-2',
          data: {
            id: 'wl-2',
            staffId: 'staff-1',
            date: '2025-01-20',
            payrollStatus: 'pending',
            payrollAmount: 120000,
          },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(workLogs));

      const summary = await repository.getMonthlyPayroll('staff-1', 2025, 1);

      expect(summary.month).toBe('2025-01');
      expect(summary.workLogCount).toBe(2);
      expect(summary.totalAmount).toBe(270000);
      expect(summary.completedAmount).toBe(150000);
      expect(summary.pendingAmount).toBe(120000);
      expect(summary.workLogs).toHaveLength(2);
    });

    it('should return empty summary when no payroll records exist', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const summary = await repository.getMonthlyPayroll('staff-1', 2025, 6);

      expect(summary.month).toBe('2025-06');
      expect(summary.workLogCount).toBe(0);
      expect(summary.totalAmount).toBe(0);
      expect(summary.workLogs).toEqual([]);
    });

    it('should throw when getDocs fails', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      await expect(repository.getMonthlyPayroll('staff-1', 2025, 1)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // updatePayrollStatus
  // ==========================================================================
  describe('updatePayrollStatus', () => {
    it('should update payroll status to completed', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await repository.updatePayrollStatus('wl-1', 'completed');

      expect(updateDoc).toHaveBeenCalledTimes(1);
      const callArgs = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(callArgs.payrollStatus).toBe('completed');
      // payrollDate should be included when status is completed
      expect(callArgs.payrollDate).toBeDefined();
    });

    it('should update payroll status to pending without payrollDate', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await repository.updatePayrollStatus('wl-1', 'pending');

      expect(updateDoc).toHaveBeenCalledTimes(1);
      const callArgs = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(callArgs.payrollStatus).toBe('pending');
      expect(callArgs.payrollDate).toBeUndefined();
    });

    it('should throw when updateDoc fails', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await expect(repository.updatePayrollStatus('wl-1', 'completed')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // subscribeByDate
  // ==========================================================================
  describe('subscribeByDate', () => {
    it('should subscribe to work logs for a specific date', () => {
      const onData = jest.fn();
      const onError = jest.fn();

      const unsubscribe = repository.subscribeByDate('staff-1', '2025-01-20', onData, onError);

      expect(onSnapshot).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call onData with parsed work logs on snapshot', () => {
      const onData = jest.fn();
      const onError = jest.fn();

      const mockDocs = [
        {
          id: 'wl-1',
          data: () => ({
            id: 'wl-1',
            staffId: 'staff-1',
            date: '2025-01-20',
            status: 'checked_in',
          }),
        },
      ];

      (onSnapshot as jest.Mock).mockImplementation((_query, callback) => {
        callback({ docs: mockDocs });
        return jest.fn();
      });

      repository.subscribeByDate('staff-1', '2025-01-20', onData, onError);

      expect(onData).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'wl-1' })])
      );
    });
  });

  // ==========================================================================
  // subscribeByStaffId
  // ==========================================================================
  describe('subscribeByStaffId', () => {
    it('should subscribe to all work logs for a staff member', () => {
      const onData = jest.fn();
      const onError = jest.fn();

      const unsubscribe = repository.subscribeByStaffId('staff-1', onData, onError);

      expect(onSnapshot).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  // ==========================================================================
  // subscribeById
  // ==========================================================================
  describe('subscribeById', () => {
    it('should subscribe to a single work log document', () => {
      const onData = jest.fn();
      const onError = jest.fn();

      // onSnapshot for single doc
      (onSnapshot as jest.Mock).mockImplementation((_docRef, callback) => {
        callback({
          exists: () => true,
          id: 'wl-1',
          data: () => ({
            id: 'wl-1',
            staffId: 'staff-1',
            status: 'scheduled',
          }),
        });
        return jest.fn();
      });

      const unsubscribe = repository.subscribeById('wl-1', onData, onError);

      expect(onSnapshot).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
      expect(onData).toHaveBeenCalledWith(expect.objectContaining({ id: 'wl-1' }));
    });

    it('should call onData with null when document does not exist', () => {
      const onData = jest.fn();
      const onError = jest.fn();

      (onSnapshot as jest.Mock).mockImplementation((_docRef, callback) => {
        callback({
          exists: () => false,
          id: 'wl-missing',
          data: () => null,
        });
        return jest.fn();
      });

      repository.subscribeById('wl-missing', onData, onError);

      expect(onData).toHaveBeenCalledWith(null);
    });
  });

  // ==========================================================================
  // getByStaffIdWithFilters
  // ==========================================================================
  describe('getByStaffIdWithFilters', () => {
    it('should return filtered work logs', async () => {
      const workLogs = [
        {
          id: 'wl-1',
          data: { id: 'wl-1', staffId: 'staff-1', date: '2025-01-20', status: 'completed' },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(workLogs));

      const result = await repository.getByStaffIdWithFilters('staff-1', {
        dateRange: { start: '2025-01-01', end: '2025-01-31' },
        status: 'completed',
      });

      expect(result).toHaveLength(1);
    });

    it('should return all work logs when no filters provided', async () => {
      const workLogs = [
        {
          id: 'wl-1',
          data: { id: 'wl-1', staffId: 'staff-1', date: '2025-01-20', status: 'completed' },
        },
        {
          id: 'wl-2',
          data: { id: 'wl-2', staffId: 'staff-1', date: '2025-01-21', status: 'scheduled' },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(workLogs));

      const result = await repository.getByStaffIdWithFilters('staff-1');

      expect(result).toHaveLength(2);
    });
  });
});
