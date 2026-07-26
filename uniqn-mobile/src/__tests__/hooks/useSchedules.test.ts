import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { CalendarView, ScheduleEvent, ScheduleStats } from '@/types';

import {
  useSchedules,
  useSchedulesByMonth,
  useSchedulesByDate,
  useScheduleDetail,
  useTodaySchedules,
  useCalendarView,
} from '@/hooks/useSchedules';

const mockGetMySchedules = jest.fn();
const mockGetSchedulesByMonth = jest.fn();
const mockGetSchedulesByDate = jest.fn();
const mockGetScheduleById = jest.fn();
const mockGetTodaySchedules = jest.fn();
const mockSubscribeToSchedules = jest.fn();
const mockCalculateScheduleStats = jest.fn();
const mockGroupSchedulesByDate = jest.fn();
const mockGetCalendarMarkedDates = jest.fn();

jest.mock('@/services/work/scheduleService', () => ({
  getMySchedules: (...args: unknown[]) => mockGetMySchedules(...args),
  getSchedulesByMonth: (...args: unknown[]) => mockGetSchedulesByMonth(...args),
  getSchedulesByDate: (...args: unknown[]) => mockGetSchedulesByDate(...args),
  getScheduleById: (...args: unknown[]) => mockGetScheduleById(...args),
  getTodaySchedules: (...args: unknown[]) => mockGetTodaySchedules(...args),
  subscribeToSchedules: (...args: unknown[]) => mockSubscribeToSchedules(...args),
  calculateScheduleStats: (...args: unknown[]) => mockCalculateScheduleStats(...args),
  groupSchedulesByDate: (...args: unknown[]) => mockGroupSchedulesByDate(...args),
  getCalendarMarkedDates: (...args: unknown[]) => mockGetCalendarMarkedDates(...args),
}));

const mockGroupScheduleEvents = jest.fn();
const mockFilterSchedulesByDate = jest.fn();

jest.mock('@/utils/scheduleGrouping', () => ({
  groupScheduleEvents: (...args: unknown[]) => mockGroupScheduleEvents(...args),
  filterSchedulesByDate: (...args: unknown[]) => mockFilterSchedulesByDate(...args),
  // 선택 날짜 재정렬은 순수 함수라 실제 구현을 그대로 쓴다 — 부분 mock 으로 빼면
  // 훅이 호출하는 순간 "is not a function" 으로 터진다.
  resolveSelectedDateForMonth: jest.requireActual('@/utils/scheduleGrouping')
    .resolveSelectedDateForMonth,
}));

jest.mock('@/utils/queryUtils', () => ({
  stableFilters: (filters: unknown) => filters,
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: true,
    isOffline: false,
    isChecking: false,
    connectionType: 'wifi',
    isInternetReachable: true,
    lastChecked: null,
    details: null,
    checkConnection: jest.fn(),
  }),
}));

jest.mock('@/services/offline/criticalOfflineCache', () => ({
  getCriticalOfflineCache: jest.fn(() => null),
  setCriticalOfflineCache: jest.fn(),
}));

const { setCriticalOfflineCache: mockSetCriticalOfflineCache } = jest.requireMock(
  '@/services/offline/criticalOfflineCache'
) as {
  setCriticalOfflineCache: jest.Mock;
};

type MockUser = { uid: string } | null;

let mockUser: MockUser = { uid: 'staff-1' };

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: MockUser }) => unknown) => {
    const state = { user: mockUser };
    return selector ? selector(state) : state;
  },
}));

class MockAuthError extends Error {
  constructor(code: string) {
    super(`Auth error: ${code}`);
    this.name = 'AuthError';
  }
}

jest.mock('@/errors/AppError', () => ({
  AuthError: MockAuthError,
  ERROR_CODES: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
  },
}));

const mockInvalidateQueries = jest.fn();
const mockSetQueryData = jest.fn();
const mockRefetch = jest.fn();
const mockUseQuery = jest.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
  setQueryData: mockSetQueryData,
};

