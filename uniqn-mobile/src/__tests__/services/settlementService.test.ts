/**
 * UNIQN Mobile - Settlement Service Tests
 *
 * @description Unit tests for settlement management service
 * @version 2.0.0 - Repository 패턴 기반
 */

import { createMockJobPosting, createMockWorkLog, resetCounters } from '../mocks/factories';

// ============================================================================
// Mock Repository
// ============================================================================

const mockJobPostingGetById = jest.fn();
const mockJobPostingGetByOwnerId = jest.fn();
const mockWorkLogGetById = jest.fn();
const mockWorkLogGetByJobPostingId = jest.fn();
const mockSettleWorkLogWithTransaction = jest.fn();
const mockBulkSettlementWithTransaction = jest.fn();
const mockUpdatePayrollStatusWithTransaction = jest.fn();
const mockUpdateWorkTimeWithTransaction = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getById: (...args: unknown[]) => mockJobPostingGetById(...args),
    getByOwnerId: (...args: unknown[]) => mockJobPostingGetByOwnerId(...args),
  },
  workLogRepository: {
    getById: (...args: unknown[]) => mockWorkLogGetById(...args),
    getByJobPostingId: (...args: unknown[]) => mockWorkLogGetByJobPostingId(...args),
  },
  settlementRepository: {
    settleWorkLogWithTransaction: (...args: unknown[]) => mockSettleWorkLogWithTransaction(...args),
    bulkSettlementWithTransaction: (...args: unknown[]) =>
      mockBulkSettlementWithTransaction(...args),
    updatePayrollStatusWithTransaction: (...args: unknown[]) =>
      mockUpdatePayrollStatusWithTransaction(...args),
    updateWorkTimeWithTransaction: (...args: unknown[]) =>
      mockUpdateWorkTimeWithTransaction(...args),
  },
}));

// ============================================================================
// Mock Dependencies
// ============================================================================

jest.mock('@/lib/firebase', () => ({
  db: {},
  getFirebaseDb: () => ({}),
}));

jest.mock('firebase/firestore', () => {
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
    Timestamp: MockTimestampClass,
    serverTimestamp: () => ({ _serverTimestamp: true }),
  };
});

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
  handleErrorWithDefault: jest.fn((_error: unknown, defaultValue: unknown) => defaultValue),
}));

jest.mock('@/errors', () => {
  class BusinessError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'BusinessError';
      this.code = code;
      this.userMessage = message;
    }
  }
  class PermissionError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'PermissionError';
      this.code = code;
      this.userMessage = message;
    }
  }
  class ValidationError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'ValidationError';
      this.code = code;
      this.userMessage = message;
    }
  }
  class AlreadySettledError extends Error {
    public userMessage: string;
    constructor(options?: { userMessage?: string }) {
      const defaultMessage = '이미 정산 완료된 근무 기록입니다';
      super(options?.userMessage || defaultMessage);
      this.name = 'AlreadySettledError';
      this.userMessage = options?.userMessage || defaultMessage;
    }
  }
  return {
    mapFirebaseError: (error: Error) => error,
    isAppError: (error: unknown) =>
      error instanceof BusinessError ||
      error instanceof PermissionError ||
      error instanceof ValidationError ||
      error instanceof AlreadySettledError,
    ERROR_CODES: {
      FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
      FIREBASE_PERMISSION_DENIED: 'E4001',
      BUSINESS_INVALID_STATE: 'E6042',
      VALIDATION_FORMAT: 'E3002',
    },
    BusinessError,
    PermissionError,
    ValidationError,
    AlreadySettledError,
  };
});

jest.mock('@/constants', () => ({
  STATUS: {
    WORK_LOG: {
      CHECKED_IN: 'checked_in',
      CHECKED_OUT: 'checked_out',
      COMPLETED: 'completed',
      NO_SHOW: 'no_show',
    },
    PAYROLL: {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'completed',
    },
  },
}));

