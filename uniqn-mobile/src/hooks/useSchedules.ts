import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys, cachingPolicies, queryCachingOptions } from '@/lib/queryClient';
import {
  getCriticalOfflineCache,
  setCriticalOfflineCache,
} from '@/services/offline/criticalOfflineCache';
import { logger } from '@/utils/logger';
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
} from '@/services/work/scheduleService';
import { groupScheduleEvents, filterSchedulesByDate } from '@/utils/scheduleGrouping';
import { stableFilters } from '@/utils/queryUtils';
import { AuthError, ERROR_CODES } from '@/errors/AppError';
import type {
  CalendarView,
  ScheduleEvent,
  ScheduleFilters,
  ScheduleStats,
  CalendarView as CalendarViewType,
} from '@/types';

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

interface ScheduleQueryPayload {
  schedules: ScheduleEvent[];
  stats?: ScheduleStats;
}

const SCHEDULE_CACHE_SCHEMA_VERSION = 2;

function buildScheduleCacheKey(userId: string | undefined, scope: string, suffix?: string): string {
  return ['schedules', userId ?? 'anonymous', scope, suffix].filter(Boolean).join(':');
}

function useCachedSchedulePayload(cacheKey: string, ttlMs: number, userId?: string) {
  return useMemo(
    () =>
      getCriticalOfflineCache<ScheduleQueryPayload>(cacheKey, {
        ttlMs,
        userId,
        schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
      })?.data ?? { schedules: [] },
    [cacheKey, ttlMs, userId]
  );
}

export function useSchedules(options: UseSchedulesOptions = {}) {
  const { filters, enabled = true, realtime = false } = options;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const normalizedFilters = stableFilters(filters ?? {});
  const cacheKey = buildScheduleCacheKey(staffId, 'list', JSON.stringify(normalizedFilters));
  const listQueryKey = [
    ...queryKeys.schedules.list(normalizedFilters),
    staffId ?? 'anonymous',
  ] as const;
  const cachedPayload = useCachedSchedulePayload(
    cacheKey,
    queryCachingOptions.schedules.staleTime,
    staffId
  );
  const [realtimeSchedules, setRealtimeSchedules] = useState<ScheduleEvent[]>([]);

  const query = useQuery({
    queryKey: listQueryKey,
    queryFn: async () => {
      if (!staffId) throw new AuthError(ERROR_CODES.AUTH_REQUIRED);
      return getMySchedules(staffId, filters);
    },
    enabled: enabled && !!staffId && !realtime && isOnline,
    staleTime: queryCachingOptions.schedules.staleTime,
    gcTime: queryCachingOptions.schedules.gcTime,
  });

  useEffect(() => {
    if (!staffId || !query.data) {
      return;
    }

    setCriticalOfflineCache(cacheKey, query.data, {
      userId: staffId,
      schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, query.data, staffId]);

  useEffect(() => {
    if (!realtime || !staffId || !isOnline) return;

    const unsubscribe = subscribeToSchedules(
      staffId,
      (schedules) => {
        setRealtimeSchedules(schedules);
      },
      (error) => {
        logger.error('Schedule realtime subscription failed', error);
      }
    );

    return () => unsubscribe();
  }, [isOnline, realtime, staffId]);

  const shouldUseCachedPayload =
    enabled && !!staffId && !realtime && !isOnline && query.data === undefined;
  const queryPayload =
    query.data !== undefined
      ? query.data
      : shouldUseCachedPayload
        ? cachedPayload
        : { schedules: [] };
  const schedules = useMemo(
    () => (realtime ? realtimeSchedules : (queryPayload.schedules ?? [])),
    [queryPayload.schedules, realtime, realtimeSchedules]
  );
  const stats = realtime ? undefined : queryPayload.stats;
  const groupedSchedules = useMemo(() => groupSchedulesByDate(schedules), [schedules]);
  const markedDates = useMemo(() => getCalendarMarkedDates(schedules), [schedules]);

  const refresh = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: queryKeys.schedules.all,
    });
    await query.refetch();
  }, [isOnline, query, queryClient]);

  return {
    schedules,
    groupedSchedules,
    markedDates,
    stats,
    isLoading: schedules.length === 0 ? query.isLoading : false,
    isRefreshing: isOnline ? query.isRefetching : false,
    error: isOnline ? query.error : null,
    refresh,
  };
}

