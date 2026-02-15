/**
 * UNIQN Mobile - useSchedules Hook Tests
 *
 * @description Unit tests for schedule management hooks
 * @version 1.0.0
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ScheduleEvent, ScheduleStats, CalendarView } from '@/types';

// ============================================================================
// Mock Services
// ============================================================================

const mockGetMySchedules = jest.fn();
const mockGetSchedulesByMonth = jest.fn();
const mockGetSchedulesByDate = jest.fn();
const mockGetScheduleById = jest.fn();
const mockGetTodaySchedules = jest.fn();
const mockGetUpcomingSchedules = jest.fn();
const mockGetScheduleStats = jest.fn();
const mockSubscribeToSchedules = jest.fn();
const mockGroupSchedulesByDate = jest.fn();
const mockGetCalendarMarkedDates = jest.fn();

jest.mock('@/services/scheduleService', () => ({
  getMySchedules: (...args: unknown[]) => mockGetMySchedules(...args),
  getSchedulesByMonth: (...args: unknown[]) => mockGetSchedulesByMonth(...args),
  getSchedulesByDate: (...args: unknown[]) => mockGetSchedulesByDate(...args),
  getScheduleById: (...args: unknown[]) => mockGetScheduleById(...args),
  getTodaySchedules: (...args: unknown[]) => mockGetTodaySchedules(...args),
  getUpcomingSchedules: (...args: unknown[]) => mockGetUpcomingSchedules(...args),
  getScheduleStats: (...args: unknown[]) => mockGetScheduleStats(...args),
  subscribeToSchedules: (...args: unknown[]) => mockSubscribeToSchedules(...args),
  groupSchedulesByDate: (...args: unknown[]) => mockGroupSchedulesByDate(...args),
  getCalendarMarkedDates: (...args: unknown[]) => mockGetCalendarMarkedDates(...args),
}));

// ============================================================================
// Mock Utils
// ============================================================================

const mockGroupScheduleEvents = jest.fn();
const mockFilterSchedulesByDate = jest.fn();

jest.mock('@/utils/scheduleGrouping', () => ({
  groupScheduleEvents: (...args: unknown[]) => mockGroupScheduleEvents(...args),
  filterSchedulesByDate: (...args: unknown[]) => mockFilterSchedulesByDate(...args),
}));

jest.mock('@/utils/queryUtils', () => ({
  stableFilters: (filters: unknown) => filters,
}));

// ============================================================================
// Mock Auth Store
// ============================================================================

const mockUser = { uid: 'staff-1' };

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: typeof mockUser }) => unknown) =>
    selector ? selector({ user: mockUser }) : { user: mockUser },
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
// Mock Errors
// ============================================================================

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

jest.mock('@/errors', () => ({
  AuthError: MockAuthError,
  ERROR_CODES: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createMockSchedule(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'schedule-1',
    type: 'confirmed',
    date: '2024-02-15',
    startTime: null,
    endTime: null,
    jobPostingId: 'job-1',
    jobPostingName: '테스트 공고',
    location: '서울 강남구',
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

// ============================================================================
// Mock Query Client
// ============================================================================

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
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
  cachingPolicies: {
    realtime: 0,
    standard: 5 * 60 * 1000,
  },
}));

// ============================================================================
// Import Hooks After Mocks
// ============================================================================

import {
  useSchedules,
  useSchedulesByMonth,
  useSchedulesByDate,
  useScheduleDetail,
  useTodaySchedules,
  useUpcomingSchedules,
  useScheduleStats,
  useCalendarView,
} from '@/hooks/useSchedules';

// ============================================================================
// Tests
// ============================================================================

describe('useSchedules Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // ==========================================================================
  // useSchedules
  // ==========================================================================

  describe('useSchedules', () => {
    it('스케줄 목록을 조회해야 함', async () => {
      const mockSchedules = [createMockSchedule()];
      const mockStats = createMockStats();

      mockGetMySchedules.mockResolvedValueOnce({
        schedules: mockSchedules,
        stats: mockStats,
      });
      mockGroupSchedulesByDate.mockReturnValueOnce([]);
      mockGetCalendarMarkedDates.mockReturnValueOnce({});

      const { result } = renderHook(() => useSchedules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.schedules).toEqual(mockSchedules);
      });

      expect(result.current.stats).toEqual(mockStats);
      expect(mockGetMySchedules).toHaveBeenCalledWith('staff-1', undefined);
    });

    it('필터를 적용하여 조회해야 함', async () => {
      const filters = {
        dateRange: { start: '2024-02-01', end: '2024-02-29' },
        type: 'confirmed' as const,
      };

      mockGetMySchedules.mockResolvedValueOnce({
        schedules: [],
        stats: createMockStats(),
      });
      mockGroupSchedulesByDate.mockReturnValueOnce([]);
      mockGetCalendarMarkedDates.mockReturnValueOnce({});

      renderHook(() => useSchedules({ filters }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetMySchedules).toHaveBeenCalledWith('staff-1', filters);
      });
    });

    it('enabled가 false이면 조회하지 않아야 함', async () => {
      renderHook(() => useSchedules({ enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetMySchedules).not.toHaveBeenCalled();
      });
    });

    it('날짜별 그룹화를 수행해야 함', async () => {
      const mockSchedules = [createMockSchedule()];
      const mockGrouped = [
        {
          date: '2024-02-15',
          formattedDate: '2월 15일 (목)',
          events: mockSchedules,
          isToday: false,
          isPast: false,
        },
      ];

      mockGetMySchedules.mockResolvedValueOnce({
        schedules: mockSchedules,
        stats: createMockStats(),
      });
      mockGroupSchedulesByDate.mockReturnValueOnce(mockGrouped);
      mockGetCalendarMarkedDates.mockReturnValueOnce({});

      const { result } = renderHook(() => useSchedules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.groupedSchedules).toEqual(mockGrouped);
      });

      expect(mockGroupSchedulesByDate).toHaveBeenCalledWith(mockSchedules);
    });

    it('캘린더 마킹 데이터를 생성해야 함', async () => {
      const mockSchedules = [createMockSchedule()];
      const mockMarkedDates = {
        '2024-02-15': { marked: true, dotColor: '#22c55e', type: 'confirmed' as const },
      };

      mockGetMySchedules.mockResolvedValueOnce({
        schedules: mockSchedules,
        stats: createMockStats(),
      });
      mockGroupSchedulesByDate.mockReturnValueOnce([]);
      mockGetCalendarMarkedDates.mockReturnValueOnce(mockMarkedDates);

      const { result } = renderHook(() => useSchedules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.markedDates).toEqual(mockMarkedDates);
      });

      expect(mockGetCalendarMarkedDates).toHaveBeenCalledWith(mockSchedules);
    });

    it('로딩 상태를 올바르게 반환해야 함', async () => {
      mockGetMySchedules.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useSchedules(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('에러를 올바르게 처리해야 함', async () => {
      const mockError = new Error('네트워크 에러');
      mockGetMySchedules.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useSchedules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    it('refresh 함수를 제공해야 함', async () => {
      mockGetMySchedules.mockResolvedValue({
        schedules: [],
        stats: createMockStats(),
      });
      mockGroupSchedulesByDate.mockReturnValue([]);
      mockGetCalendarMarkedDates.mockReturnValue({});

      const { result } = renderHook(() => useSchedules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.refresh).toBeDefined();
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockGetMySchedules).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useSchedulesByMonth
  // ==========================================================================

  describe('useSchedulesByMonth', () => {
    it('월별 스케줄을 조회해야 함', async () => {
      const mockSchedules = [createMockSchedule()];
      const mockStats = createMockStats();

      mockGetSchedulesByMonth.mockResolvedValueOnce({
        schedules: mockSchedules,
        stats: mockStats,
      });
      mockGroupSchedulesByDate.mockReturnValueOnce([]);
      mockGetCalendarMarkedDates.mockReturnValueOnce({});

      const { result } = renderHook(() => useSchedulesByMonth({ year: 2024, month: 2 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.schedules).toEqual(mockSchedules);
      });

      expect(mockGetSchedulesByMonth).toHaveBeenCalledWith('staff-1', 2024, 2);
    });

    it('enabled가 false이면 조회하지 않아야 함', async () => {
      renderHook(() => useSchedulesByMonth({ year: 2024, month: 2, enabled: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetSchedulesByMonth).not.toHaveBeenCalled();
      });
    });

    it('refresh 함수를 제공해야 함', async () => {
      mockGetSchedulesByMonth.mockResolvedValue({
        schedules: [],
        stats: createMockStats(),
      });
      mockGroupSchedulesByDate.mockReturnValue([]);
      mockGetCalendarMarkedDates.mockReturnValue({});

      const { result } = renderHook(() => useSchedulesByMonth({ year: 2024, month: 2 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.refresh).toBeDefined();
      });

      await act(async () => {
        await result.current.refresh();
      });
    });
  });

  // ==========================================================================
  // useSchedulesByDate
  // ==========================================================================

  describe('useSchedulesByDate', () => {
    it('특정 날짜 스케줄을 조회해야 함', async () => {
      const mockSchedules = [createMockSchedule()];
      mockGetSchedulesByDate.mockResolvedValueOnce(mockSchedules);

      const { result } = renderHook(() => useSchedulesByDate('2024-02-15'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.schedules).toEqual(mockSchedules);
      });

      expect(mockGetSchedulesByDate).toHaveBeenCalledWith('staff-1', '2024-02-15');
    });

    it('enabled가 false이면 조회하지 않아야 함', async () => {
      renderHook(() => useSchedulesByDate('2024-02-15', false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetSchedulesByDate).not.toHaveBeenCalled();
      });
    });

    it('date가 없으면 조회하지 않아야 함', async () => {
      renderHook(() => useSchedulesByDate(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetSchedulesByDate).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // useScheduleDetail
  // ==========================================================================

  describe('useScheduleDetail', () => {
    it('스케줄 상세를 조회해야 함', async () => {
      const mockSchedule = createMockSchedule();
      mockGetScheduleById.mockResolvedValueOnce(mockSchedule);

      const { result } = renderHook(() => useScheduleDetail('schedule-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.schedule).toEqual(mockSchedule);
      });

      expect(mockGetScheduleById).toHaveBeenCalledWith('schedule-1');
    });

    it('enabled가 false이면 조회하지 않아야 함', async () => {
      renderHook(() => useScheduleDetail('schedule-1', false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetScheduleById).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // useTodaySchedules
  // ==========================================================================

  describe('useTodaySchedules', () => {
    it('오늘 스케줄을 조회해야 함', async () => {
      const mockSchedules = [createMockSchedule()];
      mockGetTodaySchedules.mockResolvedValueOnce(mockSchedules);

      const { result } = renderHook(() => useTodaySchedules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.schedules).toEqual(mockSchedules);
      });

      expect(mockGetTodaySchedules).toHaveBeenCalledWith('staff-1');
    });

    it('enabled가 false이면 조회하지 않아야 함', async () => {
      renderHook(() => useTodaySchedules(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetTodaySchedules).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // useUpcomingSchedules
  // ==========================================================================

  describe('useUpcomingSchedules', () => {
    it('다가오는 스케줄을 조회해야 함 (기본 7일)', async () => {
      const mockSchedules = [createMockSchedule()];
      mockGetUpcomingSchedules.mockResolvedValueOnce(mockSchedules);

      const { result } = renderHook(() => useUpcomingSchedules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.schedules).toEqual(mockSchedules);
      });

      expect(mockGetUpcomingSchedules).toHaveBeenCalledWith('staff-1', 7);
    });

    it('커스텀 일수로 조회해야 함', async () => {
      const mockSchedules = [createMockSchedule()];
      mockGetUpcomingSchedules.mockResolvedValueOnce(mockSchedules);

      renderHook(() => useUpcomingSchedules(14), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetUpcomingSchedules).toHaveBeenCalledWith('staff-1', 14);
      });
    });
  });

  // ==========================================================================
  // useScheduleStats
  // ==========================================================================

  describe('useScheduleStats', () => {
    it('스케줄 통계를 조회해야 함', async () => {
      const mockStats = createMockStats();
      mockGetScheduleStats.mockResolvedValueOnce(mockStats);

      const { result } = renderHook(() => useScheduleStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.stats).toEqual(mockStats);
      });

      expect(mockGetScheduleStats).toHaveBeenCalledWith('staff-1');
    });

    it('enabled가 false이면 조회하지 않아야 함', async () => {
      renderHook(() => useScheduleStats(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGetScheduleStats).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // useCalendarView
  // ==========================================================================

  describe('useCalendarView', () => {
    beforeEach(() => {
      mockGetSchedulesByMonth.mockResolvedValue({
        schedules: [],
        stats: createMockStats(),
      });
      mockGroupSchedulesByDate.mockReturnValue([]);
      mockGetCalendarMarkedDates.mockReturnValue({});
      mockGroupScheduleEvents.mockReturnValue([]);
      mockFilterSchedulesByDate.mockReturnValue([]);
    });

    it('초기 상태를 올바르게 설정해야 함', async () => {
      const { result } = renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.view).toBe('month');
      });

      expect(result.current.selectedDate).toBeTruthy();
      expect(result.current.currentMonth).toMatchObject({
        year: expect.any(Number),
        month: expect.any(Number),
      });
    });

    it('커스텀 초기 뷰를 설정할 수 있어야 함', async () => {
      const { result } = renderHook(() => useCalendarView({ initialView: 'week' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.view).toBe('week');
      });
    });

    it('뷰 타입을 변경할 수 있어야 함', async () => {
      const { result } = renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.setView).toBeDefined();
      });

      act(() => {
        result.current.setView('day');
      });

      expect(result.current.view).toBe('day');
    });

    it('날짜를 선택할 수 있어야 함', async () => {
      const { result } = renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.setSelectedDate).toBeDefined();
      });

      act(() => {
        result.current.setSelectedDate('2024-02-20');
      });

      expect(result.current.selectedDate).toBe('2024-02-20');
    });

    it('이전 월로 이동할 수 있어야 함', async () => {
      const { result } = renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.goToPrevMonth).toBeDefined();
      });

      const initialMonth = result.current.currentMonth.month;
      const initialYear = result.current.currentMonth.year;

      act(() => {
        result.current.goToPrevMonth();
      });

      if (initialMonth === 1) {
        expect(result.current.currentMonth.month).toBe(12);
        expect(result.current.currentMonth.year).toBe(initialYear - 1);
      } else {
        expect(result.current.currentMonth.month).toBe(initialMonth - 1);
      }
    });

    it('다음 월로 이동할 수 있어야 함', async () => {
      const { result } = renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.goToNextMonth).toBeDefined();
      });

      const initialMonth = result.current.currentMonth.month;
      const initialYear = result.current.currentMonth.year;

      act(() => {
        result.current.goToNextMonth();
      });

      if (initialMonth === 12) {
        expect(result.current.currentMonth.month).toBe(1);
        expect(result.current.currentMonth.year).toBe(initialYear + 1);
      } else {
        expect(result.current.currentMonth.month).toBe(initialMonth + 1);
      }
    });

    it('오늘로 이동할 수 있어야 함', async () => {
      const { result } = renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.goToToday).toBeDefined();
      });

      act(() => {
        result.current.goToToday();
      });

      const today = new Date();
      expect(result.current.currentMonth.year).toBe(today.getFullYear());
      expect(result.current.currentMonth.month).toBe(today.getMonth() + 1);
    });

    it('특정 월로 이동할 수 있어야 함', async () => {
      const { result } = renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.goToMonth).toBeDefined();
      });

      act(() => {
        result.current.goToMonth(2025, 6);
      });

      expect(result.current.currentMonth.year).toBe(2025);
      expect(result.current.currentMonth.month).toBe(6);
    });

    it('그룹핑이 활성화되어 있어야 함 (기본값)', async () => {
      const mockSchedules = [createMockSchedule()];
      mockGetSchedulesByMonth.mockResolvedValueOnce({
        schedules: mockSchedules,
        stats: createMockStats(),
      });

      renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGroupScheduleEvents).toHaveBeenCalledWith(mockSchedules, {
          enabled: true,
          minGroupSize: 2,
        });
      });
    });

    it('그룹핑을 비활성화할 수 있어야 함', async () => {
      const mockSchedules = [createMockSchedule()];
      mockGetSchedulesByMonth.mockResolvedValueOnce({
        schedules: mockSchedules,
        stats: createMockStats(),
      });

      const { result } = renderHook(() => useCalendarView({ enableGrouping: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockGroupScheduleEvents).not.toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.groupedByApplication).toEqual(mockSchedules);
      });
    });

    it('선택된 날짜의 스케줄을 필터링해야 함', async () => {
      const mockSchedules = [createMockSchedule({ date: '2024-02-15' })];
      mockGetSchedulesByMonth.mockResolvedValueOnce({
        schedules: mockSchedules,
        stats: createMockStats(),
      });
      mockGroupScheduleEvents.mockReturnValueOnce(mockSchedules);
      mockFilterSchedulesByDate.mockReturnValueOnce(mockSchedules);

      const { result } = renderHook(() => useCalendarView(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.setSelectedDate).toBeDefined();
      });

      act(() => {
        result.current.setSelectedDate('2024-02-15');
      });

      await waitFor(() => {
        expect(mockFilterSchedulesByDate).toHaveBeenCalled();
      });
    });

    it('하위 호환성: 문자열 뷰 타입을 허용해야 함', async () => {
      const { result } = renderHook(() => useCalendarView('week' as CalendarView), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.view).toBe('week');
      });
    });
  });
});
