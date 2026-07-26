import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  calculateScheduleStats,
  getMySchedules,
  getSchedulesByMonth,
  getSchedulesByDate,
  getScheduleById,
  getTodaySchedules,
  subscribeToSchedules,
  groupSchedulesByDate,
  getCalendarMarkedDates,
} from '@/services/work/scheduleService';
import {
  groupScheduleEvents,
  filterSchedulesByDate,
  resolveSelectedDateForMonth,
} from '@/utils/scheduleGrouping';
import { shouldPreferQuerySchedulePayload } from '@/utils/scheduleRealtimePreference';
import { getTodayString } from '@/utils/date';
import { stableFilters } from '@/utils/queryUtils';
import { AuthError, ERROR_CODES, isAppError } from '@/errors/AppError';
import type {
  CalendarView,
  ScheduleEvent,
  ScheduleFilters,
  ScheduleGroup,
  ScheduleStats,
  ScheduleType,
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
  realtime?: boolean;
}

interface ScheduleQueryPayload {
  schedules: ScheduleEvent[];
  stats?: ScheduleStats;
  groupedSchedules?: ScheduleGroup[];
  markedDates?: Record<string, { marked: boolean; dotColor: string; type?: ScheduleType }>;
  warning?: string;
}

interface NormalizedScheduleQueryPayload extends ScheduleQueryPayload {
  groupedSchedules: ScheduleGroup[];
  markedDates: Record<string, { marked: boolean; dotColor: string; type?: ScheduleType }>;
}

const SCHEDULE_CACHE_SCHEMA_VERSION = 3;
const MONTH_REALTIME_OBSERVATION_LIMIT = 50;
const EMPTY_SCHEDULE_QUERY_PAYLOAD: NormalizedScheduleQueryPayload = {
  schedules: [],
  groupedSchedules: [],
  markedDates: {},
};

function buildScheduleCacheKey(userId: string | undefined, scope: string, suffix?: string): string {
  return ['schedules', userId ?? 'anonymous', scope, suffix].filter(Boolean).join(':');
}

function normalizeScheduleQueryPayload(
  payload: ScheduleQueryPayload
): NormalizedScheduleQueryPayload {
  const schedules = payload.schedules ?? [];

  return {
    schedules,
    stats: payload.stats,
    groupedSchedules: payload.groupedSchedules ?? groupSchedulesByDate(schedules),
    markedDates: payload.markedDates ?? getCalendarMarkedDates(schedules),
    warning: payload.warning,
  };
}

function useCachedSchedulePayload(cacheKey: string, ttlMs: number, userId?: string) {
  return useMemo(
    () =>
      normalizeScheduleQueryPayload(
        getCriticalOfflineCache<ScheduleQueryPayload>(cacheKey, {
          ttlMs,
          userId,
          schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
        })?.data ?? EMPTY_SCHEDULE_QUERY_PAYLOAD
      ),
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
  const normalizedQueryPayload = useMemo(
    () => (query.data ? normalizeScheduleQueryPayload(query.data) : null),
    [query.data]
  );
  const realtimePayload = useMemo(
    () => normalizeScheduleQueryPayload({ schedules: realtimeSchedules }),
    [realtimeSchedules]
  );

  useEffect(() => {
    if (!staffId || !normalizedQueryPayload) {
      return;
    }

    setCriticalOfflineCache(cacheKey, normalizedQueryPayload, {
      userId: staffId,
      schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, normalizedQueryPayload, staffId]);

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
    normalizedQueryPayload ??
    (shouldUseCachedPayload ? cachedPayload : EMPTY_SCHEDULE_QUERY_PAYLOAD);
  const effectivePayload = realtime ? realtimePayload : queryPayload;
  const schedules = effectivePayload.schedules;
  const stats = realtime ? undefined : effectivePayload.stats;
  const groupedSchedules = effectivePayload.groupedSchedules;
  const markedDates = effectivePayload.markedDates;
  const warning = realtime ? undefined : effectivePayload.warning;

  const refresh = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: queryKeys.schedules.all,
    });
  }, [isOnline, queryClient]);

  return {
    schedules,
    groupedSchedules,
    markedDates,
    stats,
    warning,
    isLoading: schedules.length === 0 ? query.isLoading : false,
    isRefreshing: isOnline ? query.isRefetching : false,
    error: isOnline ? query.error : null,
    refresh,
  };
}

