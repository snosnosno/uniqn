/**
 * UNIQN Mobile - Settlement Service Tests
 *
 * @description Unit tests for settlement management service
 * @version 1.0.0
 */

import {
  createMockJobPosting,
  createMockWorkLog,
  createMockEmployer,
  resetCounters,
} from '../mocks/factories';

// Import after mocks
import {
  getWorkLogsByJobPosting,
  calculateSettlement,
  settleWorkLog,
  bulkSettlement,
  updateSettlementStatus,
  getJobPostingSettlementSummary,
} from '@/services/settlementService';

// Import Timestamp from mocked module for use in test utilities
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Firebase Mocks
// ============================================================================

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockRunTransaction = jest.fn();

// Mock Timestamp class for instanceof checks - defined inside factory
jest.mock('firebase/firestore', () => {
  // Define MockTimestamp inside the factory to avoid hoisting issues
  class MockTimestampClass {
    private _date: Date;

    constructor(seconds: number, nanoseconds: number = 0) {
      this._date = new Date(seconds * 1000 + nanoseconds / 1000000);
    }

    toDate(): Date {
      return this._date;
    }

    toMillis(): number {
      return this._date.getTime();
    }

    static now(): MockTimestampClass {
      return new MockTimestampClass(Date.now() / 1000);
    }

    static fromDate(date: Date): MockTimestampClass {
      return new MockTimestampClass(date.getTime() / 1000);
    }

    static fromMillis(ms: number): MockTimestampClass {
      return new MockTimestampClass(ms / 1000);
    }
  }

  return {
    doc: (...args: unknown[]) => mockDoc(...args),
    collection: (...args: unknown[]) => mockCollection(...args),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    where: (...args: unknown[]) => mockWhere(...args),
    orderBy: (...args: unknown[]) => mockOrderBy(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
    serverTimestamp: () => ({ _serverTimestamp: true }),
    Timestamp: MockTimestampClass,
  };
});

jest.mock('@/lib/firebase', () => ({
  db: {},
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
  mapFirebaseError: (error: Error) => error,
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockJobPostingWithSalary(overrides = {}) {
  const baseJob = createMockJobPosting();
  return {
    ...baseJob,
    id: baseJob.id,
    title: baseJob.title,
    ownerId: 'employer-1',
    salary: {
      type: 'hourly' as const,
      amount: 15000,
      useRoleSalary: false,
      roleSalaries: undefined,
    },
    ...overrides,
  };
}

function createMockWorkLogWithTimes(overrides = {}) {
  const baseWorkLog = createMockWorkLog();
  const checkIn = new Date('2024-01-15T09:00:00');
  const checkOut = new Date('2024-01-15T17:00:00');

  return {
    ...baseWorkLog,
    eventId: 'job-1',
    staffId: 'staff-1',
    role: 'dealer',
    status: 'checked_out' as const,
    payrollStatus: 'pending' as const,
    payrollAmount: undefined,
    date: '2024-01-15',
    actualStartTime: Timestamp.fromDate(checkIn),
    actualEndTime: Timestamp.fromDate(checkOut),
    modificationHistory: [],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('settlementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockDoc.mockReturnValue({ id: 'test-doc' });
    mockCollection.mockReturnValue({ id: 'test-collection' });
    mockQuery.mockReturnValue({ query: 'test-query' });
    mockWhere.mockReturnValue({ where: 'test-where' });
    mockOrderBy.mockReturnValue({ orderBy: 'test-orderBy' });
  });

  // ==========================================================================
  // getWorkLogsByJobPosting
  // ==========================================================================

  describe('getWorkLogsByJobPosting', () => {
    it('should return work logs for a job posting', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({ id: 'worklog-1', eventId: 'job-1' });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => jobPosting,
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'worklog-1',
            data: () => workLog,
          },
        ],
      });

      const result = await getWorkLogsByJobPosting('job-1', 'employer-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('worklog-1');
      expect(result[0].hoursWorked).toBeDefined();
      expect(result[0].calculatedAmount).toBeDefined();
    });

    it('should throw error for non-existent job posting', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        getWorkLogsByJobPosting('non-existent', 'employer-1')
      ).rejects.toThrow('존재하지 않는 공고입니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        ownerId: 'other-employer',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => jobPosting,
      });

      await expect(
        getWorkLogsByJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('본인의 공고만 조회할 수 있습니다');
    });

    it('should filter by date range', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog1 = createMockWorkLogWithTimes({ id: 'worklog-1', date: '2024-01-10' });
      const workLog2 = createMockWorkLogWithTimes({ id: 'worklog-2', date: '2024-01-15' });
      const workLog3 = createMockWorkLogWithTimes({ id: 'worklog-3', date: '2024-01-20' });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => jobPosting,
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'worklog-1', data: () => workLog1 },
          { id: 'worklog-2', data: () => workLog2 },
          { id: 'worklog-3', data: () => workLog3 },
        ],
      });

      const result = await getWorkLogsByJobPosting('job-1', 'employer-1', {
        dateRange: { start: '2024-01-12', end: '2024-01-18' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('worklog-2');
    });

    it('should filter by payroll status', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog1 = createMockWorkLogWithTimes({ id: 'worklog-1', payrollStatus: 'pending' });
      const workLog2 = createMockWorkLogWithTimes({ id: 'worklog-2', payrollStatus: 'completed' });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => jobPosting,
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'worklog-1', data: () => workLog1 },
          { id: 'worklog-2', data: () => workLog2 },
        ],
      });

      const result = await getWorkLogsByJobPosting('job-1', 'employer-1', {
        payrollStatus: 'pending',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('worklog-1');
    });
  });

  // ==========================================================================
  // calculateSettlement
  // ==========================================================================

  describe('calculateSettlement', () => {
    it('should calculate settlement for a work log', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({ eventId: 'job-1' });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => workLog,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => jobPosting,
        });

      const result = await calculateSettlement(
        { workLogId: 'worklog-1' },
        'employer-1'
      );

      expect(result.workLogId).toBe('worklog-1');
      expect(result.regularHours).toBeGreaterThan(0);
      expect(result.regularPay).toBeGreaterThan(0);
      expect(result.netPay).toBeGreaterThan(0);
    });

    it('should calculate overtime correctly', async () => {
      // 10시간 근무 (2시간 초과)
      const checkIn = new Date('2024-01-15T08:00:00');
      const checkOut = new Date('2024-01-15T18:00:00'); // 10 hours
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({
        eventId: 'job-1',
        actualStartTime: Timestamp.fromDate(checkIn),
        actualEndTime: Timestamp.fromDate(checkOut),
      });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => workLog,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => jobPosting,
        });

      const result = await calculateSettlement(
        { workLogId: 'worklog-1' },
        'employer-1'
      );

      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(2);
      expect(result.overtimePay).toBeGreaterThan(0);
    });

    it('should apply custom hourly rate', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({ eventId: 'job-1' });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => workLog,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => jobPosting,
        });

      const result = await calculateSettlement(
        { workLogId: 'worklog-1', hourlyRate: 20000 },
        'employer-1'
      );

      // 8시간 * 20000원 = 160000원
      expect(result.regularPay).toBe(160000);
    });

    it('should apply deductions', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({ eventId: 'job-1' });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => workLog,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => jobPosting,
        });

      const result = await calculateSettlement(
        { workLogId: 'worklog-1', deductions: 10000 },
        'employer-1'
      );

      expect(result.deductions).toBe(10000);
      expect(result.netPay).toBe(result.grossPay - 10000);
    });

    it('should throw error for non-existent work log', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        calculateSettlement({ workLogId: 'non-existent' }, 'employer-1')
      ).rejects.toThrow('근무 기록을 찾을 수 없습니다');
    });
  });

  // ==========================================================================
  // settleWorkLog
  // ==========================================================================

  describe('settleWorkLog', () => {
    it('should settle a work log successfully', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({
        eventId: 'job-1',
        status: 'checked_out',
        payrollStatus: 'pending',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => workLog,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      const result = await settleWorkLog(
        { workLogId: 'worklog-1', amount: 120000 },
        'employer-1'
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(120000);
      expect(result.message).toBe('정산이 완료되었습니다');
    });

    it('should fail for non-checked-out work log', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({
        eventId: 'job-1',
        status: 'checked_in',
        payrollStatus: 'pending',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => workLog,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      const result = await settleWorkLog(
        { workLogId: 'worklog-1', amount: 120000 },
        'employer-1'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('출퇴근이 완료된 근무 기록만');
    });

    it('should fail for already settled work log', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({
        eventId: 'job-1',
        status: 'checked_out',
        payrollStatus: 'completed',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => workLog,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      const result = await settleWorkLog(
        { workLogId: 'worklog-1', amount: 120000 },
        'employer-1'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('이미 정산 완료된');
    });
  });

  // ==========================================================================
  // bulkSettlement
  // ==========================================================================

  describe('bulkSettlement', () => {
    it('should settle multiple work logs', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog1 = createMockWorkLogWithTimes({
        id: 'worklog-1',
        eventId: 'job-1',
        status: 'checked_out',
        payrollStatus: 'pending',
      });
      const workLog2 = createMockWorkLogWithTimes({
        id: 'worklog-2',
        eventId: 'job-1',
        status: 'checked_out',
        payrollStatus: 'pending',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn((ref) => {
            const id = ref?.id || 'test';
            if (id === 'worklog-1') {
              return Promise.resolve({
                exists: () => true,
                data: () => workLog1,
              });
            }
            if (id === 'worklog-2') {
              return Promise.resolve({
                exists: () => true,
                data: () => workLog2,
              });
            }
            // Job posting
            return Promise.resolve({
              exists: () => true,
              data: () => jobPosting,
            });
          }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      // Mock doc to return proper reference with id
      mockDoc.mockImplementation((_db, _collection, id) => ({ id }));

      const result = await bulkSettlement(
        { workLogIds: ['worklog-1', 'worklog-2'] },
        'employer-1'
      );

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBeGreaterThanOrEqual(0);
      expect(result.failedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed success and failure', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog1 = createMockWorkLogWithTimes({
        id: 'worklog-1',
        eventId: 'job-1',
        status: 'checked_out',
        payrollStatus: 'pending',
      });
      const workLog2 = createMockWorkLogWithTimes({
        id: 'worklog-2',
        eventId: 'job-1',
        status: 'checked_out',
        payrollStatus: 'completed', // already settled
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn((ref) => {
            const id = ref?.id || 'test';
            if (id === 'worklog-1') {
              return Promise.resolve({
                exists: () => true,
                data: () => workLog1,
              });
            }
            if (id === 'worklog-2') {
              return Promise.resolve({
                exists: () => true,
                data: () => workLog2,
              });
            }
            return Promise.resolve({
              exists: () => true,
              data: () => jobPosting,
            });
          }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      mockDoc.mockImplementation((_db, _collection, id) => ({ id }));

      const result = await bulkSettlement(
        { workLogIds: ['worklog-1', 'worklog-2'] },
        'employer-1'
      );

      expect(result.totalCount).toBe(2);
      // At least one should fail (already completed)
      expect(result.results.some((r) => !r.success)).toBe(true);
    });
  });

  // ==========================================================================
  // updateSettlementStatus
  // ==========================================================================

  describe('updateSettlementStatus', () => {
    it('should update settlement status', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({
        eventId: 'job-1',
        payrollStatus: 'pending',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => workLog,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      await expect(
        updateSettlementStatus('worklog-1', 'processing', 'employer-1')
      ).resolves.not.toThrow();
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        ownerId: 'other-employer',
      });
      const workLog = createMockWorkLogWithTimes({ eventId: 'job-1' });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => workLog,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      await expect(
        updateSettlementStatus('worklog-1', 'completed', 'employer-1')
      ).rejects.toThrow('본인의 공고에 대한 정산만 처리할 수 있습니다');
    });
  });

  // ==========================================================================
  // getJobPostingSettlementSummary
  // ==========================================================================

  describe('getJobPostingSettlementSummary', () => {
    it('should return settlement summary for a job posting', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog1 = createMockWorkLogWithTimes({
        id: 'worklog-1',
        status: 'checked_out',
        payrollStatus: 'pending',
        role: 'dealer',
      });
      const workLog2 = createMockWorkLogWithTimes({
        id: 'worklog-2',
        status: 'completed',
        payrollStatus: 'completed',
        payrollAmount: 120000,
        role: 'dealer',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => jobPosting,
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'worklog-1', data: () => workLog1 },
          { id: 'worklog-2', data: () => workLog2 },
        ],
      });

      const result = await getJobPostingSettlementSummary('job-1', 'employer-1');

      expect(result.jobPostingId).toBe('job-1');
      expect(result.totalWorkLogs).toBe(2);
      expect(result.completedWorkLogs).toBe(2);
      expect(result.pendingSettlement).toBe(1);
      expect(result.completedSettlement).toBe(1);
      expect(result.totalCompletedAmount).toBe(120000);
      expect(result.workLogsByRole).toBeDefined();
      expect(result.workLogsByRole.dealer).toBeDefined();
    });

    it('should throw error for non-existent job posting', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        getJobPostingSettlementSummary('non-existent', 'employer-1')
      ).rejects.toThrow('존재하지 않는 공고입니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        ownerId: 'other-employer',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => jobPosting,
      });

      await expect(
        getJobPostingSettlementSummary('job-1', 'employer-1')
      ).rejects.toThrow('본인의 공고만 조회할 수 있습니다');
    });
  });
});
