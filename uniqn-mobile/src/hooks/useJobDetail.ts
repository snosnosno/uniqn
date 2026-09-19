import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ERROR_CODES, isAppError, isPermissionError } from '@/errors/AppError';
import { cachingPolicies, offlineCachePolicies, queryKeys } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import {
  getCriticalOfflineCache,
  removeCriticalOfflineCache,
  setCriticalOfflineCache,
} from '@/services/offline/criticalOfflineCache';
import { getJobPostingById, subscribeToJobPosting } from '@/services';
import type { JobPosting } from '@/types';

interface UseJobDetailOptions {
  enabled?: boolean;
  realtime?: boolean;
}

const JOB_DETAIL_CACHE_SCHEMA_VERSION = 2;

function buildJobDetailCacheKey(jobId: string, userId?: string) {
  return ['jobPostings', 'detail', userId ?? 'public', jobId].join(':');
}

export function getJobDetailQueryKey(jobId: string, userId?: string) {
  return [...queryKeys.jobPostings.detail(jobId), userId ?? 'public'] as const;
}

export function getJobDetailQueryOptions(jobId: string, userId?: string) {
  return {
    queryKey: getJobDetailQueryKey(jobId, userId),
    queryFn: () => getJobPostingById(jobId),
    staleTime: 0,
    gcTime: cachingPolicies.standard,
  };
}

function shouldDiscardCachedJobDetail(error: unknown): boolean {
  if (isPermissionError(error)) {
    return true;
  }

  if (isAppError(error)) {
    const discardableErrorCodes: string[] = [
      ERROR_CODES.INFRA_NOT_FOUND,
      ERROR_CODES.INFRA_PERMISSION_DENIED,
      ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
    ];

    return discardableErrorCodes.includes(error.code);
  }

  const errorCode =
    error !== null && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  return (
    errorCode === 'permission-denied' ||
    errorCode === 'firestore/permission-denied' ||
    errorCode === 'not-found' ||
    errorCode === 'firestore/not-found'
  );
}

export function useJobDetail(jobId: string, options: UseJobDetailOptions = {}) {
  const { enabled = true, realtime = false } = options;
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.uid);
  const { isOnline } = useNetworkStatus();
  const [realtimeError, setRealtimeError] = useState<Error | null>(null);
  const cacheKey = useMemo(() => buildJobDetailCacheKey(jobId, userId), [jobId, userId]);
  const detailQueryOptions = useMemo(
    () => getJobDetailQueryOptions(jobId, userId),
    [jobId, userId]
  );
  const detailQueryKey = detailQueryOptions.queryKey;

  const query = useQuery({
    ...detailQueryOptions,
    enabled: enabled && !!jobId && isOnline,
  });

  useEffect(() => {
    if (!realtime || !enabled || !jobId || !isOnline) {
      setRealtimeError(null);
      return;
    }

    setRealtimeError(null);

    const unsubscribe = subscribeToJobPosting(jobId, {
      onUpdate: (jobPosting) => {
        // 갱신이 도착했다는 건 구독이 살아 있다는 뜻이다. 지난 구독 에러를 여기서 지우지 않으면
        // 화면이 캐시된 공고 위에 영구 에러 상태를 씌운다(감사 A4).
        setRealtimeError(null);
        queryClient.setQueryData(detailQueryKey, jobPosting);

        if (jobPosting) {
          setCriticalOfflineCache<JobPosting>(cacheKey, jobPosting, {
            schemaVersion: JOB_DETAIL_CACHE_SCHEMA_VERSION,
            userId,
          });
        } else {
          removeCriticalOfflineCache(cacheKey);
        }
      },
      onError: (error) => {
        setRealtimeError(error);
      },
    });

    return () => unsubscribe();
  }, [cacheKey, detailQueryKey, enabled, isOnline, jobId, queryClient, realtime, userId]);

  useEffect(() => {
    if (!jobId || !query.isFetched) {
      return;
    }

    if (query.data) {
      setCriticalOfflineCache<JobPosting>(cacheKey, query.data, {
        schemaVersion: JOB_DETAIL_CACHE_SCHEMA_VERSION,
        userId,
      });
      return;
    }

    if (query.data === null || shouldDiscardCachedJobDetail(query.error)) {
      removeCriticalOfflineCache(cacheKey);
    }
  }, [cacheKey, jobId, query.data, query.error, query.isFetched, userId]);

  const cachedJob = useMemo(() => {
    if (!enabled || !jobId) {
      return null;
    }

    return (
      getCriticalOfflineCache<JobPosting>(cacheKey, {
        ttlMs: offlineCachePolicies.jobDetail,
        schemaVersion: JOB_DETAIL_CACHE_SCHEMA_VERSION,
        userId,
      })?.data ?? null
    );
  }, [cacheKey, enabled, jobId, userId]);

  const shouldUseCachedJob = enabled && !!jobId && !isOnline && query.data === undefined;
  const job = query.data !== undefined ? query.data : shouldUseCachedJob ? cachedJob : null;

  const refresh = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    // 화면의 '다시 시도'가 여기로 오는데, 구독 에러를 지우지 않으면 재조회가 성공해도
    // 에러 화면이 그대로 남는다 — 재시도 버튼이 거짓말이 된다. 구독이 여전히 죽어 있으면
    // onError 가 다시 세우므로 지속 실패를 감추지도 않는다.
    setRealtimeError(null);

    await queryClient.invalidateQueries({
      queryKey: detailQueryKey,
    });
  }, [detailQueryKey, isOnline, queryClient]);

  return {
    job,
    isLoading: !job ? query.isLoading : false,
    isRefreshing: isOnline ? query.isRefetching : false,
    error: isOnline ? (realtimeError ?? query.error) : null,
    refresh,
  };
}
