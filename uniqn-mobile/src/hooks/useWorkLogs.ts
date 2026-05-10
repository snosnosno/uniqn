import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
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
  getWorkLogStats,
  getMonthlyPayroll,
  subscribeToTodayWorkStatus,
} from '@/services/work/workLogService';
import { STATUS } from '@/constants';
import type { WorkLog } from '@/types';

interface UseWorkLogsOptions {
  limit?: number;
  enabled?: boolean;
}

interface CurrentWorkStatusValue {
  workLog: WorkLog | null;
  isWorking: boolean;
}

const WORK_LOG_CACHE_SCHEMA_VERSION = 2;
const AUTH_REQUIRED_MESSAGE = '\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.';
const DEFAULT_CURRENT_WORK_STATUS: CurrentWorkStatusValue = {
  workLog: null,
  isWorking: false,
};

function buildWorkLogCacheKey(userId: string | undefined, scope: string, suffix?: string): string {
  return ['workLogs', userId ?? 'anonymous', scope, suffix].filter(Boolean).join(':');
}

function normalizeCurrentWorkStatus(workLog: WorkLog | null): CurrentWorkStatusValue {
  const isWorking = workLog?.status === STATUS.WORK_LOG.CHECKED_IN;

  return {
    workLog: isWorking ? workLog : null,
    isWorking,
  };
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
      if (!staffId) throw new Error(AUTH_REQUIRED_MESSAGE);
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
      if (!staffId) throw new Error(AUTH_REQUIRED_MESSAGE);
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
  const [subscriptionValue, setSubscriptionValue] = useState<CurrentWorkStatusValue | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null);
  const [hasReceivedInitialSnapshot, setHasReceivedInitialSnapshot] = useState(false);
  const persistCurrentStatus = useCallback(
    (value: CurrentWorkStatusValue) => {
      if (!staffId) {
        return;
      }

      setCriticalOfflineCache(cacheKey, value, {
        userId: staffId,
        schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
      });
    },
    [cacheKey, staffId]
  );

  const query = useQuery({
    queryKey: currentStatusQueryKey,
    queryFn: async () => {
      if (!staffId) throw new Error(AUTH_REQUIRED_MESSAGE);
      const workLog = await getTodayCheckedInWorkLog(staffId);
      return normalizeCurrentWorkStatus(workLog);
    },
    enabled: false,
    staleTime: cachingPolicies.realtime,
  });

  useEffect(() => {
    if (!enabled || !staffId || !isOnline) {
      setSubscriptionValue(null);
      setSubscriptionError(null);
      setHasReceivedInitialSnapshot(false);
      return;
    }

    setSubscriptionValue(null);
    setSubscriptionError(null);
    setHasReceivedInitialSnapshot(false);

    const unsubscribe = subscribeToTodayWorkStatus(staffId, {
      onUpdate: (workLog) => {
        const nextValue = normalizeCurrentWorkStatus(workLog);
        persistCurrentStatus(nextValue);
        setSubscriptionValue(nextValue);
        setSubscriptionError(null);
        setHasReceivedInitialSnapshot(true);
      },
      onError: (error) => {
        setSubscriptionError(error);
        setHasReceivedInitialSnapshot(true);
      },
    });

    return () => unsubscribe();
  }, [enabled, isOnline, persistCurrentStatus, staffId]);

  const currentStatusForCache = subscriptionValue ?? query.data;

  useEffect(() => {
    if (!staffId || !currentStatusForCache) {
      return;
    }

    setCriticalOfflineCache(cacheKey, currentStatusForCache, {
      userId: staffId,
      schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
    });
  }, [cacheKey, currentStatusForCache, staffId]);

  const cachedCurrentStatusEntry = staffId
    ? getCriticalOfflineCache<CurrentWorkStatusValue>(cacheKey, {
        ttlMs: cachingPolicies.realtime,
        userId: staffId,
        schemaVersion: WORK_LOG_CACHE_SCHEMA_VERSION,
      })
    : null;
  const cachedCurrentStatus = cachedCurrentStatusEntry?.data ?? DEFAULT_CURRENT_WORK_STATUS;
  const hasCachedCurrentStatus = cachedCurrentStatusEntry !== null;

  const shouldUseCachedCurrentStatus =
    enabled &&
    !!staffId &&
    subscriptionValue === null &&
    query.data === undefined &&
    hasCachedCurrentStatus;
  const currentStatus =
    subscriptionValue ??
    query.data ??
    (shouldUseCachedCurrentStatus ? cachedCurrentStatus : DEFAULT_CURRENT_WORK_STATUS);

  const refetch = useCallback(async () => {
    if (!enabled || !staffId || !isOnline) {
      return Promise.resolve();
    }

    const result = await query.refetch();

    if (result.data !== undefined) {
      persistCurrentStatus(result.data);
      setSubscriptionValue(result.data);
      setSubscriptionError(null);
      setHasReceivedInitialSnapshot(true);
    }

    return result;
  }, [enabled, isOnline, persistCurrentStatus, query, staffId]);

  return {
    currentWorkLog: currentStatus.workLog ?? null,
    isWorking: currentStatus.isWorking ?? false,
    isLoading:
      enabled &&
      !!staffId &&
      isOnline &&
      !hasReceivedInitialSnapshot &&
      !shouldUseCachedCurrentStatus,
    isRefreshing: isOnline ? query.isRefetching : false,
    error: isOnline ? (subscriptionError ?? query.error) : null,
    refetch,
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
      if (!staffId) throw new Error(AUTH_REQUIRED_MESSAGE);
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

/**
 * 월별 정산 요약 hook
 *
 * Phase 2A.후속 (PR3-B, 2026-05-10) — useActiveWorkspace 의존 추가. Staff 가
 * 여러 워크스페이스(포커룸)에서 근무하는 경우 active workspace 별로 정산을
 * 분리 (PR #71 useMyJobPostings 패턴 복제). queryKey 에 workspaceId 포함하여
 * cache 격리, activeWorkspace 부재 시 enabled=false 로 ghost cache 회피.
 */
export function useMonthlyPayroll(year: number, month: number, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;
  const { activeWorkspace } = useActiveWorkspace();
  const { isOnline } = useNetworkStatus();
  const payrollQueryKey = [
    ...queryKeys.workLogs.all,
    'payroll',
    year,
    month,
    staffId ?? 'anonymous',
    activeWorkspace?.id ?? 'no-workspace',
  ] as const;

  const query = useQuery({
    queryKey: payrollQueryKey,
    queryFn: async () => {
      if (!staffId) throw new Error(AUTH_REQUIRED_MESSAGE);
      return getMonthlyPayroll(staffId, year, month, activeWorkspace?.id);
    },
    enabled: enabled && !!staffId && !!activeWorkspace?.id && isOnline,
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