let mockQueryData: unknown = undefined;
let mockQueryError: Error | null = null;
let mockIsLoading = false;
let mockIsRefetching = false;
let mockDataUpdatedAt = 0;

jest.mock('@tanstack/react-query', () => ({
  useQuery: (
    options: {
      queryFn: () => Promise<unknown> | unknown;
      enabled?: boolean;
    } & Record<string, unknown>
  ) => mockUseQuery(options),
  useQueryClient: () => mockQueryClient,
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    schedules: {
      all: ['schedules'],
      list: (filters: unknown) => ['schedules', 'list', filters],
      byMonth: (year: number, month: number) => ['schedules', 'byMonth', year, month],
      byDate: (date: string) => ['schedules', 'byDate', date],
    },
  },
  queryCachingOptions: {
    schedules: {
      staleTime: 0,
      gcTime: 0,
    },
  },
  cachingPolicies: {
    realtime: 0,
    standard: 0,
    stable: 0,
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

const mockedLogger = jest.requireMock('@/utils/logger').logger as {
  info: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  debug: jest.Mock;
};

function createMockSchedule(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'schedule-1',
    type: 'confirmed',
    date: '2024-02-15',
    startTime: null,
    endTime: null,
    jobPostingId: 'job-1',
    jobPostingName: 'Test job',
    location: 'Seoul',
    role: 'dealer',
    status: 'not_started',
    sourceCollection: 'workLogs',
    sourceId: 'worklog-1',
    createdAt: new Date('2024-02-10T00:00:00Z'),
    updatedAt: new Date('2024-02-10T00:00:00Z'),
    ...overrides,
  };
}

function createMockStats(): ScheduleStats {
  return {
    totalSchedules: 10,
    completedSchedules: 5,
    confirmedSchedules: 3,
    upcomingSchedules: 2,
    totalEarnings: 1000000,
    thisMonthEarnings: 500000,
    hoursWorked: 40,
  };
}

describe('useSchedules hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'staff-1' };
    mockQueryData = undefined;
    mockQueryError = null;
    mockIsLoading = false;
    mockIsRefetching = false;
    mockDataUpdatedAt = 0;
    mockInvalidateQueries.mockResolvedValue(undefined);
    mockSetQueryData.mockReset();
    mockCalculateScheduleStats.mockImplementation(() => createMockStats());
    mockRefetch.mockResolvedValue(undefined);

    mockUseQuery.mockImplementation(
      (options: { queryFn: () => Promise<unknown> | unknown; enabled?: boolean }) => {
        if (options.enabled === false) {
          return {
            data: undefined,
            dataUpdatedAt: 0,
            isLoading: false,
            isRefetching: false,
            error: null,
            refetch: mockRefetch,
          };
        }

        void Promise.resolve()
          .then(() => options.queryFn())
          .catch(() => undefined);

        return {
          data: mockQueryData,
          dataUpdatedAt: mockDataUpdatedAt,
          isLoading: mockIsLoading,
          isRefetching: mockIsRefetching,
          error: mockQueryError,
          refetch: mockRefetch,
        };
      }
    );

    mockGroupSchedulesByDate.mockImplementation((schedules: ScheduleEvent[]) => [
      {
        date: schedules[0]?.date ?? '2024-02-15',
        events: schedules,
      },
    ]);
    mockGetCalendarMarkedDates.mockImplementation((schedules: ScheduleEvent[]) =>
      schedules.reduce<Record<string, { marked: true }>>((acc, schedule) => {
        acc[schedule.date] = { marked: true };
        return acc;
      }, {})
    );
    mockGroupScheduleEvents.mockImplementation((schedules: unknown[]) => schedules);
    mockFilterSchedulesByDate.mockImplementation(
      (schedules: { date?: string }[] | undefined, selectedDate: string) =>
        (schedules ?? []).filter((schedule) => schedule.date === selectedDate)
    );
    mockSubscribeToSchedules.mockReturnValue(() => undefined);
  });

  describe('useSchedules', () => {
    it('returns list data, stats, and derived calendar state', async () => {
      const schedules = [createMockSchedule()];
      const stats = createMockStats();
      const groupedSchedules = [{ date: '2024-02-15', events: schedules }];
      const markedDates = { '2024-02-15': { marked: true } };

      mockQueryData = { schedules, stats };
      mockGroupSchedulesByDate.mockReturnValue(groupedSchedules);
      mockGetCalendarMarkedDates.mockReturnValue(markedDates);

      const { result } = renderHook(() => useSchedules());

      await waitFor(() => {
        expect(mockGetMySchedules).toHaveBeenCalledWith('staff-1', undefined);
      });

      expect(result.current.schedules).toEqual(schedules);
      expect(result.current.stats).toEqual(stats);
      expect(result.current.groupedSchedules).toEqual(groupedSchedules);
      expect(result.current.markedDates).toEqual(markedDates);
    });

    it('does not query when disabled', () => {
      const { result } = renderHook(() => useSchedules({ enabled: false }));

      expect(mockGetMySchedules).not.toHaveBeenCalled();
      expect(result.current.schedules).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('uses realtime subscription data when realtime mode is enabled', async () => {
      const realtimeSchedules = [createMockSchedule({ id: 'realtime-1' })];
      const unsubscribe = jest.fn();
      let onData: ((schedules: ScheduleEvent[]) => void) | undefined;

      mockSubscribeToSchedules.mockImplementation(
        (_staffId: string, next: (schedules: ScheduleEvent[]) => void) => {
          onData = next;
          return unsubscribe;
        }
      );

      const { result, unmount } = renderHook(() => useSchedules({ realtime: true }));

      await waitFor(() => {
        expect(mockSubscribeToSchedules).toHaveBeenCalled();
      });

      expect(mockGetMySchedules).not.toHaveBeenCalled();

      act(() => {
        onData?.(realtimeSchedules);
      });

      await waitFor(() => {
        expect(result.current.schedules).toEqual(realtimeSchedules);
      });

      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('replaces a pending-cancellation schedule with a cancelled realtime update after approval', async () => {
      const unsubscribe = jest.fn();
      let onData: ((schedules: ScheduleEvent[]) => void) | undefined;

      mockSubscribeToSchedules.mockImplementation(
        (_staffId: string, next: (schedules: ScheduleEvent[]) => void) => {
          onData = next;
          return unsubscribe;
        }
      );

      const { result } = renderHook(() => useSchedules({ realtime: true }));

      await waitFor(() => {
        expect(mockSubscribeToSchedules).toHaveBeenCalled();
      });

      act(() => {
        onData?.([createMockSchedule({ id: 'schedule-1', isCancellationPending: true })]);
      });

      await waitFor(() => {
        expect(result.current.schedules[0]).toMatchObject({
          id: 'schedule-1',
          type: 'confirmed',
          isCancellationPending: true,
        });
      });

      act(() => {
        onData?.([createMockSchedule({ id: 'schedule-1', type: 'cancelled' })]);
      });

      await waitFor(() => {
        expect(result.current.schedules[0]).toMatchObject({
          id: 'schedule-1',
          type: 'cancelled',
        });
      });

      expect(result.current.schedules[0]?.isCancellationPending).toBeUndefined();
    });

    it('restores a confirmed schedule after rejection clears the pending flag', async () => {
      const unsubscribe = jest.fn();
      let onData: ((schedules: ScheduleEvent[]) => void) | undefined;

      mockSubscribeToSchedules.mockImplementation(
        (_staffId: string, next: (schedules: ScheduleEvent[]) => void) => {
          onData = next;
          return unsubscribe;
        }
      );

      const { result } = renderHook(() => useSchedules({ realtime: true }));

      await waitFor(() => {
        expect(mockSubscribeToSchedules).toHaveBeenCalled();
      });

      act(() => {
        onData?.([createMockSchedule({ id: 'schedule-1', isCancellationPending: true })]);
      });

      await waitFor(() => {
        expect(result.current.schedules[0]?.isCancellationPending).toBe(true);
      });

      act(() => {
        onData?.([createMockSchedule({ id: 'schedule-1', type: 'confirmed' })]);
      });

      await waitFor(() => {
        expect(result.current.schedules[0]).toMatchObject({
          id: 'schedule-1',
          type: 'confirmed',
        });
      });

      expect(result.current.schedules[0]?.isCancellationPending).toBeUndefined();
    });

    it('writes the canonical schedule cache payload with derived calendar data', async () => {
      const schedules = [createMockSchedule()];
      const stats = createMockStats();
      const groupedSchedules = [{ date: '2024-02-15', events: schedules }];
      const markedDates = { '2024-02-15': { marked: true } };

      mockQueryData = { schedules, stats };
      mockGroupSchedulesByDate.mockReturnValue(groupedSchedules);
      mockGetCalendarMarkedDates.mockReturnValue(markedDates);

      renderHook(() => useSchedules());

      await waitFor(() => {
        expect(mockSetCriticalOfflineCache).toHaveBeenCalledWith(
          'schedules:staff-1:list:{}',
          expect.objectContaining({
            schedules,
            stats,
            groupedSchedules,
            markedDates,
          }),
          expect.objectContaining({
            userId: 'staff-1',
            schemaVersion: 3,
          })
        );
      });
    });

    it('refresh invalidates schedule queries without a duplicate manual refetch', async () => {
      mockQueryData = { schedules: [], stats: createMockStats() };

      const { result } = renderHook(() => useSchedules());

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['schedules'],
      });
      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it('exposes query loading and error state', () => {
      const queryError = new Error('network');
      mockIsLoading = true;
      mockIsRefetching = true;
      mockQueryError = queryError;

      const { result } = renderHook(() => useSchedules());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isRefreshing).toBe(true);
      expect(result.current.error).toBe(queryError);
    });
  });

  describe('useSchedulesByMonth', () => {
    it('returns monthly schedules and invalidates month-scoped cache on refresh', async () => {
      const schedules = [createMockSchedule()];
      const stats = createMockStats();

      mockQueryData = { schedules, stats };

      const { result } = renderHook(() => useSchedulesByMonth({ year: 2024, month: 2 }));

      await waitFor(() => {
        expect(mockGetSchedulesByMonth).toHaveBeenCalledWith('staff-1', 2024, 2);
      });

      expect(result.current.schedules).toEqual(schedules);
      expect(result.current.stats).toEqual(stats);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['schedules', 'byMonth', 2024, 2],
      });
    });

    it('does not query monthly schedules when disabled', () => {
      const { result } = renderHook(() =>
        useSchedulesByMonth({ year: 2024, month: 2, enabled: false })
      );

      expect(mockGetSchedulesByMonth).not.toHaveBeenCalled();
      expect(result.current.schedules).toEqual([]);
    });

    it('uses query data as a bootstrap payload before the realtime month subscription responds', async () => {
      const schedules = [createMockSchedule({ id: 'query-schedule-1' })];
      const stats = createMockStats();
      const unsubscribe = jest.fn();

      mockQueryData = { schedules, stats };
      mockDataUpdatedAt = 1;
      mockSubscribeToSchedules.mockReturnValue(unsubscribe);

      const { result, unmount } = renderHook(() =>
        useSchedulesByMonth({ year: 2024, month: 2, realtime: true })
      );

      await waitFor(() => {
        expect(mockGetSchedulesByMonth).toHaveBeenCalledWith('staff-1', 2024, 2);
      });

      await waitFor(() => {
        expect(mockSubscribeToSchedules).toHaveBeenCalledWith(
          'staff-1',
          expect.any(Function),
          expect.any(Function)
        );
      });

      expect(result.current.schedules).toEqual(schedules);
      expect(result.current.stats).toEqual(stats);
      expect(result.current.isLoading).toBe(false);

      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('prefers newer query results after realtime has already emitted once', async () => {
      const bootstrapSchedules = [createMockSchedule({ id: 'query-schedule-1' })];
      const realtimeSchedules = [createMockSchedule({ id: 'realtime-schedule-1' })];
      const refreshedSchedules = [createMockSchedule({ id: 'query-schedule-2' })];
      let onData: ((schedules: ScheduleEvent[]) => void) | undefined;

      mockQueryData = { schedules: bootstrapSchedules, stats: createMockStats() };
      mockDataUpdatedAt = 1;
      mockSubscribeToSchedules.mockImplementation(
        (_staffId: string, next: (schedules: ScheduleEvent[]) => void) => {
          onData = next;
          return jest.fn();
        }
      );

      const { result, rerender } = renderHook(() =>
        useSchedulesByMonth({ year: 2024, month: 2, realtime: true })
      );

      await waitFor(() => {
        expect(result.current.schedules).toEqual(bootstrapSchedules);
      });

      act(() => {
        onData?.(realtimeSchedules);
      });

      await waitFor(() => {
        expect(result.current.schedules).toEqual(realtimeSchedules);
      });

      mockQueryData = { schedules: refreshedSchedules, stats: createMockStats() };
      mockDataUpdatedAt = Number.MAX_SAFE_INTEGER;

      rerender(undefined);

      await waitFor(() => {
        expect(result.current.schedules).toEqual(refreshedSchedules);
      });
    });

    it('logs filtered realtime snapshot counts for the visible month', async () => {
      let onData: ((schedules: ScheduleEvent[]) => void) | undefined;

      mockSubscribeToSchedules.mockImplementation(
        (_staffId: string, next: (schedules: ScheduleEvent[]) => void) => {
          onData = next;
          return jest.fn();
        }
      );

      renderHook(() => useSchedulesByMonth({ year: 2024, month: 2, realtime: true }));

      act(() => {
        onData?.([
          createMockSchedule({ id: 'feb-1', date: '2024-02-10' }),
          createMockSchedule({ id: 'mar-1', date: '2024-03-01' }),
        ]);
      });

      await waitFor(() => {
        expect(mockedLogger.info).toHaveBeenCalledWith('schedule_month_realtime_snapshot_count', {
          listener: 'schedules_by_month',
          year: 2024,
          month: 2,
          count: 1,
          limit: 50,
        });
      });

      expect(mockedLogger.warn).not.toHaveBeenCalledWith(
        'schedule_month_realtime_limit_reached',
        expect.anything()
      );
    });

    it('warns once when the filtered realtime month data reaches the limit', async () => {
      let onData: ((schedules: ScheduleEvent[]) => void) | undefined;
      const limitReachedSchedules = Array.from({ length: 50 }, (_, index) =>
        createMockSchedule({
          id: `schedule-${index + 1}`,
          date: `2024-02-${String((index % 28) + 1).padStart(2, '0')}`,
        })
      );

      mockSubscribeToSchedules.mockImplementation(
        (_staffId: string, next: (schedules: ScheduleEvent[]) => void) => {
          onData = next;
          return jest.fn();
        }
      );

      renderHook(() => useSchedulesByMonth({ year: 2024, month: 2, realtime: true }));

      act(() => {
        onData?.(limitReachedSchedules);
        onData?.(limitReachedSchedules);
      });

      await waitFor(() => {
        expect(mockedLogger.warn).toHaveBeenCalledWith('schedule_month_realtime_limit_reached', {
          listener: 'schedules_by_month',
          year: 2024,
          month: 2,
          count: 50,
          limit: 50,
        });
      });

      expect(
        mockedLogger.warn.mock.calls.filter(
          ([message]: [string]) => message === 'schedule_month_realtime_limit_reached'
        )
      ).toHaveLength(1);
    });
  });

  describe('simple query hooks', () => {
    it('loads schedules by date', async () => {
      const schedules = [createMockSchedule()];
      mockQueryData = schedules;

      const { result } = renderHook(() => useSchedulesByDate('2024-02-15'));

      await waitFor(() => {
        expect(mockGetSchedulesByDate).toHaveBeenCalledWith('staff-1', '2024-02-15');
      });

      expect(result.current.schedules).toEqual(schedules);
    });

    it('skips schedules-by-date queries when date is missing or disabled', () => {
      renderHook(() => useSchedulesByDate('', true));
      renderHook(() => useSchedulesByDate('2024-02-15', false));

      expect(mockGetSchedulesByDate).not.toHaveBeenCalled();
    });

    it('loads schedule detail', async () => {
      const schedule = createMockSchedule();
      mockQueryData = schedule;

      const { result } = renderHook(() => useScheduleDetail('schedule-1'));

      await waitFor(() => {
        expect(mockGetScheduleById).toHaveBeenCalledWith('schedule-1');
      });

      expect(result.current.schedule).toEqual(schedule);
    });

    it('loads today schedules', async () => {
      const schedules = [createMockSchedule()];
      mockQueryData = schedules;

      const { result } = renderHook(() => useTodaySchedules());

      await waitFor(() => {
        expect(mockGetTodaySchedules).toHaveBeenCalledWith('staff-1');
      });

      expect(result.current.schedules).toEqual(schedules);
    });
  });

  // Phase 2A.후속 PR3-D 검증 (2026-05-10):
  // useSchedulesByMonth 는 staff-only scope.
  // queryKey 가 staffId 만 포함하고 workspace/employer dimension 이 없음을 잠금.
  // service call 도 staffId 단일 인자 (workspace/owner 인자 없음).
  describe('staff-only scope contract (PR3-D)', () => {
    it('useSchedulesByMonth query key contains staffId and no workspace dimension', () => {
      mockQueryData = { schedules: [], stats: createMockStats() };

      renderHook(() => useSchedulesByMonth({ year: 2024, month: 2 }));

      const monthCall = mockUseQuery.mock.calls.find((call) => {
        const opts = call[0] as { queryKey: readonly unknown[] };
        return Array.isArray(opts.queryKey) && opts.queryKey[1] === 'byMonth';
      });
      const queryOptions = monthCall?.[0] as { queryKey: readonly unknown[] } | undefined;
      expect(queryOptions?.queryKey).toEqual(['schedules', 'byMonth', 2024, 2, 'staff-1']);
      expect(queryOptions?.queryKey).toHaveLength(5);
    });

    it('useSchedulesByMonth queryFn calls service with (staffId, year, month) only', async () => {
      mockQueryData = { schedules: [], stats: createMockStats() };

      renderHook(() => useSchedulesByMonth({ year: 2024, month: 2 }));

      await waitFor(() => {
        expect(mockGetSchedulesByMonth).toHaveBeenCalled();
      });
      expect(mockGetSchedulesByMonth).toHaveBeenCalledWith('staff-1', 2024, 2);
      expect(mockGetSchedulesByMonth.mock.calls[0]).toHaveLength(3);
    });
  });

  describe('useCalendarView', () => {
    it('builds grouped calendar state from monthly schedules', async () => {
      const schedules = [
        createMockSchedule({ id: 'schedule-1', date: '2024-02-15' }),
        createMockSchedule({ id: 'schedule-2', date: '2024-02-16' }),
      ];
      const stats = createMockStats();
      const groupedByApplication = [{ id: 'group-1' }];
      const selectedSchedules = [schedules[0]];

      mockQueryData = { schedules, stats };
      mockGroupScheduleEvents.mockReturnValue(groupedByApplication);
      mockFilterSchedulesByDate.mockReturnValue(selectedSchedules);

      const { result } = renderHook(() => useCalendarView({ initialView: 'week' }));

      await waitFor(() => {
        expect(mockGetSchedulesByMonth).toHaveBeenCalled();
      });

      expect(result.current.view).toBe('week');
      expect(result.current.schedules).toEqual(schedules);
      expect(result.current.groupedByApplication).toEqual(groupedByApplication);
      expect(result.current.selectedDateSchedules).toEqual(selectedSchedules);
      expect(mockGroupScheduleEvents).toHaveBeenCalledWith(schedules, {
        enabled: true,
        minGroupSize: 2,
      });
    });

    it('exposes the partial-fetch warning produced by the schedule service', async () => {
      const schedules = [createMockSchedule({ date: '2024-02-15' })];

      mockQueryData = {
        schedules,
        stats: createMockStats(),
        warning: '일부 근무 기록을 불러오지 못했습니다',
      };

      const { result } = renderHook(() => useCalendarView());

      await waitFor(() => {
        expect(mockGetSchedulesByMonth).toHaveBeenCalled();
      });

      expect(result.current.warning).toBe('일부 근무 기록을 불러오지 못했습니다');
    });

    it('leaves warning undefined when the service reports no partial failure', async () => {
      mockQueryData = { schedules: [createMockSchedule()], stats: createMockStats() };

      const { result } = renderHook(() => useCalendarView());

      await waitFor(() => {
        expect(mockGetSchedulesByMonth).toHaveBeenCalled();
      });

      expect(result.current.warning).toBeUndefined();
    });

    it('uses raw schedules when grouping is disabled', async () => {
      const schedules = [createMockSchedule({ date: '2024-02-15' })];

      mockQueryData = { schedules, stats: createMockStats() };

      const { result } = renderHook(() => useCalendarView({ enableGrouping: false }));

      await waitFor(() => {
        expect(mockGetSchedulesByMonth).toHaveBeenCalled();
      });

      expect(mockGroupScheduleEvents).not.toHaveBeenCalled();
      expect(result.current.groupedByApplication).toEqual(schedules);
      expect(result.current.selectedDateSchedulesRaw).toEqual([]);
    });

    it('updates view state and month navigation actions', () => {
      mockQueryData = { schedules: [], stats: createMockStats() };

      const { result } = renderHook(() => useCalendarView('month' as CalendarView));

      act(() => {
        result.current.setView('day');
        result.current.setSelectedDate('2024-02-20');
        result.current.goToMonth(2025, 6);
      });

      expect(result.current.view).toBe('day');
      expect(result.current.currentMonth).toEqual({ year: 2025, month: 6 });
      // 월을 옮기면 선택 날짜도 그 달로 따라간다. 예전처럼 '2024-02-20' 에 남으면
      // 캘린더에 점은 찍혔는데 아래 목록은 비고 선택 표시도 사라져,
      // 지난달 기록을 보러 온 사용자가 "기록이 사라졌다"고 오해한다.
      expect(result.current.selectedDate).toBe('2025-06-01');

      act(() => {
        result.current.goToPrevMonth();
      });

      expect(result.current.currentMonth).toEqual({ year: 2025, month: 5 });

      act(() => {
        result.current.goToNextMonth();
      });

      expect(result.current.currentMonth).toEqual({ year: 2025, month: 6 });

      act(() => {
        result.current.goToToday();
      });

      const today = new Date();
      expect(result.current.currentMonth).toEqual({
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      });
    });

    // 자동 재정렬이 사용자의 명시적 선택을 덮으면, 날짜를 탭할 때마다 되돌아가 버린다.
    it('사용자가 직접 고른 날짜는 같은 달 안에서 유지된다', () => {
      mockQueryData = { schedules: [], stats: createMockStats() };

      const { result } = renderHook(() => useCalendarView('month' as CalendarView));

      act(() => {
        result.current.goToMonth(2025, 6);
      });
      expect(result.current.selectedDate).toBe('2025-06-01');

      act(() => {
        result.current.setSelectedDate('2025-06-14');
      });
      expect(result.current.selectedDate).toBe('2025-06-14');
    });
  });
});
