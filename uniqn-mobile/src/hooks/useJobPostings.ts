/**
 * UNIQN Mobile - 구인공고 목록 훅
 *
 * @description TanStack Query 기반 무한스크롤 공고 목록
 * @version 1.0.0
 */

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getJobPostings, convertToCard } from '@/services';
import { queryKeys } from '@/lib/queryClient';
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
    queryKey: queryKeys.jobPostings.list(filters as Record<string, unknown>),
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
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 10 * 60 * 1000, // 10분
  });

  // 전체 데이터를 플랫하게 변환
  const jobs: JobPostingCard[] = query.data?.pages.flatMap((page) =>
    page.items.map(convertToCard)
  ) ?? [];
  const hasMore = query.hasNextPage ?? false;

  // 리프레시 함수
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.jobPostings.list(filters as Record<string, unknown>),
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