// Mock the SettlementCalculator used by query/calculation modules
jest.mock('@/domains/settlement', () => ({
  SettlementCalculator: {
    calculate: jest.fn(
      (input: {
        startTime: unknown;
        endTime: unknown;
        salaryInfo: { type: string; amount: number };
      }) => {
        // Simple mock calculation
        const hourlyRate = input.salaryInfo?.amount || 15000;
        const salaryType = input.salaryInfo?.type || 'hourly';

        if (salaryType === 'daily') {
          return {
            hoursWorked: 8,
            totalPay: hourlyRate,
            afterTaxPay: hourlyRate,
          };
        }

        if (salaryType === 'monthly') {
          return {
            hoursWorked: 8,
            totalPay: hourlyRate,
            afterTaxPay: hourlyRate,
          };
        }

        // hourly
        const hoursWorked = 8;
        return {
          hoursWorked,
          totalPay: hourlyRate * hoursWorked,
          afterTaxPay: hourlyRate * hoursWorked,
        };
      }
    ),
  },
}));

jest.mock('@/utils/settlement', () => ({
  getEffectiveSalaryInfoFromRoles: jest.fn(
    (_workLog: unknown, _roles: unknown, defaultSalary: { type: string; amount: number }) =>
      defaultSalary || { type: 'hourly', amount: 15000 }
  ),
  getEffectiveAllowances: jest.fn(() => undefined),
  getEffectiveTaxSettings: jest.fn(() => undefined),
}));

jest.mock('@/shared/id', () => ({
  IdNormalizer: {
    normalizeJobId: jest.fn((workLog: { jobPostingId: string }) => workLog.jobPostingId),
  },
}));

jest.mock('@/shared/time', () => ({
  TimeNormalizer: {
    parseTime: jest.fn(() => new Date()),
  },
}));

// Import after mocks
import { Timestamp } from 'firebase/firestore';