/**
 * 월별 스케줄 조회 hook.
 *
 * Phase 2A.후속 PR3-D 검증 (2026-05-10): staff-only scope. user.uid 기반 본인 work_logs 만 조회.
 * active workspace 필터 불필요 — RLS 가 본인 work_logs 만 노출 + service 가 staff_id 로 query.
 * staff 가 다른 워크스페이스 공고에 지원했어도 본인 work_logs 라면 모두 보임 (의도된 동작).
 */
export function useSchedulesByMonth(options: UseSchedulesByMonthOptions) {
  const { year, month, enabled = true, realtime = false } = options;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const cacheKey = buildScheduleCacheKey(staffId, 'month', `${year}-${month}`);
  const monthQueryKey = useMemo(
    () => [...queryKeys.schedules.byMonth(year, month), staffId ?? 'anonymous'] as const,
    [month, staffId, year]
  );
  const cachedPayload = useCachedSchedulePayload(
    cacheKey,
    queryCachingOptions.schedules.staleTime,
    staffId
  );
  const [realtimeSchedules, setRealtimeSchedules] = useState<ScheduleEvent[]>([]);
  const [hasReceivedRealtimeSnapshot, setHasReceivedRealtimeSnapshot] = useState(false);
  const [lastRealtimeSnapshotAt, setLastRealtimeSnapshotAt] = useState(0);
  const [isRealtimeLoading, setIsRealtimeLoading] = useState(false);
  const [realtimeError, setRealtimeError] = useState<Error | null>(null);
  const hasLoggedRealtimeLimitWarningRef = useRef(false);

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
  const normalizedQueryPayload = useMemo(
    () => (query.data ? normalizeScheduleQueryPayload(query.data) : null),
    [query.data]
  );
  const realtimePayload = useMemo(() => {
    if (!realtime) {
      return EMPTY_SCHEDULE_QUERY_PAYLOAD;
    }

    return normalizeScheduleQueryPayload({
      schedules: realtimeSchedules,
      stats: calculateScheduleStats(realtimeSchedules),
    });
  }, [realtime, realtimeSchedules]);

  useEffect(() => {
    if (!staffId || !normalizedQueryPayload) {
      return;
    }

    setCriticalOfflineCache(cacheKey, normalizedQueryPayload, {
      userId: staffId,
      schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, normalizedQueryPayload, staffId]);

  useEffect(() => {
    if (!realtime || !enabled || !staffId || !isOnline) {
      setRealtimeSchedules([]);
      setHasReceivedRealtimeSnapshot(false);
      setLastRealtimeSnapshotAt(0);
      setIsRealtimeLoading(false);
      setRealtimeError(null);
      return;
    }

    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    setRealtimeSchedules([]);
    setHasReceivedRealtimeSnapshot(false);
    setLastRealtimeSnapshotAt(0);
    setIsRealtimeLoading(true);
    setRealtimeError(null);
    hasLoggedRealtimeLimitWarningRef.current = false;

    const unsubscribe = subscribeToSchedules(
      staffId,
      (schedules) => {
        const filteredSchedules = schedules.filter((schedule) =>
          schedule.date.startsWith(monthPrefix)
        );
        const filteredCount = filteredSchedules.length;

        logger.info('schedule_month_realtime_snapshot_count', {
          listener: 'schedules_by_month',
          year,
          month,
          count: filteredCount,
          limit: MONTH_REALTIME_OBSERVATION_LIMIT,
        });

        if (
          filteredCount >= MONTH_REALTIME_OBSERVATION_LIMIT &&
          !hasLoggedRealtimeLimitWarningRef.current
        ) {
          hasLoggedRealtimeLimitWarningRef.current = true;
          logger.warn('schedule_month_realtime_limit_reached', {
            listener: 'schedules_by_month',
            year,
            month,
            count: filteredCount,
            limit: MONTH_REALTIME_OBSERVATION_LIMIT,
          });
        }

        setRealtimeSchedules(filteredSchedules);
        setHasReceivedRealtimeSnapshot(true);
        setLastRealtimeSnapshotAt(Date.now());
        setIsRealtimeLoading(false);
      },
      (error) => {
        setIsRealtimeLoading(false);
        setRealtimeError(error);
        // Realtime CHANNEL_ERROR 등 transient 에러는 Phoenix가 자동 재연결하므로
        // warn 수준으로 로깅하여 Sentry 노이즈를 방지한다.
        if (isAppError(error) && error.isRetryable) {
          logger.warn('Schedule month realtime subscription transient error', {
            message: error.message,
            staffId,
            year,
            month,
          });
        } else {
          logger.error('Schedule month realtime subscription failed', error, {
            staffId,
            year,
            month,
          });
        }
      }
    );

    return () => unsubscribe();
  }, [enabled, isOnline, month, realtime, staffId, year]);

  const shouldUseCachedPayload = enabled && !!staffId && !isOnline && query.data === undefined;
  const queryPayload =
    normalizedQueryPayload ??
    (shouldUseCachedPayload ? cachedPayload : EMPTY_SCHEDULE_QUERY_PAYLOAD);
  const shouldPreferQueryPayload = shouldPreferQuerySchedulePayload({
    realtime,
    hasReceivedRealtimeSnapshot,
    hasQueryPayload: !!normalizedQueryPayload,
    queryUpdatedAt: query.dataUpdatedAt,
    realtimeSnapshotAt: lastRealtimeSnapshotAt,
    realtimeScheduleCount: realtimePayload.schedules.length,
    queryScheduleCount: queryPayload.schedules.length,
  });
  const effectivePayload = shouldPreferQueryPayload ? queryPayload : realtimePayload;
  const schedules = effectivePayload.schedules;
  const stats = effectivePayload.stats;
  const groupedSchedules = effectivePayload.groupedSchedules;
  const markedDates = effectivePayload.markedDates;
  const warning = effectivePayload.warning ?? queryPayload.warning;
  const hasBootstrapData =
    schedules.length > 0 ||
    stats !== undefined ||
    warning !== undefined ||
    Object.keys(markedDates).length > 0;

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
    warning,
    isLoading: realtime
      ? !hasReceivedRealtimeSnapshot && !hasBootstrapData && (query.isLoading || isRealtimeLoading)
      : schedules.length === 0
        ? query.isLoading
        : false,
    isRefreshing: realtime
      ? isRealtimeLoading || query.isRefetching
      : isOnline
        ? query.isRefetching
        : false,
    error: isOnline
      ? realtime
        ? hasBootstrapData
          ? null
          : (realtimeError ?? query.error)
        : query.error
      : null,
    /**
     * 카드가 이미 떠 있는 상태의 갱신 실패. `error` 는 데이터가 있으면 null 로 접히므로
     * 이 값이 없으면 새로고침 실패가 완전히 무음이 되고, 근무 당일 확정 여부를 확인하러
     * 당긴 사용자가 옛 데이터를 최신으로 믿게 된다.
     */
    refreshError: isOnline && hasBootstrapData ? (query.error ?? realtimeError) : null,
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
  const normalizedQueryPayload = useMemo(
    () =>
      query.data !== undefined ? normalizeScheduleQueryPayload({ schedules: query.data }) : null,
    [query.data]
  );

  useEffect(() => {
    if (!staffId || !date || !normalizedQueryPayload) {
      return;
    }

    setCriticalOfflineCache(cacheKey, normalizedQueryPayload, {
      userId: staffId,
      schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, date, normalizedQueryPayload, staffId]);

  const shouldUseCachedPayload =
    enabled && !!staffId && !!date && !isOnline && query.data === undefined;
  const schedules =
    normalizedQueryPayload?.schedules ?? (shouldUseCachedPayload ? cachedPayload.schedules : []);

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
  const today = getTodayString();
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
  const normalizedQueryPayload = useMemo(
    () =>
      query.data !== undefined ? normalizeScheduleQueryPayload({ schedules: query.data }) : null,
    [query.data]
  );

  useEffect(() => {
    if (!staffId || !normalizedQueryPayload) {
      return;
    }

    setCriticalOfflineCache(cacheKey, normalizedQueryPayload, {
      userId: staffId,
      schemaVersion: SCHEDULE_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, normalizedQueryPayload, staffId]);

  const shouldUseCachedPayload = enabled && !!staffId && !isOnline && query.data === undefined;
  const schedules =
    normalizedQueryPayload?.schedules ?? (shouldUseCachedPayload ? cachedPayload.schedules : []);

  return {
    schedules,
    isLoading: schedules.length === 0 ? query.isLoading : false,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

interface UseCalendarViewOptions {
  initialView?: CalendarViewType;
  enableGrouping?: boolean;
  realtime?: boolean;
}

/**
 * 캘린더 뷰 상태 + 월별 스케줄 hook.
 *
 * Phase 2A.후속 PR3-D 검증 (2026-05-10): staff-only scope. 내부적으로 useSchedulesByMonth 를
 * 사용하므로 user.uid 기반 본인 work_logs 만 조회.
 * active workspace 필터 불필요 — RLS 가 본인 work_logs 만 노출 + service 가 staff_id 로 query.
 * staff 가 다른 워크스페이스 공고에 지원했어도 본인 work_logs 라면 모두 보임 (의도된 동작).
 */
export function useCalendarView(options: UseCalendarViewOptions | CalendarView = 'month') {
  const normalizedOptions: UseCalendarViewOptions =
    typeof options === 'string' ? { initialView: options } : options;

  const { initialView = 'month', enableGrouping = true, realtime = false } = normalizedOptions;

  const [view, setView] = useState<CalendarViewType>(initialView);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  /**
   * 사용자가 날짜를 직접 골랐는지. 자동 재정렬이 사용자의 선택을 덮지 않게 한다.
   * 월을 이동하면 다시 false 로 돌아가 새 달 기준으로 재정렬된다.
   */
  const userPickedDateRef = useRef(false);

  const selectDate = useCallback((date: string) => {
    userPickedDateRef.current = true;
    setSelectedDate(date);
  }, []);

  const goToMonth = useCallback((year: number, month: number) => {
    userPickedDateRef.current = false;
    setCurrentMonth({ year, month });
  }, []);

  const goToPrevMonth = useCallback(() => {
    userPickedDateRef.current = false;
    setCurrentMonth((prev) => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    userPickedDateRef.current = false;
    setCurrentMonth((prev) => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    userPickedDateRef.current = true;
    setCurrentMonth({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    });
    setSelectedDate(getTodayString());
  }, []);

  const {
    schedules,
    groupedSchedules,
    markedDates,
    stats,
    warning,
    isLoading,
    isRefreshing,
    error,
    refreshError,
    refresh,
  } = useSchedulesByMonth({
    year: currentMonth.year,
    month: currentMonth.month,
    realtime,
  });

  /**
   * 월 이동 시 선택 날짜를 이동한 달로 재정렬한다.
   *
   * 월만 바꾸고 selectedDate 를 그대로 두면 선택일이 이전 달에 남아, 캘린더에는 점이
   * 찍혔는데 아래 목록은 비고 어느 날짜에도 선택 표시가 없다 — 지난달 기록을 보러 온
   * 사용자가 "기록이 사라졌다"고 오해한다. 좌우 스와이프 전환도 같은 경로다.
   *
   * 데이터가 도착하면 한 번 더 돌아 '일정이 있는 가장 이른 날'로 좁혀진다.
   * 사용자가 날짜를 직접 탭한 뒤에는(userPickedDateRef) 개입하지 않는다.
   */
  useEffect(() => {
    if (userPickedDateRef.current) return;

    const target = resolveSelectedDateForMonth(
      currentMonth.year,
      currentMonth.month,
      schedules.map((schedule) => schedule.date),
      getTodayString()
    );

    if (target !== selectedDate) {
      setSelectedDate(target);
    }
  }, [currentMonth, schedules, selectedDate]);

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
    warning,
    groupedByApplication,
    selectedDateSchedules,
    selectedDateSchedulesRaw,
    isLoading,
    isRefreshing,
    error,
    refreshError,
    setView,
    setSelectedDate: selectDate,
    goToMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    refresh,
  };
}
