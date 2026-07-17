/**
 * UNIQN Mobile - useWorkLogs Hook Tests
 *
 * @description 근무 기록 훅 테스트 - useQuery 래퍼 검증
 * @version 1.0.0
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
// Phase 2A.후속 (PR3-B, 2026-05-10) — useMonthlyPayroll workspace 의존성 mock
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
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
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
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
const mockSubscribeToTodayWorkStatus = jest.fn();

jest.mock('@/services/work/workLogService', () => ({
  getMyWorkLogs: (...args: unknown[]) => mockGetMyWorkLogs(...args),
  getWorkLogsByDate: (...args: unknown[]) => mockGetWorkLogsByDate(...args),
  getWorkLogById: (...args: unknown[]) => mockGetWorkLogById(...args),
  getTodayCheckedInWorkLog: (...args: unknown[]) => mockGetTodayCheckedInWorkLog(...args),
  isCurrentlyWorking: (...args: unknown[]) => mockIsCurrentlyWorking(...args),
  getWorkLogStats: (...args: unknown[]) => mockGetWorkLogStats(...args),
  getMonthlyPayroll: (...args: unknown[]) => mockGetMonthlyPayroll(...args),
  subscribeToTodayWorkStatus: (...args: unknown[]) => mockSubscribeToTodayWorkStatus(...args),
}));

// ============================================================================
// Mock Stores
// ============================================================================

const mockUser = { uid: 'staff-1' };
const mockAuthState = { user: mockUser };

// Phase 2A.후속 (PR3-B, 2026-05-10) — useMonthlyPayroll workspace 의존성
jest.mock('@/hooks/workspace/useActiveWorkspace', () => ({
  useActiveWorkspace: jest.fn(),
}));
const mockUseActiveWorkspace = useActiveWorkspace as jest.MockedFunction<typeof useActiveWorkspace>;

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
const mockGetCriticalOfflineCache = jest.fn();
const mockSetCriticalOfflineCache = jest.fn();

let mockIsLoading = false;
let mockIsRefetching = false;
let mockData: unknown = undefined;
let mockError: Error | null = null;
let mockEnabled: boolean | undefined;
let lastQueryFn: (() => Promise<unknown>) | undefined;
let mockIsOnline = true;
let mockCurrentWorkStatusSnapshot: ReturnType<typeof createMockWorkLog> | null | undefined =
  undefined;
let mockCurrentWorkStatusError: Error | null = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(
    (options: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      mockEnabled = options.enabled;
      lastQueryFn = options.queryFn;
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

jest.mock('@/constants', () => ({
  STATUS: {
    WORK_LOG: {
      CHECKED_IN: 'checked_in',
    },
  },
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: mockIsOnline,
    isOffline: !mockIsOnline,
    isChecking: false,
    connectionType: 'wifi',
    isInternetReachable: mockIsOnline,
    lastChecked: null,
    details: null,
    checkConnection: jest.fn(),
  }),
}));

jest.mock('@/services/offline/criticalOfflineCache', () => ({
  getCriticalOfflineCache: (...args: unknown[]) => mockGetCriticalOfflineCache(...args),
  setCriticalOfflineCache: (...args: unknown[]) => mockSetCriticalOfflineCache(...args),
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
    lastQueryFn = undefined;
    mockIsOnline = true;
    mockCurrentWorkStatusSnapshot = undefined;
    mockCurrentWorkStatusError = null;
    mockGetCriticalOfflineCache.mockReturnValue(null);
    mockSetCriticalOfflineCache.mockReset();
    mockSubscribeToTodayWorkStatus.mockImplementation(
      (
        _staffId: string,
        listeners: {
          onUpdate: (workLog: ReturnType<typeof createMockWorkLog> | null) => void;
          onError: (error: Error) => void;
        }
      ) => {
        if (mockCurrentWorkStatusError) {
          listeners.onError(mockCurrentWorkStatusError);
        } else if (mockCurrentWorkStatusSnapshot !== undefined) {
          listeners.onUpdate(mockCurrentWorkStatusSnapshot);
        }

        return jest.fn();
      }
    );

    // Phase 2A.후속 (PR3-B, 2026-05-10) — useMonthlyPayroll 가 useActiveWorkspace 의존
    mockUseActiveWorkspace.mockReturnValue({
      activeWorkspace: {
        id: 'ws-default',
        name: 'Default',
        ownerId: 'staff-1',
        memberCount: 1,
      } as any,
      workspaces: [],
      isLoading: false,
      setActiveWorkspaceId: jest.fn(),
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
    });
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
      const mockWorkLogs = [createMockWorkLog({ id: 'wl-date-1' })];
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

    it('should derive isWorking from a single today-work-log fetch', async () => {
      mockGetTodayCheckedInWorkLog.mockResolvedValue(
        createMockWorkLog({ id: 'wl-current', status: 'checked_in' })
      );

      renderHook(() => useCurrentWorkStatus());

      await lastQueryFn?.();

      expect(mockGetTodayCheckedInWorkLog).toHaveBeenCalledTimes(1);
      expect(mockIsCurrentlyWorking).not.toHaveBeenCalled();
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
      const { result } = renderHook(() => useCurrentWorkStatus());

      expect(result.current.currentWorkLog).toBeNull();
      expect(result.current.isWorking).toBe(false);
    });

    it('should return current work status when a checked-in snapshot arrives', async () => {
      const mockWorkLog = createMockWorkLog({ id: 'wl-current', status: 'checked_in' });
      mockCurrentWorkStatusSnapshot = mockWorkLog;

      const { result } = renderHook(() => useCurrentWorkStatus());

      await waitFor(() => {
        expect(result.current.currentWorkLog).toEqual(mockWorkLog);
        expect(result.current.isWorking).toBe(true);
      });

      expect(mockSetCriticalOfflineCache).toHaveBeenCalledWith(
        'workLogs:staff-1:current-status',
        { workLog: mockWorkLog, isWorking: true },
        expect.objectContaining({
          userId: 'staff-1',
          schemaVersion: 2,
        })
      );
    });

    it('should treat non-checked-in snapshots as not working', async () => {
      const mockWorkLog = createMockWorkLog({ id: 'wl-scheduled', status: 'scheduled' });
      mockCurrentWorkStatusSnapshot = mockWorkLog;

      const { result } = renderHook(() => useCurrentWorkStatus());

      await waitFor(() => {
        expect(result.current.currentWorkLog).toBeNull();
        expect(result.current.isWorking).toBe(false);
      });
    });

    it('should subscribe to realtime updates and clean up on unmount', () => {
      const unsubscribe = jest.fn();
      mockSubscribeToTodayWorkStatus.mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useCurrentWorkStatus());

      expect(mockSubscribeToTodayWorkStatus).toHaveBeenCalledWith(
        'staff-1',
        expect.objectContaining({
          onUpdate: expect.any(Function),
          onError: expect.any(Function),
        })
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should expose loading state before the initial realtime snapshot arrives', () => {
      mockSubscribeToTodayWorkStatus.mockReturnValue(jest.fn());

      const { result } = renderHook(() => useCurrentWorkStatus());

      expect(result.current.isLoading).toBe(true);
    });

    it('should use cached current status before the initial realtime snapshot arrives', () => {
      const cachedWorkLog = createMockWorkLog({ id: 'wl-cached', status: 'checked_in' });
      mockGetCriticalOfflineCache.mockReturnValue({
        data: { workLog: cachedWorkLog, isWorking: true },
      });
      mockSubscribeToTodayWorkStatus.mockReturnValue(jest.fn());

      const { result } = renderHook(() => useCurrentWorkStatus());

      expect(result.current.currentWorkLog).toEqual(cachedWorkLog);
      expect(result.current.isWorking).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should keep the latest known status when transitioning offline', async () => {
      const mockWorkLog = createMockWorkLog({ id: 'wl-online', status: 'checked_in' });
      mockCurrentWorkStatusSnapshot = mockWorkLog;
      mockGetCriticalOfflineCache
        .mockReturnValueOnce(null)
        .mockReturnValue({ data: { workLog: mockWorkLog, isWorking: true } });

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useCurrentWorkStatus(enabled),
        {
          initialProps: { enabled: true },
        }
      );

      await waitFor(() => {
        expect(result.current.currentWorkLog).toEqual(mockWorkLog);
        expect(result.current.isWorking).toBe(true);
      });

      act(() => {
        mockIsOnline = false;
        rerender({ enabled: true });
      });

      await waitFor(() => {
        expect(result.current.currentWorkLog).toEqual(mockWorkLog);
        expect(result.current.isWorking).toBe(true);
      });
    });

    it('should update state from manual refetch when online', async () => {
      const mockWorkLog = createMockWorkLog({ id: 'wl-refetch', status: 'checked_in' });
      mockRefetch.mockResolvedValueOnce({
        data: { workLog: mockWorkLog, isWorking: true },
      });

      const { result } = renderHook(() => useCurrentWorkStatus());

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockRefetch).toHaveBeenCalled();
      expect(result.current.currentWorkLog).toEqual(mockWorkLog);
      expect(result.current.isWorking).toBe(true);
      expect(mockSetCriticalOfflineCache).toHaveBeenCalledWith(
        'workLogs:staff-1:current-status',
        { workLog: mockWorkLog, isWorking: true },
        expect.objectContaining({
          userId: 'staff-1',
          schemaVersion: 2,
        })
      );
    });

    it('should no-op refetch when offline', async () => {
      mockIsOnline = false;

      const { result } = renderHook(() => useCurrentWorkStatus());

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockRefetch).not.toHaveBeenCalled();
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
      expect(mockSubscribeToTodayWorkStatus).not.toHaveBeenCalled();

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

    // ========================================================================
    // Phase 2A.후속 (PR3-B, 2026-05-10) — workspace 의존성 contract 테스트
    // PR #71 useJobManagement.test.ts:workspace 패턴 복제
    // ========================================================================

    it('Phase 2A.후속 — activeWorkspace 가 없으면 enabled 가 false 다', () => {
      mockUseActiveWorkspace.mockReturnValue({
        activeWorkspace: undefined,
        workspaces: [],
        isLoading: false,
        setActiveWorkspaceId: jest.fn(),
        isFetching: false,
        isError: false,
        refetch: jest.fn(),
      });

      renderHook(() => useMonthlyPayroll(2025, 1));

      expect(mockEnabled).toBe(false);
    });

    it('Phase 2A.후속 — activeWorkspace.id 가 query key 에 포함된다', () => {
      mockUseActiveWorkspace.mockReturnValue({
        activeWorkspace: {
          id: 'ws-1',
          name: 'Test',
          ownerId: 'staff-1',
          memberCount: 1,
        } as any,
        workspaces: [],
        isLoading: false,
        setActiveWorkspaceId: jest.fn(),
        isFetching: false,
        isError: false,
        refetch: jest.fn(),
      });

      renderHook(() => useMonthlyPayroll(2025, 1));

      const { useQuery } = jest.requireMock('@tanstack/react-query') as {
        useQuery: jest.Mock;
      };

      // 가장 최근 호출의 queryKey 검사
      const calls = useQuery.mock.calls;
      const lastCall = calls[calls.length - 1][0] as { queryKey: unknown[] };
      expect(lastCall.queryKey).toEqual(expect.arrayContaining(['ws-1']));
    });

    it('Phase 2A.후속 — getMonthlyPayroll 호출 시 workspaceId 가 4번째 인자로 전달된다', async () => {
      mockUseActiveWorkspace.mockReturnValue({
        activeWorkspace: {
          id: 'ws-1',
          name: 'Test',
          ownerId: 'staff-1',
          memberCount: 1,
        } as any,
        workspaces: [],
        isLoading: false,
        setActiveWorkspaceId: jest.fn(),
        isFetching: false,
        isError: false,
        refetch: jest.fn(),
      });
      mockGetMonthlyPayroll.mockResolvedValue({
        totalAmount: 0,
        pendingAmount: 0,
        completedAmount: 0,
        workLogs: [],
      });

      renderHook(() => useMonthlyPayroll(2025, 3));

      // queryFn 직접 호출하여 service 인자 검증
      if (lastQueryFn) {
        await lastQueryFn();
      }

      expect(mockGetMonthlyPayroll).toHaveBeenCalledWith('staff-1', 2025, 3, 'ws-1');
    });
  });
});