export function useSchedulesByMonth(options: UseSchedulesByMonthOptions) {
  const { year, month, enabled = true } = options;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const cacheKey = buildScheduleCacheKey(staffId, 'month', `${year}-${month}`);
  const monthQueryKey = [
    ...queryKeys.schedules.byMonth(year, month),
    staffId ?? 'anonymous',
  ] as const;
  const cachedPayload = useCachedSchedulePayload(
    cacheKey,
    queryCachingOptions.schedules.staleTime,
    staffId
  );

  const query = useQuery({
    queryKey: monthQueryKey,
    queryFn: async () => {
      if (!staffId) throw new AuthError(ERROR_CODES.AUTH_REQUIRED);
      return getSchedulesByMonth(staffId, year, month);
    },
    enabled: enabled && !!staffId && isOnline,
    staleTime: queryCachingOptions.schedules.staleTime,
    gcTime: queryCachingOptions.schedules.gcTime,
  });

  useEffect(() => {
    if (!staffId || !query.data) {
      return;
    }

    setCriticalOfflineCache(cacheKey, query.data, {
      userId: staffId,
      schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, query.data, staffId]);

  const shouldUseCachedPayload = enabled && !!staffId && !isOnline && query.data === undefined;
  const queryPayload =
    query.data !== undefined
      ? query.data
      : shouldUseCachedPayload
        ? cachedPayload
        : { schedules: [] };
  const schedules = useMemo(() => queryPayload.schedules ?? [], [queryPayload.schedules]);
  const stats = queryPayload.stats;
  const groupedSchedules = useMemo(() => groupSchedulesByDate(schedules), [schedules]);
  const markedDates = useMemo(() => getCalendarMarkedDates(schedules), [schedules]);

  const refresh = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: queryKeys.schedules.byMonth(year, month),
    });
  }, [isOnline, month, queryClient, year]);

  return {
    schedules,
    groupedSchedules,
    markedDates,
    stats,
    isLoading: schedules.length === 0 ? query.isLoading : false,
    isRefreshing: isOnline ? query.isRefetching : false,
    error: isOnline ? query.error : null,
    refresh,
  };
}

