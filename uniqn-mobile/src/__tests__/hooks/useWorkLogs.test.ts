/**
 * UNIQN Mobile - useWorkLogs Hook Tests
 *
 * @description 근무 기록 훅 테스트 - useQuery 래퍼 검증
 * @version 1.0.0
 */

import { renderHook } from '@testing-library/react-native';
import { resetCounters, createMockWorkLog } from '../mocks/factories';

// ============================================================================
// Import After Mocks
// ============================================================================

import {
  useWorkLogs,
  useWorkLogsByDate,
  useWorkLogDetail,
  useCurrentWorkStatus,
  useWorkLogStats,
  useMonthlyPayroll,
} from '@/hooks/useWorkLogs';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockGetMyWorkLogs = jest.fn();
const mockGetWorkLogsByDate = jest.fn();
const mockGetWorkLogById = jest.fn();
const mockGetTodayCheckedInWorkLog = jest.fn();
const mockIsCurrentlyWorking = jest.fn();
const mockGetWorkLogStats = jest.fn();
const mockGetMonthlyPayroll = jest.fn();

jest.mock('@/services/workLogService', () => ({
  getMyWorkLogs: (...args: unknown[]) => mockGetMyWorkLogs(...args),
  getWorkLogsByDate: (...args: unknown[]) => mockGetWorkLogsByDate(...args),
  getWorkLogById: (...args: unknown[]) => mockGetWorkLogById(...args),
  getTodayCheckedInWorkLog: (...args: unknown[]) => mockGetTodayCheckedInWorkLog(...args),
  isCurrentlyWorking: (...args: unknown[]) => mockIsCurrentlyWorking(...args),
  getWorkLogStats: (...args: unknown[]) => mockGetWorkLogStats(...args),
  getMonthlyPayroll: (...args: unknown[]) => mockGetMonthlyPayroll(...args),
}));

// ============================================================================
// Mock Stores
// ============================================================================

const mockUser = { uid: 'staff-1' };
const mockAuthState = { user: mockUser };

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
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
  invalidateQueries: jest.fn().mockResolvedValue(undefined),
};

const mockRefetch = jest.fn().mockResolvedValue({ data: undefined });

let mockIsLoading = false;
let mockIsRefetching = false;
let mockData: unknown = undefined;
let mockError: Error | null = null;
let mockEnabled: boolean | undefined;

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(
    (options: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      mockEnabled = options.enabled;
      if (options.enabled === false) {
        return {
          data: undefined,
          isLoading: false,
          isRefetching: false,
          error: null,
          refetch: mockRefetch,
        };
      }
      return {
        data: mockData,
        isLoading: mockIsLoading,
        isRefetching: mockIsRefetching,
        error: mockError,
        refetch: mockRefetch,
      };
    }
  ),
  useQueryClient: () => mockQueryClient,
}));

// ============================================================================
// Mock Query Keys and Caching
// ============================================================================

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    workLogs: {
      all: ['workLogs'],
      mine: () => ['workLogs', 'mine'],
      byDate: (date: string) => ['workLogs', 'byDate', date],
      bySchedule: (id: string) => ['workLogs', 'bySchedule', id],
    },
    schedules: {
      all: ['schedules'],
    },
  },
  cachingPolicies: {
    realtime: 30 * 1000,
    frequent: 5 * 60 * 1000,
    standard: 10 * 60 * 1000,
    stable: 60 * 60 * 1000,
  },
  queryCachingOptions: {
    workLogs: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
}));

