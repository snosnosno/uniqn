import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys, cachingPolicies, queryCachingOptions } from '@/lib/queryClient';
import {
  getCriticalOfflineCache,
  setCriticalOfflineCache,
} from '@/services/offline/criticalOfflineCache';
import {
  getMyWorkLogs,
  getWorkLogsByDate,
  getWorkLogById,
  getTodayCheckedInWorkLog,
  isCurrentlyWorking,
  getWorkLogStats,
  getMonthlyPayroll,
} from '@/services/work/workLogService';
import type { WorkLog } from '@/types';

interface UseWorkLogsOptions {
  limit?: number;
  enabled?: boolean;
}

const WORK_LOG_CACHE_SCHEMA_VERSION = 2;

function buildWorkLogCacheKey(userId: string | undefined, scope: string, suffix?: string): string {
  return ['workLogs', userId ?? 'anonymous', scope, suffix].filter(Boolean).join(':');
}

export function useWorkLogs(options: UseWorkLogsOptions = {}) {
  const { limit = 50, enabled = true } = options;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const cacheKey = buildWorkLogCacheKey(staffId, 'mine', String(limit));
  const mineQueryKey = [...queryKeys.workLogs.mine(), staffId ?? 'anonymous'] as const;

  const query = useQuery({
    queryKey: mineQueryKey,
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getMyWorkLogs(staffId, limit);
    },
    enabled: enabled && !!staffId && isOnline,
    staleTime: queryCachingOptions.workLogs.staleTime,
    gcTime: queryCachingOptions.workLogs.gcTime,
  });

  useEffect(() => {
    if (!staffId || !query.data) {
      return;
    }

    setCriticalOfflineCache(cacheKey, query.data, {
      userId: staffId,
      schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, query.data, staffId]);

  const cachedWorkLogs = useMemo(
    () =>
      (staffId
        ? getCriticalOfflineCache<WorkLog[]>(cacheKey, {
            ttlMs: queryCachingOptions.workLogs.staleTime,
            userId: staffId,
            schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
          })?.data
        : []) ?? [],
    [cacheKey, staffId]
  );

  const shouldUseCachedWorkLogs = enabled && !!staffId && !isOnline && query.data === undefined;
  const workLogs = query.data ?? (shouldUseCachedWorkLogs ? cachedWorkLogs : []);

  const refresh = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: queryKeys.workLogs.all,
    });
  }, [isOnline, queryClient]);

  return {
    workLogs,
    isLoading: workLogs.length === 0 ? query.isLoading : false,
    isRefreshing: isOnline ? query.isRefetching : false,
    error: isOnline ? query.error : null,
    refresh,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export function useWorkLogsByDate(date: string, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const cacheKey = buildWorkLogCacheKey(staffId, 'date', date);
  const byDateQueryKey = [...queryKeys.workLogs.byDate(date), staffId ?? 'anonymous'] as const;

  const query = useQuery({
    queryKey: byDateQueryKey,
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getWorkLogsByDate(staffId, date);
    },
    enabled: enabled && !!staffId && !!date && isOnline,
    staleTime: queryCachingOptions.workLogs.staleTime,
    gcTime: queryCachingOptions.workLogs.gcTime,
  });

  useEffect(() => {
    if (!staffId || !date || !query.data) {
      return;
    }

    setCriticalOfflineCache(cacheKey, query.data, {
      userId: staffId,
      schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, date, query.data, staffId]);

  const cachedWorkLogs = useMemo(
    () =>
      (staffId
        ? getCriticalOfflineCache<WorkLog[]>(cacheKey, {
            ttlMs: queryCachingOptions.workLogs.staleTime,
            userId: staffId,
            schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
          })?.data
        : []) ?? [],
    [cacheKey, staffId]
  );

  const shouldUseCachedWorkLogs =
    enabled && !!staffId && !!date && !isOnline && query.data === undefined;
  const workLogs = query.data ?? (shouldUseCachedWorkLogs ? cachedWorkLogs : []);

  return {
    workLogs,
    isLoading: workLogs.length === 0 ? query.isLoading : false,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export function useWorkLogDetail(workLogId: string, enabled = true) {
  const { isOnline } = useNetworkStatus();
  const query = useQuery({
    queryKey: queryKeys.workLogs.bySchedule(workLogId),
    queryFn: () => getWorkLogById(workLogId),
    enabled: enabled && !!workLogId && isOnline,
    staleTime: cachingPolicies.standard,
  });

  return {
    workLog: query.data,
    isLoading: query.isLoading,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export function useCurrentWorkStatus(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const cacheKey = buildWorkLogCacheKey(staffId, 'current-status');
  const currentStatusQueryKey = [
    ...queryKeys.workLogs.all,
    'current',
    staffId ?? 'anonymous',
  ] as const;

  const query = useQuery({
    queryKey: currentStatusQueryKey,
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      const workLog = await getTodayCheckedInWorkLog(staffId);
      const working = await isCurrentlyWorking(staffId);
      return { workLog, isWorking: working };
    },
    enabled: enabled && !!staffId && isOnline,
    staleTime: cachingPolicies.realtime,
    refetchInterval: isOnline ? 30 * 1000 : false,
  });

  useEffect(() => {
    if (!staffId || !query.data) {
      return;
    }

    setCriticalOfflineCache(cacheKey, query.data, {
      userId: staffId,
      schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, query.data, staffId]);

  const cachedCurrentStatus = useMemo(
    () =>
      staffId
        ? (getCriticalOfflineCache<{ workLog: WorkLog | null; isWorking: boolean }>(cacheKey, {
            ttlMs: cachingPolicies.realtime,
            userId: staffId,
            schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
          })?.data ?? { workLog: null, isWorking: false })
        : { workLog: null, isWorking: false },
    [cacheKey, staffId]
  );

  const shouldUseCachedCurrentStatus =
    enabled && !!staffId && !isOnline && query.data === undefined;
  const currentStatus =
    query.data ??
    (shouldUseCachedCurrentStatus ? cachedCurrentStatus : { workLog: null, isWorking: false });

  return {
    currentWorkLog: currentStatus.workLog ?? null,
    isWorking: currentStatus.isWorking ?? false,
    isLoading: !currentStatus.workLog ? query.isLoading : false,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export function useWorkLogStats(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const statsQueryKey = [...queryKeys.workLogs.all, 'stats', staffId ?? 'anonymous'] as const;

  const query = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getWorkLogStats(staffId);
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

export function useMonthlyPayroll(year: number, month: number, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { isOnline } = useNetworkStatus();
  const payrollQueryKey = [
    ...queryKeys.workLogs.all,
    'payroll',
    year,
    month,
    staffId ?? 'anonymous',
  ] as const;

  const query = useQuery({
    queryKey: payrollQueryKey,
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getMonthlyPayroll(staffId, year, month);
    },
    enabled: enabled && !!staffId && isOnline,
    staleTime: cachingPolicies.stable,
  });

  return {
    payroll: query.data,
    isLoading: query.isLoading,
    error: isOnline ? query.error : null,
    refetch: () => (isOnline ? query.refetch() : Promise.resolve()),
  };
}

export default useWorkLogs;
