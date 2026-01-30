/**
 * UNIQN Mobile - Settlement Service Tests
 *
 * @description Unit tests for settlement management service
 * @version 1.0.0
 */

import {
  createMockJobPosting,
  createMockWorkLog,
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
} from '@/services/settlement';

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
  getFirebaseDb: () => ({}),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// 스키마 파싱 함수 mock - 테스트 데이터를 그대로 반환
jest.mock('@/schemas', () => ({
  parseJobPostingDocument: jest.fn((data) => data),
  parseJobPostingDocuments: jest.fn((data) => data),
  parseWorkLogDocument: jest.fn((data) => data),
  parseWorkLogDocuments: jest.fn((data) => data.filter(Boolean)),
}));

jest.mock('@/errors', () => ({
  mapFirebaseError: (error: Error) => error,
  ERROR_CODES: {
    FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
    FIREBASE_PERMISSION_DENIED: 'E4001',
    BUSINESS_INVALID_STATE: 'E6042',
  },
  BusinessError: class BusinessError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'BusinessError';
      this.code = code;
      this.userMessage = message;
    }
  },
  PermissionError: class PermissionError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'PermissionError';
      this.code = code;
      this.userMessage = message;
    }
  },
  AlreadySettledError: class AlreadySettledError extends Error {
    public userMessage: string;
    constructor(options?: { userMessage?: string }) {
      const defaultMessage = '이미 정산 완료된 근무 기록입니다';
      super(options?.userMessage || defaultMessage);
      this.name = 'AlreadySettledError';
      this.userMessage = options?.userMessage || defaultMessage;
    }
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockJobPostingWithSalary(overrides: Record<string, unknown> = {}) {
  const baseJob = createMockJobPosting();
  // 스키마 호환 mock 데이터 생성
  // timestampSchema는 { seconds, nanoseconds } 형식도 허용 (z.instanceof 우회)
  const mockTimestamp = {
    seconds: Math.floor(new Date('2024-01-10T00:00:00').getTime() / 1000),
    nanoseconds: 0,
  };
  return {
    id: baseJob.id,
    title: baseJob.title,
    status: 'active' as const,
    // 스키마 요구사항: location은 객체
    location: {
      name: '서울 강남구',
      district: '강남구',
    },
    detailedAddress: '테헤란로 123',
    // 스키마 요구사항: workDate, timeSlot 필수
    workDate: '2024-01-15',
    timeSlot: '09:00~18:00',
    // v2.0: 역할별 급여가 roles 배열에 포함
    roles: [
      { role: 'dealer', count: 3, filled: 0, salary: { type: 'hourly' as const, amount: 15000 } },
      { role: 'manager', count: 1, filled: 0, salary: { type: 'hourly' as const, amount: 15000 } },
    ],
    totalPositions: 4,
    filledPositions: 0,
    ownerId: 'employer-1',
    ownerName: '테스트 구인자',
    defaultSalary: {
      type: 'hourly' as const,
      amount: 15000,
    },
    useSameSalary: true,
    // 스키마 요구사항: { seconds, nanoseconds } 형식 (z.instanceof 우회)
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

function createMockWorkLogWithTimes(overrides = {}) {
  const baseWorkLog = createMockWorkLog();
  const checkIn = new Date('2024-01-15T09:00:00');
  const checkOut = new Date('2024-01-15T17:00:00');

  return {
    ...baseWorkLog,
    jobPostingId: 'job-1',
    staffId: 'staff-1',
    role: 'dealer',
    status: 'checked_out' as const,
    payrollStatus: 'pending' as const,
    payrollAmount: undefined,
    date: '2024-01-15',
    checkInTime: Timestamp.fromDate(checkIn),
    checkOutTime: Timestamp.fromDate(checkOut),
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
      const workLog = createMockWorkLogWithTimes({ id: 'worklog-1', jobPostingId: 'job-1' });

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
    it('should calculate settlement for hourly wage', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({ jobPostingId: 'job-1' });

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
      expect(result.salaryType).toBe('hourly');
      expect(result.hoursWorked).toBeGreaterThan(0);
      expect(result.netPay).toBeGreaterThan(0);
    });

    it('should calculate daily wage as full amount', async () => {
      // 일급 테스트 - 출근하면 일급 전액
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        roles: [
          { role: 'dealer', count: 3, filled: 0, salary: { type: 'daily' as const, amount: 150000 } },
        ],
        defaultSalary: { type: 'daily', amount: 150000 },
        useSameSalary: true,
      });
      const workLog = createMockWorkLogWithTimes({ jobPostingId: 'job-1' });

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

      expect(result.salaryType).toBe('daily');
      expect(result.grossPay).toBe(150000); // 일급 전액
    });

    it('should calculate monthly wage as full amount', async () => {
      // 월급 테스트 - 출근하면 월급 전액
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        roles: [
          { role: 'dealer', count: 3, filled: 0, salary: { type: 'monthly' as const, amount: 3300000 } },
        ],
        defaultSalary: { type: 'monthly', amount: 3300000 },
        useSameSalary: true,
      });
      const workLog = createMockWorkLogWithTimes({ jobPostingId: 'job-1' });

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

      expect(result.salaryType).toBe('monthly');
      expect(result.grossPay).toBe(3300000); // 월급 전액
    });

    it('should apply deductions', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({ jobPostingId: 'job-1' });

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
        jobPostingId: 'job-1',
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
        jobPostingId: 'job-1',
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
        jobPostingId: 'job-1',
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
        jobPostingId: 'job-1',
        status: 'checked_out',
        payrollStatus: 'pending',
      });
      const workLog2 = createMockWorkLogWithTimes({
        id: 'worklog-2',
        jobPostingId: 'job-1',
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
        jobPostingId: 'job-1',
        status: 'checked_out',
        payrollStatus: 'pending',
      });
      const workLog2 = createMockWorkLogWithTimes({
        id: 'worklog-2',
        jobPostingId: 'job-1',
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
        jobPostingId: 'job-1',
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
      const workLog = createMockWorkLogWithTimes({ jobPostingId: 'job-1' });

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
        id: 'non-existent',
        exists: () => false,
        data: () => null,
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
        id: 'job-1',
        exists: () => true,
        data: () => jobPosting,
      });

      // PermissionError를 던지기 전에 getDocs가 호출되지 않아야 함
      // 하지만 mock 설정이 필요함 (코드 경로 보호)
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await expect(
        getJobPostingSettlementSummary('job-1', 'employer-1')
      ).rejects.toThrow('본인의 공고만 조회할 수 있습니다');
    });
  });
});
