/**
 * UNIQN Mobile - useSettlement Hooks Tests
 *
 * @description Unit tests for settlement management hooks
 * @version 1.0.0
 */

// ============================================================================
// Firebase Mock - Must be first to prevent initialization
// ============================================================================

import { renderHook, act } from '@testing-library/react-native';
import {
  createMockWorkLog,
  createMockJobPosting,
  resetCounters,
} from '../mocks/factories';

// ============================================================================
// Import After Mocks
// ============================================================================

import {
  useWorkLogsByJobPosting,
  useSettlementSummary,
  useMySettlementSummary,
  useCalculateSettlement,
  useUpdateWorkTime,
  useSettleWorkLog,
  useBulkSettlement,
  useUpdateSettlementStatus,
  useSettlement,
  useSettlementDashboard,
} from '@/hooks/useSettlement';

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockGetWorkLogsByJobPosting = jest.fn();
const mockCalculateSettlement = jest.fn();
const mockUpdateWorkTime = jest.fn();
const mockSettleWorkLog = jest.fn();
const mockBulkSettlement = jest.fn();
const mockUpdateSettlementStatus = jest.fn();
const mockGetJobPostingSettlementSummary = jest.fn();
const mockGetMySettlementSummary = jest.fn();

// Mock the services index (the hook imports from @/services, not @/services/settlementService)
jest.mock('@/services', () => ({
  getWorkLogsByJobPosting: (...args: unknown[]) => mockGetWorkLogsByJobPosting(...args),
  calculateSettlement: (...args: unknown[]) => mockCalculateSettlement(...args),
  updateWorkTimeForSettlement: (...args: unknown[]) => mockUpdateWorkTime(...args),
  settleWorkLog: (...args: unknown[]) => mockSettleWorkLog(...args),
  bulkSettlement: (...args: unknown[]) => mockBulkSettlement(...args),
  updateSettlementStatus: (...args: unknown[]) => mockUpdateSettlementStatus(...args),
  getJobPostingSettlementSummary: (...args: unknown[]) => mockGetJobPostingSettlementSummary(...args),
  getMySettlementSummary: (...args: unknown[]) => mockGetMySettlementSummary(...args),
}));

// ============================================================================
// Mock Stores
// ============================================================================

const mockAddToast = jest.fn();
const mockUser = { uid: 'employer-1' };
const mockAuthState = { user: mockUser };
const mockToastState = { addToast: mockAddToast };

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector?: (state: typeof mockToastState) => unknown) =>
    selector ? selector(mockToastState) : mockToastState,
}));

// ============================================================================
// Mock Logger
// ============================================================================

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Mock React Query
// ============================================================================

const mockQueryClient = {
  invalidateQueries: jest.fn(),
};

const mockMutate = jest.fn();
const mockMutateAsync = jest.fn();
const mockRefetch = jest.fn();

let mockIsLoading = false;
let mockIsPending = false;
let mockData: unknown = undefined;
let mockError: Error | null = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((options: {
    queryKey: string[];
    queryFn: () => Promise<unknown>;
    enabled?: boolean;
  }) => {
    if (options.enabled === false) {
      return {
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };
    }
    return {
      data: mockData,
      isLoading: mockIsLoading,
      error: mockError,
      refetch: mockRefetch,
    };
  }),
  useMutation: jest.fn((options: {
    mutationFn: (...args: unknown[]) => Promise<unknown>;
    onSuccess?: (data: unknown, variables: unknown) => void;
    onError?: (error: Error) => void;
  }) => {
    // mutate doesn't throw - errors are handled via onError callback
    mockMutate.mockImplementation((args: unknown) => {
      mockIsPending = true;
      options.mutationFn(args)
        .then((result) => {
          options.onSuccess?.(result, args);
          mockIsPending = false;
        })
        .catch((error) => {
          mockError = error as Error;
          options.onError?.(error as Error);
          mockIsPending = false;
        });
    });

    // mutateAsync does throw
    mockMutateAsync.mockImplementation(async (args: unknown) => {
      try {
        mockIsPending = true;
        const result = await options.mutationFn(args);
        options.onSuccess?.(result, args);
        mockIsPending = false;
        return result;
      } catch (error) {
        mockError = error as Error;
        options.onError?.(error as Error);
        mockIsPending = false;
        throw error;
      }
    });

    return {
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      data: mockData,
      isPending: mockIsPending,
      error: mockError,
    };
  }),
  useQueryClient: () => mockQueryClient,
}));