jest.mock('@/errors/AppError', () => ({
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string) {
      super('인증이 필요합니다.');
      this.code = code;
    }
  },
  ERROR_CODES: {
    AUTH_REQUIRED: 'E2012',
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe('useWorkLogs Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockIsLoading = false;
    mockIsRefetching = false;
    mockData = undefined;
    mockError = null;
    mockEnabled = undefined;
  });

  // ==========================================================================
  // useWorkLogs
  // ==========================================================================

  describe('useWorkLogs', () => {
    it('should return correct initial structure', () => {
      const { result } = renderHook(() => useWorkLogs());

      expect(result.current).toHaveProperty('workLogs');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isRefreshing');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refresh');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should return empty array when no data', () => {
      mockData = undefined;

      const { result } = renderHook(() => useWorkLogs());

      expect(result.current.workLogs).toEqual([]);
    });

    it('should return work logs data when available', () => {
      const mockWorkLogs = [
        createMockWorkLog({ id: 'wl-1', staffId: 'staff-1' }),
        createMockWorkLog({ id: 'wl-2', staffId: 'staff-1' }),
      ];
      mockData = mockWorkLogs;

      const { result } = renderHook(() => useWorkLogs());

      expect(result.current.workLogs).toEqual(mockWorkLogs);
    });

    it('should respect enabled option', () => {
      renderHook(() => useWorkLogs({ enabled: false }));

      expect(mockEnabled).toBe(false);
    });

    it('should disable query when user is not authenticated', () => {
      const originalState = { ...mockAuthState };
      Object.assign(mockAuthState, { user: null });

      renderHook(() => useWorkLogs());

      expect(mockEnabled).toBe(false);

      Object.assign(mockAuthState, originalState);
    });

    it('should return loading state', () => {
      mockIsLoading = true;

      const { result } = renderHook(() => useWorkLogs());

      expect(result.current.isLoading).toBe(true);
    });

    it('should return refreshing state', () => {
      mockIsRefetching = true;

      const { result } = renderHook(() => useWorkLogs());

      expect(result.current.isRefreshing).toBe(true);
    });

    it('should return error state', () => {
      mockError = new Error('조회 실패');

      const { result } = renderHook(() => useWorkLogs());

      expect(result.current.error).toEqual(new Error('조회 실패'));
    });

    it('should have refresh function that invalidates queries', async () => {
      const { result } = renderHook(() => useWorkLogs());

      await result.current.refresh();

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['workLogs'],
      });
    });

    it('should have refetch function', () => {
      const { result } = renderHook(() => useWorkLogs());

      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe('function');
    });
  });

  // ==========================================================================
  // useWorkLogsByDate
  // ==========================================================================

  describe('useWorkLogsByDate', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useWorkLogsByDate('2025-01-15'));

      expect(result.current).toHaveProperty('workLogs');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should return empty array when no data', () => {
      mockData = undefined;

      const { result } = renderHook(() => useWorkLogsByDate('2025-01-15'));

      expect(result.current.workLogs).toEqual([]);
    });

    it('should return work logs for specific date', () => {
      const mockWorkLogs = [
        createMockWorkLog({ id: 'wl-date-1' }),
      ];
      mockData = mockWorkLogs;

      const { result } = renderHook(() => useWorkLogsByDate('2025-01-15'));

      expect(result.current.workLogs).toEqual(mockWorkLogs);
    });

    it('should disable query when date is empty', () => {
      renderHook(() => useWorkLogsByDate(''));

      expect(mockEnabled).toBe(false);
    });

    it('should disable query when enabled is false', () => {
      renderHook(() => useWorkLogsByDate('2025-01-15', false));

      expect(mockEnabled).toBe(false);
    });

    it('should disable query when user is not authenticated', () => {
      const originalState = { ...mockAuthState };
      Object.assign(mockAuthState, { user: null });

      renderHook(() => useWorkLogsByDate('2025-01-15'));

      expect(mockEnabled).toBe(false);

      Object.assign(mockAuthState, originalState);
    });
  });

  // ==========================================================================
  // useWorkLogDetail
  // ==========================================================================

  describe('useWorkLogDetail', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useWorkLogDetail('wl-1'));

      expect(result.current).toHaveProperty('workLog');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should return undefined when no data', () => {
      mockData = undefined;

      const { result } = renderHook(() => useWorkLogDetail('wl-1'));

      expect(result.current.workLog).toBeUndefined();
    });

    it('should return work log detail when data exists', () => {
      const mockWorkLog = createMockWorkLog({ id: 'wl-detail-1' });
      mockData = mockWorkLog;

      const { result } = renderHook(() => useWorkLogDetail('wl-detail-1'));

      expect(result.current.workLog).toEqual(mockWorkLog);
    });

    it('should disable query when workLogId is empty', () => {
      renderHook(() => useWorkLogDetail(''));

      expect(mockEnabled).toBe(false);
    });

    it('should disable query when enabled is false', () => {
      renderHook(() => useWorkLogDetail('wl-1', false));

      expect(mockEnabled).toBe(false);
    });
  });

  // ==========================================================================
  // useCurrentWorkStatus
  // ==========================================================================

  describe('useCurrentWorkStatus', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useCurrentWorkStatus());

      expect(result.current).toHaveProperty('currentWorkLog');
      expect(result.current).toHaveProperty('isWorking');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should return null currentWorkLog and false isWorking when no data', () => {
      mockData = undefined;

      const { result } = renderHook(() => useCurrentWorkStatus());

      expect(result.current.currentWorkLog).toBeNull();
      expect(result.current.isWorking).toBe(false);
    });

    it('should return current work status when data available', () => {
      const mockWorkLog = createMockWorkLog({ id: 'wl-current', status: 'checked_in' });
      mockData = { workLog: mockWorkLog, isWorking: true };

      const { result } = renderHook(() => useCurrentWorkStatus());

      expect(result.current.currentWorkLog).toEqual(mockWorkLog);
      expect(result.current.isWorking).toBe(true);
    });

    it('should return not working when workLog exists but not currently working', () => {
      const mockWorkLog = createMockWorkLog({ id: 'wl-done', status: 'completed' });
      mockData = { workLog: mockWorkLog, isWorking: false };

      const { result } = renderHook(() => useCurrentWorkStatus());

      expect(result.current.currentWorkLog).toEqual(mockWorkLog);
      expect(result.current.isWorking).toBe(false);
    });

    it('should disable query when enabled is false', () => {
      renderHook(() => useCurrentWorkStatus(false));

      expect(mockEnabled).toBe(false);
    });

    it('should disable query when user is not authenticated', () => {
      const originalState = { ...mockAuthState };
      Object.assign(mockAuthState, { user: null });

      renderHook(() => useCurrentWorkStatus());

      expect(mockEnabled).toBe(false);

      Object.assign(mockAuthState, originalState);
    });
  });

  // ==========================================================================
  // useWorkLogStats
  // ==========================================================================

  describe('useWorkLogStats', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useWorkLogStats());

      expect(result.current).toHaveProperty('stats');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should return undefined stats when no data', () => {
      mockData = undefined;

      const { result } = renderHook(() => useWorkLogStats());

      expect(result.current.stats).toBeUndefined();
    });

    it('should return stats data when available', () => {
      const mockStats = {
        totalWorkLogs: 50,
        totalHoursWorked: 400,
        completedCount: 45,
        noShowCount: 2,
      };
      mockData = mockStats;

      const { result } = renderHook(() => useWorkLogStats());

      expect(result.current.stats).toEqual(mockStats);
    });

    it('should disable query when enabled is false', () => {
      renderHook(() => useWorkLogStats(false));

      expect(mockEnabled).toBe(false);
    });

    it('should disable query when user is not authenticated', () => {
      const originalState = { ...mockAuthState };
      Object.assign(mockAuthState, { user: null });

      renderHook(() => useWorkLogStats());

      expect(mockEnabled).toBe(false);

      Object.assign(mockAuthState, originalState);
    });
  });

  // ==========================================================================
  // useMonthlyPayroll
  // ==========================================================================

  describe('useMonthlyPayroll', () => {
    it('should return correct structure', () => {
      const { result } = renderHook(() => useMonthlyPayroll(2025, 1));

      expect(result.current).toHaveProperty('payroll');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should return undefined payroll when no data', () => {
      mockData = undefined;

      const { result } = renderHook(() => useMonthlyPayroll(2025, 1));

      expect(result.current.payroll).toBeUndefined();
    });

    it('should return payroll data when available', () => {
      const mockPayroll = {
        year: 2025,
        month: 1,
        totalAmount: 2400000,
        workDays: 20,
        entries: [],
      };
      mockData = mockPayroll;

      const { result } = renderHook(() => useMonthlyPayroll(2025, 1));

      expect(result.current.payroll).toEqual(mockPayroll);
    });

    it('should disable query when enabled is false', () => {
      renderHook(() => useMonthlyPayroll(2025, 1, false));

      expect(mockEnabled).toBe(false);
    });

    it('should disable query when user is not authenticated', () => {
      const originalState = { ...mockAuthState };
      Object.assign(mockAuthState, { user: null });

      renderHook(() => useMonthlyPayroll(2025, 1));

      expect(mockEnabled).toBe(false);

      Object.assign(mockAuthState, originalState);
    });
  });
});
