/**
 * UNIQN Mobile - 스케줄 훅
 *
 * @description TanStack Query 기반 스케줄 조회 훅
 * @version 1.0.0
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMySchedules,
  getSchedulesByMonth,
  getSchedulesByDate,
  getScheduleById,
  getTodaySchedules,
  getUpcomingSchedules,
  getScheduleStats,
  subscribeToSchedules,
  groupSchedulesByDate,
  getCalendarMarkedDates,
} from '@/services/scheduleService';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { logger } from '@/utils/logger';
import {
  groupScheduleEvents,
  filterSchedulesByDate,
} from '@/utils/scheduleGrouping';
import type {
  ScheduleEvent,
  ScheduleFilters,
  CalendarView,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

interface UseSchedulesOptions {
  filters?: ScheduleFilters;
  enabled?: boolean;
  realtime?: boolean;
}

interface UseSchedulesByMonthOptions {
  year: number;
  month: number;
  enabled?: boolean;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 내 스케줄 목록 조회 훅
 */
export function useSchedules(options: UseSchedulesOptions = {}) {
  const { filters, enabled = true, realtime = false } = options;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  // 실시간 구독 상태
  const [realtimeSchedules, setRealtimeSchedules] = useState<ScheduleEvent[]>([]);

  const query = useQuery({
    queryKey: queryKeys.schedules.list(filters ? JSON.parse(JSON.stringify(filters)) : {}),
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getMySchedules(staffId, filters);
    },
    enabled: enabled && !!staffId && !realtime,
    staleTime: cachingPolicies.frequent,
    gcTime: cachingPolicies.standard,
  });

  // 실시간 구독
  useEffect(() => {
    if (!realtime || !staffId) return;

    const unsubscribe = subscribeToSchedules(
      staffId,
      (schedules) => {
        setRealtimeSchedules(schedules);
      },
      (error) => {
        logger.error('스케줄 실시간 구독 에러', error);
      }
    );

    return () => unsubscribe();
  }, [realtime, staffId]);

  // 스케줄 데이터 (실시간 또는 쿼리)
  const schedules = useMemo(
    () => (realtime ? realtimeSchedules : query.data?.schedules ?? []),
    [realtime, realtimeSchedules, query.data?.schedules]
  );
  const stats = query.data?.stats;

  // 날짜별 그룹화
  const groupedSchedules = useMemo(() => groupSchedulesByDate(schedules), [schedules]);

  // 캘린더 마킹 데이터
  const markedDates = useMemo(() => getCalendarMarkedDates(schedules), [schedules]);

  // 리프레시
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.schedules.all,
    });
    await query.refetch();
  }, [queryClient, query]);

  return {
    schedules,
    groupedSchedules,
    markedDates,
    stats,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    error: query.error,
    refresh,
  };
}

/**
 * 월별 스케줄 조회 훅
 */
export function useSchedulesByMonth(options: UseSchedulesByMonthOptions) {
  const { year, month, enabled = true } = options;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: queryKeys.schedules.byMonth(year, month),
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getSchedulesByMonth(staffId, year, month);
    },
    enabled: enabled && !!staffId,
    staleTime: cachingPolicies.frequent,
  });

  const schedules = useMemo(
    () => query.data?.schedules ?? [],
    [query.data?.schedules]
  );
  const stats = query.data?.stats;

  // 날짜별 그룹화
  const groupedSchedules = useMemo(() => groupSchedulesByDate(schedules), [schedules]);

  // 캘린더 마킹 데이터
  const markedDates = useMemo(() => getCalendarMarkedDates(schedules), [schedules]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.schedules.byMonth(year, month),
    });
  }, [queryClient, year, month]);

  return {
    schedules,
    groupedSchedules,
    markedDates,
    stats,
    isLoading: query.isLoading,
    error: query.error,
    refresh,
  };
}

/**
 * 특정 날짜 스케줄 조회 훅
 */
