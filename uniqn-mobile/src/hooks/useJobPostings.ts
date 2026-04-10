import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildPostingFacts,
  focusPostingCardToDate,
  matchesPostingDate,
  projectPostingCard,
} from '@/domains/job-posting';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queryCachingOptions, queryKeys } from '@/lib/queryClient';
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

export function useJobPostings(options: UseJobPostingsOptions = {}) {
  const { filters = {}, limit = 20, enabled = true } = options;
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const normalizedFilters = stableFilters(filters);
  const isDefaultFilter = Object.keys(normalizedFilters).length === 0;

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

    if (!filters.workDate) {
      return sortJobPostings(allJobs);
    }

    const focusedJobs = allJobs
      .filter((job) => matchesPostingDate(job, filters.workDate))
      .map((job) => focusPostingCardToDate(job, filters.workDate));

    return sortJobPostings(focusedJobs);
  }, [filters.workDate, query.data?.pages]);

  const shouldUseCachedJobs = enabled && isDefaultFilter && !isOnline && query.data === undefined;

  const cachedJobs = useMemo(() => {
    if (!shouldUseCachedJobs) {
      return [];
    }

    return (
      getCriticalOfflineCache<JobPostingCard[]>('public-job-postings:default-list', {
        ttlMs: queryCachingOptions.jobPostings.staleTime,
        schemaVersion: PUBLIC_JOB_POSTINGS_CACHE_SCHEMA_VERSION,
      })?.data ?? []
    );
  }, [shouldUseCachedJobs]);

  useEffect(() => {
    if (!isDefaultFilter || query.data === undefined) {
      return;
    }

    setCriticalOfflineCache('public-job-postings:default-list', jobs, {
      schemaVersion: PUBLIC_JOB_POSTINGS_CACHE_SCHEMA_VERSION,
    });
  }, [isDefaultFilter, jobs, query.data]);

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

export default useJobPostings;
