import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildPostingFacts,
  focusPostingCardToDate,
  matchesPostingDate,
  projectPostingCard,
} from '@/domains/job-posting';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { offlineCachePolicies, queryCachingOptions, queryKeys } from '@/lib/queryClient';
import {
  getCriticalOfflineCache,
  setCriticalOfflineCache,
} from '@/services/offline/criticalOfflineCache';
import { getJobPostings } from '@/services';
import type { JobPostingCard, JobPostingFilters } from '@/types';
import type { PaginationCursor } from '@/types/common';
import { sortJobPostings } from '@/utils/jobPostingSorter';
import { stableFilters } from '@/utils/queryUtils';

interface UseJobPostingsOptions {
  filters?: JobPostingFilters;
  limit?: number;
  enabled?: boolean;
}

const PUBLIC_JOB_POSTINGS_CACHE_SCHEMA_VERSION = 2;

/**
 * 오프라인 캐시 대상 = 필터가 없거나 공고 종류(postingType)만 고른 기본 둘러보기.
 * 구인구직 탭은 종류 칩이 항상 하나 선택돼 있어 "필터 없음"만 캐시하면 한 번도 적중하지
 * 않았다. 지역·역할·급여·날짜처럼 좁히는 필터는 조합이 무한해 캐시하지 않는다(null).
 */
function getOfflineCacheKey(normalizedFilters: Record<string, unknown>): string | null {
  const keys = Object.keys(normalizedFilters);
  if (keys.some((key) => key !== 'postingType')) {
    return null;
  }
  const postingType = normalizedFilters.postingType;
  return `public-job-postings:default-list:${typeof postingType === 'string' ? postingType : 'all'}`;
}

export function useJobPostings(options: UseJobPostingsOptions = {}) {
  const { filters = {}, limit = 20, enabled = true } = options;
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const normalizedFilters = stableFilters(filters);
  const offlineCacheKey = getOfflineCacheKey(normalizedFilters);

  const query = useInfiniteQuery({
    queryKey: queryKeys.jobPostings.list(normalizedFilters),
    queryFn: async ({ pageParam }) => {
      return getJobPostings(filters, limit, pageParam as PaginationCursor);
    },
    initialPageParam: undefined as PaginationCursor,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled: enabled && isOnline,
    staleTime: queryCachingOptions.jobPostings.staleTime,
    gcTime: queryCachingOptions.jobPostings.gcTime,
  });

  const jobs = useMemo<JobPostingCard[]>(() => {
    const allJobs =
      query.data?.pages.flatMap((page) =>
        page.items.map((posting) => projectPostingCard(buildPostingFacts(posting)))
      ) ?? [];

    // 급여 정렬이 걸리면 서버가 이미 salary_*_max 순으로 페이지를 넘겨준다.
    // 여기서 날짜 정렬을 다시 걸면 그 순서가 통째로 덮어써지므로 서버 순서를 보존한다.
    const preserveServerOrder = filters.salarySort !== undefined;

    if (!filters.workDate) {
      return preserveServerOrder ? allJobs : sortJobPostings(allJobs);
    }

    const focusedJobs = allJobs
      .filter((job) => matchesPostingDate(job, filters.workDate))
      .map((job) => focusPostingCardToDate(job, filters.workDate));

    return preserveServerOrder ? focusedJobs : sortJobPostings(focusedJobs);
  }, [filters.salarySort, filters.workDate, query.data?.pages]);

  const cacheKeyToRead = enabled && !isOnline && query.data === undefined ? offlineCacheKey : null;

  const cachedJobs = useMemo(() => {
    if (!cacheKeyToRead) {
      return [];
    }

    return (
      getCriticalOfflineCache<JobPostingCard[]>(cacheKeyToRead, {
        ttlMs: offlineCachePolicies.jobPostings,
        schemaVersion: PUBLIC_JOB_POSTINGS_CACHE_SCHEMA_VERSION,
      })?.data ?? []
    );
  }, [cacheKeyToRead]);

  useEffect(() => {
    if (!offlineCacheKey || query.data === undefined) {
      return;
    }

    // 첫 페이지 분량만 쓴다 — 오프라인에서 필요한 건 첫 화면이고, 페이지가 붙을 때마다
    // 누적 전체를 직렬화하면 스크롤 중 JS 스레드가 막힌다.
    setCriticalOfflineCache(offlineCacheKey, jobs.slice(0, limit), {
      schemaVersion: PUBLIC_JOB_POSTINGS_CACHE_SCHEMA_VERSION,
    });
  }, [offlineCacheKey, jobs, limit, query.data]);

  const effectiveJobs = query.data !== undefined ? jobs : cachedJobs;

  const refresh = async () => {
    if (!isOnline) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: queryKeys.jobPostings.list(normalizedFilters),
    });
  };

  return {
    jobs: effectiveJobs,
    isLoading: effectiveJobs.length === 0 ? query.isLoading : false,
    isRefreshing: isOnline ? query.isRefetching && !query.isFetchingNextPage : false,
    isFetchingMore: isOnline ? query.isFetchingNextPage : false,
    hasMore: isOnline ? (query.hasNextPage ?? false) : false,
    error: isOnline ? query.error : null,
    refresh,
    loadMore: () => {
      if (isOnline && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
  };
}