export function useSchedulesByDate(date: string, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: queryKeys.schedules.byDate(date),
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getSchedulesByDate(staffId, date);
    },
    enabled: enabled && !!staffId && !!date,
    staleTime: cachingPolicies.frequent,
  });

  return {
    schedules: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 스케줄 상세 조회 훅
 */
export function useScheduleDetail(scheduleId: string, enabled = true) {
  const query = useQuery({
    queryKey: [...queryKeys.schedules.all, 'detail', scheduleId],
    queryFn: () => getScheduleById(scheduleId),
    enabled: enabled && !!scheduleId,
    staleTime: cachingPolicies.standard,
  });

  return {
    schedule: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 오늘 스케줄 조회 훅
 */
export function useTodaySchedules(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const today = new Date().toISOString().split('T')[0];

  const query = useQuery({
    queryKey: queryKeys.schedules.byDate(today),
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getTodaySchedules(staffId);
    },
    enabled: enabled && !!staffId,
    staleTime: cachingPolicies.realtime, // 실시간 데이터
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
  });

  return {
    schedules: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 다가오는 스케줄 조회 훅
 */
export function useUpcomingSchedules(days = 7, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: [...queryKeys.schedules.all, 'upcoming', days],
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getUpcomingSchedules(staffId, days);
    },
    enabled: enabled && !!staffId,
    staleTime: cachingPolicies.frequent,
  });

  return {
    schedules: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 스케줄 통계 조회 훅
 */
export function useScheduleStats(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: [...queryKeys.schedules.all, 'stats'],
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getScheduleStats(staffId);
    },
    enabled: enabled && !!staffId,
    staleTime: cachingPolicies.stable, // 30분
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 캘린더 뷰 옵션
 */
interface UseCalendarViewOptions {
  /** 초기 뷰 모드 (기본: 'month') */
  initialView?: CalendarView;
  /** 스케줄 그룹핑 활성화 (같은 지원의 연속/다중 날짜 통합, 기본: true) */
  enableGrouping?: boolean;
}

/**
 * 캘린더 뷰 상태 관리 훅
 *
 * @description
 * - 월별 스케줄 조회 및 캘린더 상태 관리
 * - enableGrouping=true 시 같은 지원의 연속/다중 날짜를 통합 표시
 *
 * @example
 * // 기본 사용 (그룹핑 활성화)
 * const { groupedByApplication, selectedDateSchedules } = useCalendarView();
 *
 * // 그룹핑 비활성화
 * const { schedules } = useCalendarView({ enableGrouping: false });
 */
export function useCalendarView(options: UseCalendarViewOptions | CalendarView = 'month') {
  // 옵션 정규화 (하위 호환성: 문자열도 허용)
  const normalizedOptions: UseCalendarViewOptions =
    typeof options === 'string' ? { initialView: options } : options;

  const { initialView = 'month', enableGrouping = true } = normalizedOptions;

  const [view, setView] = useState<CalendarView>(initialView);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  // 월 변경
  const goToMonth = useCallback((year: number, month: number) => {
    setCurrentMonth({ year, month });
  }, []);

  // 이전 월
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  }, []);

  // 다음 월
  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  }, []);

  // 오늘로 이동
  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    });
    setSelectedDate(today.toISOString().split('T')[0]);
  }, []);

  // 월별 스케줄 데이터
  const { schedules, groupedSchedules, markedDates, stats, isLoading, error, refresh } =
    useSchedulesByMonth({
      year: currentMonth.year,
      month: currentMonth.month,
    });

  // 같은 지원(applicationId)의 연속/다중 날짜를 통합
  // 결과: (ScheduleEvent | GroupedScheduleEvent)[]
  const groupedByApplication = useMemo(
    () =>
      enableGrouping
        ? groupScheduleEvents(schedules, { enabled: true, minGroupSize: 2 })
        : schedules,
    [schedules, enableGrouping]
  );

  // 선택된 날짜의 스케줄 (그룹핑된 버전)
  // GroupedScheduleEvent는 해당 날짜를 포함하면 반환
  const selectedDateSchedules = useMemo(() => {
    if (enableGrouping) {
      return filterSchedulesByDate(groupedByApplication, selectedDate);
    }
    return schedules.filter((s) => s.date === selectedDate);
  }, [groupedByApplication, schedules, selectedDate, enableGrouping]);

  // 원본 스케줄에서 선택된 날짜 필터링 (개별 카드용)
  const selectedDateSchedulesRaw = useMemo(() => {
    return schedules.filter((s) => s.date === selectedDate);
  }, [schedules, selectedDate]);

  return {
    // 상태
    view,
    selectedDate,
    currentMonth,
    // 데이터 (원본)
    schedules,
    groupedSchedules, // 날짜별 그룹화 (기존)
    markedDates,
    stats,
    // 데이터 (통합 표시용)
    groupedByApplication, // 같은 지원 통합 (신규)
    selectedDateSchedules, // 선택된 날짜 (그룹핑 적용)
    selectedDateSchedulesRaw, // 선택된 날짜 (원본)
    // 상태
    isLoading,
    error,
    // 액션
    setView,
    setSelectedDate,
    goToMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    refresh,
  };
}

export default useSchedules;
