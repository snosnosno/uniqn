/**
 * UNIQN Mobile - Settlement Service Tests
 *
 * @description Unit tests for settlement management service
 * @version 2.0.0 - Repository 패턴 기반
 */

import {
  createMockJobPosting,
  createMockWorkLog,
  resetCounters,
} from '../../../__tests__/mocks/factories';

// Import after mocks

import {
  getWorkLogsByJobPosting,
  calculateSettlement,
  settleWorkLog,
  bulkSettlement,
  updateSettlementStatus,
  getJobPostingSettlementSummary,
} from '@/services/work/settlement';
import type { Allowances, SalaryInfo } from '@/types';

// ============================================================================
// Mock Repository
// ============================================================================

const mockJobPostingGetById = jest.fn();
const mockJobPostingGetByOwnerId = jest.fn();
const mockJobPostingGetManagedJobPostings = jest.fn();
const mockWorkLogGetById = jest.fn();
const mockWorkLogGetByJobPostingId = jest.fn();
const mockSettleWorkLogWithTransaction = jest.fn();
const mockBulkSettlementWithTransaction = jest.fn();
const mockUpdatePayrollStatusWithTransaction = jest.fn();
const mockUpdateWorkTimeWithTransaction = jest.fn();
const mockLoadAndVerifyJobPostingAccess = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getById: (...args: unknown[]) => mockJobPostingGetById(...args),
    getByOwnerId: (...args: unknown[]) => mockJobPostingGetByOwnerId(...args),
    getManagedJobPostings: (...args: unknown[]) => mockJobPostingGetManagedJobPostings(...args),
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

// P0 hotfix (PR #76) 후속: settlementQuery 가 ApplicationRepositoryHelpers 사용.
// 기존 테스트는 mockJobPostingGetById + ownerId 비교 패턴으로 작성됐으므로
// loadAndVerifyJobPostingAccess mock 이 그 동작을 mirror 하도록 shim.
jest.mock('@/repositories/supabase/ApplicationRepositoryHelpers', () => ({
  loadAndVerifyJobPostingAccess: (...args: unknown[]) => mockLoadAndVerifyJobPostingAccess(...args),
}));