import {
  getWorkLogsByJobPosting,
  calculateSettlement,
  settleWorkLog,
  bulkSettlement,
  updateSettlementStatus,
  getJobPostingSettlementSummary,
} from '@/services/settlement';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockJobPostingWithSalary(overrides: Record<string, unknown> = {}) {
  const baseJob = createMockJobPosting();
  return {
    id: baseJob.id,
    title: baseJob.title,
    status: 'active' as const,
    location: {
      name: '서울 강남구',
      district: '강남구',
    },
    detailedAddress: '테헤란로 123',
    workDate: '2024-01-15',
    timeSlot: '09:00~18:00',
    roles: [
      { role: 'dealer', count: 3, filled: 0, salary: { type: 'hourly' as const, amount: 15000 } },
      {
        role: 'manager',
        count: 1,
        filled: 0,
        salary: { type: 'hourly' as const, amount: 15000 },
      },
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
  });

  // ==========================================================================
  // getWorkLogsByJobPosting
  // ==========================================================================

  describe('getWorkLogsByJobPosting', () => {
    it('should return work logs for a job posting', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({ id: 'worklog-1', jobPostingId: 'job-1' });

      mockJobPostingGetById.mockResolvedValue(jobPosting);
      mockWorkLogGetByJobPostingId.mockResolvedValue([workLog]);

      const result = await getWorkLogsByJobPosting('job-1', 'employer-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('worklog-1');
      expect(result[0].hoursWorked).toBeDefined();
      expect(result[0].calculatedAmount).toBeDefined();
    });

    it('should throw error for non-existent job posting', async () => {
      mockJobPostingGetById.mockResolvedValue(null);

      await expect(getWorkLogsByJobPosting('non-existent', 'employer-1')).rejects.toThrow(
        '존재하지 않는 공고입니다'
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        ownerId: 'other-employer',
      });

      mockJobPostingGetById.mockResolvedValue(jobPosting);

      await expect(getWorkLogsByJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '본인의 공고만 조회할 수 있습니다'
      );
    });

    it('should filter by date range', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog1 = createMockWorkLogWithTimes({ id: 'worklog-1', date: '2024-01-10' });
      const workLog2 = createMockWorkLogWithTimes({ id: 'worklog-2', date: '2024-01-15' });
      const workLog3 = createMockWorkLogWithTimes({ id: 'worklog-3', date: '2024-01-20' });

      mockJobPostingGetById.mockResolvedValue(jobPosting);
      mockWorkLogGetByJobPostingId.mockResolvedValue([workLog1, workLog2, workLog3]);

      const result = await getWorkLogsByJobPosting('job-1', 'employer-1', {
        dateRange: { start: '2024-01-12', end: '2024-01-18' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('worklog-2');
    });

    it('should filter by payroll status', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog1 = createMockWorkLogWithTimes({ id: 'worklog-1', payrollStatus: 'pending' });
      const workLog2 = createMockWorkLogWithTimes({
        id: 'worklog-2',
        payrollStatus: 'completed',
      });

      mockJobPostingGetById.mockResolvedValue(jobPosting);
      mockWorkLogGetByJobPostingId.mockResolvedValue([workLog1, workLog2]);

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
      const workLog = createMockWorkLogWithTimes({ id: 'worklog-1', jobPostingId: 'job-1' });

      mockWorkLogGetById.mockResolvedValue(workLog);
      mockJobPostingGetById.mockResolvedValue(jobPosting);

      const result = await calculateSettlement({ workLogId: 'worklog-1' }, 'employer-1');

      expect(result.workLogId).toBe('worklog-1');
      expect(result.salaryType).toBe('hourly');
      expect(result.hoursWorked).toBeGreaterThan(0);
      expect(result.netPay).toBeGreaterThan(0);
    });

    it('should calculate daily wage as full amount', async () => {
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        roles: [
          {
            role: 'dealer',
            count: 3,
            filled: 0,
            salary: { type: 'daily' as const, amount: 150000 },
          },
        ],
        defaultSalary: { type: 'daily', amount: 150000 },
        useSameSalary: true,
      });
      const workLog = createMockWorkLogWithTimes({ id: 'worklog-1', jobPostingId: 'job-1' });

      mockWorkLogGetById.mockResolvedValue(workLog);
      mockJobPostingGetById.mockResolvedValue(jobPosting);

      const result = await calculateSettlement({ workLogId: 'worklog-1' }, 'employer-1');

      expect(result.salaryType).toBe('daily');
      expect(result.grossPay).toBe(150000); // 일급 전액
    });

    it('should calculate monthly wage as full amount', async () => {
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        roles: [
          {
            role: 'dealer',
            count: 3,
            filled: 0,
            salary: { type: 'monthly' as const, amount: 3300000 },
          },
        ],
        defaultSalary: { type: 'monthly', amount: 3300000 },
        useSameSalary: true,
      });
      const workLog = createMockWorkLogWithTimes({ id: 'worklog-1', jobPostingId: 'job-1' });

      mockWorkLogGetById.mockResolvedValue(workLog);
      mockJobPostingGetById.mockResolvedValue(jobPosting);

      const result = await calculateSettlement({ workLogId: 'worklog-1' }, 'employer-1');

      expect(result.salaryType).toBe('monthly');
      expect(result.grossPay).toBe(3300000); // 월급 전액
    });

    it('should apply deductions', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const workLog = createMockWorkLogWithTimes({ id: 'worklog-1', jobPostingId: 'job-1' });

      mockWorkLogGetById.mockResolvedValue(workLog);
      mockJobPostingGetById.mockResolvedValue(jobPosting);

      const result = await calculateSettlement(
        { workLogId: 'worklog-1', deductions: 10000 },
        'employer-1'
      );

      expect(result.deductions).toBe(10000);
      expect(result.netPay).toBe(result.grossPay - 10000);
    });

    it('should throw error for non-existent work log', async () => {
      mockWorkLogGetById.mockResolvedValue(null);

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
      mockSettleWorkLogWithTransaction.mockResolvedValue({
        success: true,
        workLogId: 'worklog-1',
        amount: 120000,
        message: '정산이 완료되었습니다',
      });

      const result = await settleWorkLog({ workLogId: 'worklog-1', amount: 120000 }, 'employer-1');

      expect(result.success).toBe(true);
      expect(result.amount).toBe(120000);
      expect(result.message).toBe('정산이 완료되었습니다');
    });

    it('should fail for non-checked-out work log', async () => {
      mockSettleWorkLogWithTransaction.mockResolvedValue({
        success: false,
        workLogId: 'worklog-1',
        amount: 0,
        message: '출퇴근이 완료된 근무 기록만 정산 가능합니다',
      });

      const result = await settleWorkLog({ workLogId: 'worklog-1', amount: 120000 }, 'employer-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('출퇴근이 완료된 근무 기록만');
    });

    it('should fail for already settled work log', async () => {
      mockSettleWorkLogWithTransaction.mockResolvedValue({
        success: false,
        workLogId: 'worklog-1',
        amount: 0,
        message: '이미 정산 완료된 근무 기록입니다',
      });

      const result = await settleWorkLog({ workLogId: 'worklog-1', amount: 120000 }, 'employer-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('이미 정산 완료된');
    });
  });

  // ==========================================================================
  // bulkSettlement
  // ==========================================================================

  describe('bulkSettlement', () => {
    it('should settle multiple work logs', async () => {
      mockBulkSettlementWithTransaction.mockResolvedValue({
        totalCount: 2,
        successCount: 2,
        failedCount: 0,
        totalAmount: 240000,
        results: [
          { success: true, workLogId: 'worklog-1', amount: 120000, message: '정산 완료' },
          { success: true, workLogId: 'worklog-2', amount: 120000, message: '정산 완료' },
        ],
      });

      const result = await bulkSettlement({ workLogIds: ['worklog-1', 'worklog-2'] }, 'employer-1');

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBeGreaterThanOrEqual(0);
      expect(result.failedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed success and failure', async () => {
      mockBulkSettlementWithTransaction.mockResolvedValue({
        totalCount: 2,
        successCount: 1,
        failedCount: 1,
        totalAmount: 120000,
        results: [
          { success: true, workLogId: 'worklog-1', amount: 120000, message: '정산 완료' },
          {
            success: false,
            workLogId: 'worklog-2',
            amount: 0,
            message: '이미 정산 완료된 근무 기록입니다',
          },
        ],
      });

      const result = await bulkSettlement({ workLogIds: ['worklog-1', 'worklog-2'] }, 'employer-1');

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
      mockUpdatePayrollStatusWithTransaction.mockResolvedValue(undefined);

      await expect(
        updateSettlementStatus('worklog-1', 'processing', 'employer-1')
      ).resolves.not.toThrow();

      expect(mockUpdatePayrollStatusWithTransaction).toHaveBeenCalledWith(
        'worklog-1',
        'processing',
        'employer-1'
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockUpdatePayrollStatusWithTransaction.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고에 대한 정산만 처리할 수 있습니다',
        })
      );

      await expect(updateSettlementStatus('worklog-1', 'completed', 'employer-1')).rejects.toThrow(
        '본인의 공고에 대한 정산만 처리할 수 있습니다'
      );
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

      mockJobPostingGetById.mockResolvedValue(jobPosting);
      mockWorkLogGetByJobPostingId.mockResolvedValue([workLog1, workLog2]);

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
      mockJobPostingGetById.mockResolvedValue(null);

      await expect(getJobPostingSettlementSummary('non-existent', 'employer-1')).rejects.toThrow(
        '존재하지 않는 공고입니다'
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingWithSalary({
        id: 'job-1',
        ownerId: 'other-employer',
      });

      mockJobPostingGetById.mockResolvedValue(jobPosting);

      await expect(getJobPostingSettlementSummary('job-1', 'employer-1')).rejects.toThrow(
        '본인의 공고만 조회할 수 있습니다'
      );
    });
  });
});