export function useSchedulesByDate(date: string, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const cacheKey = buildScheduleCacheKey(staffId, 'date', date);
  const dateQueryKey = [...queryKeys.schedules.byDate(date), staffId ?? 'anonymous'] as const;
  const cachedPayload = useCachedSchedulePayload(
    cacheKey,
    queryCachingOptions.schedules.staleTime,
    staffId
  );

  const query = useQuery({
    queryKey: dateQueryKey,
    queryFn: async () => {
      if (!staffId) throw new AuthError(ERROR_CODES.AUTH_REQUIRED);
      return getSchedulesByDate(staffId, date);
    },
    enabled: enabled && !!staffId && !!date && isOnline,
    staleTime: queryCachingOptions.schedules.staleTime,
    gcTime: queryCachingOptions.schedules.gcTime,
  });

  useEffect(() => {
    if (!staffId || !date || !query.data) {
      return;
    }

    setCriticalOfflineCache(
      cacheKey,
      { schedules: query.data },
      {
        userId: staffId,
        schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
      }
    );
  }, [cacheKey, date, query.data, staffId]);

  const shouldUseCachedPayload =
    enabled && !!staffId && !!date && !isOnline && query.data === undefined;
  const schedules =
    query.data !== undefined
      ? query.data
      : shouldUseCachedPayload
        ? (cachedPayload.schedules ?? [])
        : [];

  return {
    schedules,
    isLoading: schedules.length > 0 ? false : query.isLoading,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export function useScheduleDetail(scheduleId: string, enabled = true) {
  const { isOnline } = useNetworkStatus();
  const query = useQuery({
    queryKey: [...queryKeys.schedules.all, 'detail', scheduleId],
    queryFn: () => getScheduleById(scheduleId),
    enabled: enabled && !!scheduleId && isOnline,
    staleTime: cachingPolicies.standard,
  });

  return {
    schedule: query.data,
    isLoading: query.isLoading,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export function useTodaySchedules(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const today = new Date().toISOString().split('T')[0];
  const { isOnline } = useNetworkStatus();
  const cacheKey = buildScheduleCacheKey(staffId, 'today', today);
  const todayQueryKey = [...queryKeys.schedules.byDate(today), staffId ?? 'anonymous'] as const;
  const cachedPayload = useCachedSchedulePayload(cacheKey, cachingPolicies.realtime, staffId);

  const query = useQuery({
    queryKey: todayQueryKey,
    queryFn: async () => {
      if (!staffId) throw new AuthError(ERROR_CODES.AUTH_REQUIRED);
      return getTodaySchedules(staffId);
    },
    enabled: enabled && !!staffId && isOnline,
    staleTime: cachingPolicies.realtime,
    refetchInterval: isOnline ? 60 * 1000 : false,
  });

  useEffect(() => {
    if (!staffId || !query.data) {
      return;
    }

    setCriticalOfflineCache(
      cacheKey,
      { schedules: query.data },
      {
        userId: staffId,
        schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
      }
    );
  }, [cacheKey, query.data, staffId]);

  const shouldUseCachedPayload = enabled && !!staffId && !isOnline && query.data === undefined;
  const schedules =
    query.data !== undefined
      ? query.data
      : shouldUseCachedPayload
        ? (cachedPayload.schedules ?? [])
        : [];

  return {
    schedules,
    isLoading: schedules.length === 0 ? query.isLoading : false,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export function useUpcomingSchedules(days = 7, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const cacheKey = buildScheduleCacheKey(staffId, 'upcoming', String(days));
  const upcomingQueryKey = [
    ...queryKeys.schedules.all,
    'upcoming',
    days,
    staffId ?? 'anonymous',
  ] as const;
  const cachedPayload = useCachedSchedulePayload(
    cacheKey,
    queryCachingOptions.schedules.staleTime,
    staffId
  );

  const query = useQuery({
    queryKey: upcomingQueryKey,
    queryFn: async () => {
      if (!staffId) throw new AuthError(ERROR_CODES.AUTH_REQUIRED);
      return getUpcomingSchedules(staffId, days);
    },
    enabled: enabled && !!staffId && isOnline,
    staleTime: queryCachingOptions.schedules.staleTime,
    gcTime: queryCachingOptions.schedules.gcTime,
  });

  useEffect(() => {
    if (!staffId || !query.data) {
      return;
    }

    setCriticalOfflineCache(
      cacheKey,
      { schedules: query.data },
      {
        userId: staffId,
        schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
      }
    );
  }, [cacheKey, query.data, staffId]);

  const shouldUseCachedPayload = enabled && !!staffId && !isOnline && query.data === undefined;
  const schedules =
    query.data !== undefined
      ? query.data
      : shouldUseCachedPayload
        ? (cachedPayload.schedules ?? [])
        : [];

  return {
    schedules,
    isLoading: schedules.length === 0 ? query.isLoading : false,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export function useScheduleStats(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const statsQueryKey = [...queryKeys.schedules.all, 'stats', staffId ?? 'anonymous'] as const;

  const query = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => {
      if (!staffId) throw new AuthError(ERROR_CODES.AUTH_REQUIRED);
      return getScheduleStats(staffId);
    },
    enabled: enabled && !!staffId && isOnline,
    staleTime: cachingPolicies.stable,
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

interface UseCalendarViewOptions {
  initialView?: CalendarViewType;
  enableGrouping?: boolean;
}

export function useCalendarView(options: UseCalendarViewOptions | CalendarView = 'month') {
  const normalizedOptions: UseCalendarViewOptions =
    typeof options === 'string' ? { initialView: options } : options;

  const { initialView = 'month', enableGrouping = true } = normalizedOptions;

  const [view, setView] = useState<CalendarViewType>(initialView);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const goToMonth = useCallback((year: number, month: number) => {
    setCurrentMonth({ year, month });
  }, []);

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    });
    setSelectedDate(today.toISOString().split('T')[0]);
  }, []);

  const {
    schedules,
    groupedSchedules,
    markedDates,
    stats,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = useSchedulesByMonth({
    year: currentMonth.year,
    month: currentMonth.month,
  });

  const groupedByApplication = useMemo(
    () =>
      enableGrouping
        ? groupScheduleEvents(schedules, { enabled: true, minGroupSize: 2 })
        : schedules,
    [enableGrouping, schedules]
  );

  const selectedDateSchedules = useMemo(() => {
    if (enableGrouping) {
      return filterSchedulesByDate(groupedByApplication, selectedDate);
    }
    return schedules.filter((schedule) => schedule.date === selectedDate);
  }, [enableGrouping, groupedByApplication, schedules, selectedDate]);

  const selectedDateSchedulesRaw = useMemo(() => {
    return schedules.filter((schedule) => schedule.date === selectedDate);
  }, [schedules, selectedDate]);

  return {
    view,
    selectedDate,
    currentMonth,
    schedules,
    groupedSchedules,
    markedDates,
    stats,
    groupedByApplication,
    selectedDateSchedules,
    selectedDateSchedulesRaw,
    isLoading,
    isRefreshing,
    error,
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