// ============================================================================
// Mock Dependencies
// ============================================================================

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

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
    isAppError: (error: unknown) =>
      error instanceof BusinessError ||
      error instanceof PermissionError ||
      error instanceof ValidationError ||
      error instanceof AlreadySettledError,
    ERROR_CODES: {
      INFRA_NOT_FOUND: 'E4002',
      INFRA_PERMISSION_DENIED: 'E4001',
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
      CANCELLED: 'cancelled',
      NO_SHOW: 'no_show',
    },
    PAYROLL: {
      PENDING: 'pending',
      PROCESSING: 'processing',
      COMPLETED: 'completed',
    },
    // P0 hotfix (PR #76) 후속: settlementQuery.ts → ApplicationRepositoryHelpers.ts 가
    // STATUS.APPLICATION 의존 → transitive import 시 mock 누락으로 TypeError 회귀.
    APPLICATION: {
      APPLIED: 'applied',
      CONFIRMED: 'confirmed',
      CANCELLED: 'cancelled',
      CANCELLATION_PENDING: 'cancellation_pending',
      REJECTED: 'rejected',
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
  ...jest.requireActual('@/shared/time'),
  TimeNormalizer: {
    parseTime: jest.fn(() => new Date()),
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createLegacyMockJobPostingWithSalary(overrides: Record<string, unknown> = {}) {
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

function createMockJobPostingWithSalary(overrides: Record<string, unknown> = {}) {
  const legacyJob = createLegacyMockJobPostingWithSalary(overrides) as Record<string, unknown> & {
    roles?: {
      role: string;
      customRole?: string;
      count: number;
      filled?: number;
      salary?: SalaryInfo;
    }[];
    defaultSalary?: SalaryInfo;
    useSameSalary?: boolean;
    allowances?: Allowances;
    taxSettings?: Record<string, unknown>;
    location?: { name?: string; district?: string };
  };

  const roles = legacyJob.roles ?? [
    { role: 'dealer', count: 3, filled: 0, salary: { type: 'hourly', amount: 15000 } },
    { role: 'manager', count: 1, filled: 0, salary: { type: 'hourly', amount: 15000 } },
  ];

  return {
    ...legacyJob,
    location: {
      name: legacyJob.location?.name ?? '서울 강남구',
      district: legacyJob.location?.district ?? '강남구',
      ...(typeof legacyJob.detailedAddress === 'string'
        ? { detailedAddress: legacyJob.detailedAddress }
        : {}),
    },
    schedule: {
      kind: 'fixed' as const,
      daysPerWeek: 5,
      startTime: '09:00',
      requirements: [
        {
          date: null,
          timeSlots: [
            {
              startTime: '09:00',
              isTimeToBeAnnounced: false,
              roles: roles.map((role) => ({
                role: role.role as 'dealer' | 'manager' | 'floor' | 'staff' | 'other',
                ...(role.customRole ? { customRole: role.customRole } : {}),
                count: role.count,
                ...(role.filled !== undefined ? { filled: role.filled } : {}),
              })),
            },
          ],
        },
      ],
    },
    roleCatalog: roles.map((role) => ({
      role: role.role as 'dealer' | 'manager' | 'floor' | 'staff' | 'other',
      ...(role.customRole ? { customRole: role.customRole } : {}),
      ...(role.salary ? { salary: role.salary } : {}),
    })),
    compensation: {
      mode: legacyJob.useSameSalary === false ? ('by_role' as const) : ('shared' as const),
      ...(legacyJob.defaultSalary ? { defaultSalary: legacyJob.defaultSalary } : {}),
      ...(legacyJob.allowances ? { allowances: legacyJob.allowances } : {}),
      ...(legacyJob.taxSettings ? { taxSettings: legacyJob.taxSettings } : {}),
    },
    questions: {
      items: [],
    },
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
    checkInTime: checkIn,
    checkOutTime: checkOut,
    modificationHistory: [],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

// shim 이 통과시킬 비-owner caller(워크스페이스 멤버/admin) 집합. 각 테스트에서 채운다.
const allowedCallers = new Set<string>();

describe('settlementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    allowedCallers.clear();

    // loadAndVerifyJobPostingAccess 는 실제로 owner|워크스페이스 멤버|admin 을 허용한다.
    // shim 이 그 계약을 그대로 mirror 한다 — allowedCallers 에 든 caller 는 통과.
    // (2026-07-10: owner-only 만 mirror 하던 사각지대 제거)
    mockLoadAndVerifyJobPostingAccess.mockImplementation(
      async (jobPostingId: string, callerId: string, _operation: string) => {
        const result = await mockJobPostingGetById(jobPostingId);
        if (!result) {
          const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
          throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
            userMessage: '존재하지 않는 공고입니다',
          });
        }
        const allowed = result.ownerId === callerId || allowedCallers.has(callerId);
        if (!allowed) {
          const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
          throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
            userMessage: '본인의 공고만 조회할 수 있습니다',
          });
        }
        return result;
      }
    );
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

    // 2026-07-10: owner 아닌 워크스페이스 멤버도 조회 가능해야 한다(회귀 사각지대 제거).
    it('워크스페이스 멤버(비-owner)의 조회는 통과한다', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1', ownerId: 'other-employer' });
      const workLog = createMockWorkLogWithTimes({ id: 'worklog-1', jobPostingId: 'job-1' });
      mockJobPostingGetById.mockResolvedValue(jobPosting);
      mockWorkLogGetByJobPostingId.mockResolvedValue([workLog]);
      allowedCallers.add('member-1');

      const result = await getWorkLogsByJobPosting('job-1', 'member-1');

      expect(result).toHaveLength(1);
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

    it('should exclude cancelled work logs from settlement results', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const cancelledWorkLog = createMockWorkLogWithTimes({
        id: 'worklog-cancelled',
        status: 'cancelled',
      });
      const activeWorkLog = createMockWorkLogWithTimes({ id: 'worklog-active' });

      mockJobPostingGetById.mockResolvedValue(jobPosting);
      mockWorkLogGetByJobPostingId.mockResolvedValue([cancelledWorkLog, activeWorkLog]);

      const result = await getWorkLogsByJobPosting('job-1', 'employer-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('worklog-active');
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

      // 4번째 인자는 지급 완료 되돌리기 사유(SETTLE-3). 되돌리기가 아니면 undefined 로 흐른다.
      expect(mockUpdatePayrollStatusWithTransaction).toHaveBeenCalledWith(
        'worklog-1',
        'processing',
        'employer-1',
        undefined
      );
    });

    it('되돌리기 사유를 리포지토리까지 그대로 전달한다 (SETTLE-3)', async () => {
      mockUpdatePayrollStatusWithTransaction.mockResolvedValue(undefined);

      await updateSettlementStatus('worklog-1', 'pending', 'employer-1', {
        reason: '금액 재산정 필요',
      });

      expect(mockUpdatePayrollStatusWithTransaction).toHaveBeenCalledWith(
        'worklog-1',
        'pending',
        'employer-1',
        { reason: '금액 재산정 필요' }
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockUpdatePayrollStatusWithTransaction.mockRejectedValue(
        new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
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

    it('should exclude cancelled work logs from settlement summary totals', async () => {
      const jobPosting = createMockJobPostingWithSalary({ id: 'job-1' });
      const cancelledWorkLog = createMockWorkLogWithTimes({
        id: 'worklog-cancelled',
        status: 'cancelled',
        role: 'dealer',
      });
      const activeWorkLog = createMockWorkLogWithTimes({
        id: 'worklog-active',
        status: 'checked_out',
        payrollStatus: 'pending',
        role: 'dealer',
      });

      mockJobPostingGetById.mockResolvedValue(jobPosting);
      mockWorkLogGetByJobPostingId.mockResolvedValue([cancelledWorkLog, activeWorkLog]);

      const result = await getJobPostingSettlementSummary('job-1', 'employer-1');

      expect(result.totalWorkLogs).toBe(1);
      expect(result.completedWorkLogs).toBe(1);
      expect(result.pendingSettlement).toBe(1);
      expect(result.workLogsByRole.dealer?.count).toBe(1);
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
