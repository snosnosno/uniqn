/**
 * UNIQN Mobile - 구인공고 목록 훅
 *
 * @description TanStack Query 기반 무한스크롤 공고 목록
 * @version 1.2.0 - 정렬 로직 외부 유틸리티로 최적화
 */

import { useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getJobPostings, convertToCard } from '@/services';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { stableFilters } from '@/utils/queryUtils';
import { sortJobPostings } from '@/utils/jobPostingSorter';
import type { JobPostingFilters, JobPostingCard } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface UseJobPostingsOptions {
  filters?: JobPostingFilters;
  limit?: number;
  enabled?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useJobPostings(options: UseJobPostingsOptions = {}) {
  const { filters = {}, limit = 20, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.jobPostings.list(stableFilters(filters)),
    queryFn: async ({ pageParam }) => {
      const result = await getJobPostings(
        filters,
        limit,
        pageParam as import('firebase/firestore').QueryDocumentSnapshot<import('firebase/firestore').DocumentData> | undefined
      );
      return result;
    },
    initialPageParam: undefined as import('firebase/firestore').QueryDocumentSnapshot<import('firebase/firestore').DocumentData> | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
    enabled,
    staleTime: cachingPolicies.frequent, // 2분
    gcTime: cachingPolicies.standard * 2, // 10분
  });

  // 전체 데이터를 플랫하게 변환 후 정렬
  // @see utils/jobPostingSorter.ts - 최적화된 정렬 로직
  const jobs: JobPostingCard[] = useMemo(() => {
    const allJobs = query.data?.pages.flatMap((page) =>
      page.items.map(convertToCard)
    ) ?? [];

    return sortJobPostings(allJobs);
  }, [query.data]);

  const hasMore = query.hasNextPage ?? false;

  // 리프레시 함수
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.jobPostings.list(stableFilters(filters)),
    });
    await query.refetch();
  };

  return {
    jobs,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
    isFetchingMore: query.isFetchingNextPage,
    hasMore,
    error: query.error,
    refresh,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
  };
}

export default useJobPostings;