// ============================================================================
// Mock Query Keys
// ============================================================================

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    settlement: {
      all: ['settlement'],
      byJobPosting: (id: string) => ['settlement', 'byJobPosting', id],
      summary: (id: string) => ['settlement', 'summary', id],
      mySummary: () => ['settlement', 'mySummary'],
    },
    workLogs: {
      all: ['workLogs'],
    },
  },
  cachingPolicies: {
    frequent: 1000 * 60 * 2, // 2 minutes
    standard: 1000 * 60 * 5, // 5 minutes
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockSettlementWorkLog(overrides = {}) {
  const base = createMockWorkLog();
  return {
    ...base,
    eventId: 'job-1',
    staffName: '홍길동',
    jobPostingTitle: '테스트 공고',
    hoursWorked: 8,
    calculatedAmount: 120000,
    payrollStatus: 'pending' as const,
    payrollAmount: undefined,
    role: 'dealer',
    date: '2024-01-15',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useSettlement Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockIsLoading = false;
    mockIsPending = false;
    mockData = undefined;
    mockError = null;
  });

  // ==========================================================================
  // useWorkLogsByJobPosting
  // ==========================================================================

  describe('useWorkLogsByJobPosting', () => {
    it('should return initial state correctly when disabled', () => {
      const { result } = renderHook(() => useWorkLogsByJobPosting(''));

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return work logs when enabled', () => {
      const mockWorkLogs = [
        createMockSettlementWorkLog({ id: 'worklog-1' }),
        createMockSettlementWorkLog({ id: 'worklog-2' }),
      ];
      mockData = mockWorkLogs;

      const { result } = renderHook(() => useWorkLogsByJobPosting('job-1'));

      expect(result.current.data).toEqual(mockWorkLogs);
    });
  });

  // ==========================================================================
  // useSettlementSummary
  // ==========================================================================

  describe('useSettlementSummary', () => {
    it('should return summary data', () => {
      const mockSummary = {
        jobPostingId: 'job-1',
        jobPostingTitle: '테스트 공고',
        totalWorkLogs: 10,
        completedWorkLogs: 8,
        pendingSettlement: 5,
        completedSettlement: 3,
        totalPendingAmount: 600000,
        totalCompletedAmount: 360000,
        workLogsByRole: {},
      };
      mockData = mockSummary;

      const { result } = renderHook(() => useSettlementSummary('job-1'));

      expect(result.current.data).toEqual(mockSummary);
    });
  });

  // ==========================================================================
  // useCalculateSettlement
  // ==========================================================================

  describe('useCalculateSettlement', () => {
    it('should return mutation functions', () => {
      const { result } = renderHook(() => useCalculateSettlement());

      expect(result.current.mutateAsync).toBeDefined();
      expect(result.current.isPending).toBe(false);
    });

    it('should calculate settlement', async () => {
      const mockCalculation = {
        workLogId: 'worklog-1',
        regularHours: 8,
        overtimeHours: 0,
        regularPay: 120000,
        overtimePay: 0,
        grossPay: 120000,
        deductions: 0,
        netPay: 120000,
      };
      mockCalculateSettlement.mockResolvedValueOnce(mockCalculation);

      const { result } = renderHook(() => useCalculateSettlement());

      await act(async () => {
        await result.current.mutateAsync({ workLogId: 'worklog-1' });
      });

      expect(mockCalculateSettlement).toHaveBeenCalledWith(
        { workLogId: 'worklog-1' },
        'employer-1'
      );
    });
  });

  // ==========================================================================
  // useUpdateWorkTime
  // ==========================================================================

  describe('useUpdateWorkTime', () => {
    it('should update work time', async () => {
      mockUpdateWorkTime.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useUpdateWorkTime());

      await act(async () => {
        result.current.mutate({
          workLogId: 'worklog-1',
          actualStartTime: new Date('2024-01-15T09:00:00'),
          actualEndTime: new Date('2024-01-15T17:00:00'),
          reason: '시간 수정',
        });
      });

      expect(mockUpdateWorkTime).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '근무 시간이 수정되었습니다.',
      });
    });

    it('should show error toast on failure', async () => {
      mockUpdateWorkTime.mockRejectedValueOnce(new Error('수정 실패'));

      const { result } = renderHook(() => useUpdateWorkTime());

      await act(async () => {
        try {
          result.current.mutate({ workLogId: 'worklog-1' });
        } catch {
          // Expected
        }
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '수정 실패',
      });
    });
  });

  // ==========================================================================
  // useSettleWorkLog
  // ==========================================================================

  describe('useSettleWorkLog', () => {
    it('should settle a work log', async () => {
      const mockResult = {
        success: true,
        workLogId: 'worklog-1',
        amount: 120000,
        message: '정산 완료',
      };
      mockSettleWorkLog.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useSettleWorkLog());

      await act(async () => {
        result.current.mutate({ workLogId: 'worklog-1', amount: 120000 });
      });

      expect(mockSettleWorkLog).toHaveBeenCalledWith(
        { workLogId: 'worklog-1', amount: 120000 },
        'employer-1'
      );
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '120,000원 정산 완료',
      });
    });

    it('should show error message when settlement fails', async () => {
      const mockResult = {
        success: false,
        workLogId: 'worklog-1',
        amount: 0,
        message: '이미 정산 완료된 근무 기록입니다',
      };
      mockSettleWorkLog.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useSettleWorkLog());

      await act(async () => {
        result.current.mutate({ workLogId: 'worklog-1', amount: 120000 });
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '이미 정산 완료된 근무 기록입니다',
      });
    });
  });

  // ==========================================================================
  // useBulkSettlement
  // ==========================================================================

  describe('useBulkSettlement', () => {
    it('should settle multiple work logs', async () => {
      const mockResult = {
        totalCount: 3,
        successCount: 3,
        failedCount: 0,
        totalAmount: 360000,
        results: [],
      };
      mockBulkSettlement.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useBulkSettlement());

      await act(async () => {
        result.current.mutate({
          workLogIds: ['worklog-1', 'worklog-2', 'worklog-3'],
        });
      });

      expect(mockBulkSettlement).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '3건 / 360,000원 정산 완료',
      });
    });

    it('should show warning for partial failures', async () => {
      const mockResult = {
        totalCount: 3,
        successCount: 2,
        failedCount: 1,
        totalAmount: 240000,
        results: [],
      };
      mockBulkSettlement.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useBulkSettlement());

      await act(async () => {
        result.current.mutate({
          workLogIds: ['worklog-1', 'worklog-2', 'worklog-3'],
        });
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'warning',
        message: '1건 정산 실패',
      });
    });
  });

  // ==========================================================================
  // useUpdateSettlementStatus
  // ==========================================================================

  describe('useUpdateSettlementStatus', () => {
    it('should update settlement status', async () => {
      mockUpdateSettlementStatus.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useUpdateSettlementStatus());

      await act(async () => {
        result.current.mutate({
          workLogId: 'worklog-1',
          status: 'completed',
        });
      });

      expect(mockUpdateSettlementStatus).toHaveBeenCalledWith(
        'worklog-1',
        'completed',
        'employer-1'
      );
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '정산이 완료되었습니다.',
      });
    });

    it('should show appropriate message for each status', async () => {
      mockUpdateSettlementStatus.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useUpdateSettlementStatus());

      await act(async () => {
        result.current.mutate({
          workLogId: 'worklog-1',
          status: 'processing',
        });
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '정산 처리 중으로 변경되었습니다.',
      });
    });
  });

  // ==========================================================================
  // useSettlement (통합 훅)
  // ==========================================================================

  describe('useSettlement', () => {
    it('should return all settlement functions and data', () => {
      mockData = [
        createMockSettlementWorkLog({ id: 'worklog-1', payrollStatus: 'pending' }),
        createMockSettlementWorkLog({ id: 'worklog-2', payrollStatus: 'completed' }),
      ];

      const { result } = renderHook(() => useSettlement('job-1'));

      expect(result.current.workLogs).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.refresh).toBeDefined();
      expect(result.current.updateWorkTime).toBeDefined();
      expect(result.current.settleWorkLog).toBeDefined();
      expect(result.current.bulkSettle).toBeDefined();
      expect(result.current.filterWorkLogs).toBeDefined();
    });

    it('should filter work logs by status', () => {
      const pendingWorkLog = createMockSettlementWorkLog({
        id: 'worklog-1',
        payrollStatus: 'pending',
      });
      const completedWorkLog = createMockSettlementWorkLog({
        id: 'worklog-2',
        payrollStatus: 'completed',
      });
      mockData = [pendingWorkLog, completedWorkLog];

      const { result } = renderHook(() => useSettlement('job-1'));

      expect(result.current.pendingWorkLogs).toHaveLength(1);
      expect(result.current.completedWorkLogs).toHaveLength(1);
      expect(result.current.pendingCount).toBe(1);
      expect(result.current.completedCount).toBe(1);
    });
  });

  // ==========================================================================
  // useSettlementDashboard
  // ==========================================================================

  describe('useSettlementDashboard', () => {
    it('should return dashboard summary', () => {
      const mockSummary = {
        totalJobPostings: 5,
        totalWorkLogs: 50,
        totalPendingAmount: 3000000,
        totalCompletedAmount: 2000000,
        summariesByJobPosting: [],
      };
      mockData = mockSummary;

      const { result } = renderHook(() => useSettlementDashboard());

      expect(result.current.summary).toEqual(mockSummary);
      expect(result.current.totalJobPostings).toBe(5);
      expect(result.current.totalWorkLogs).toBe(50);
      expect(result.current.totalPendingAmount).toBe(3000000);
      expect(result.current.totalCompletedAmount).toBe(2000000);
    });
  });
});
