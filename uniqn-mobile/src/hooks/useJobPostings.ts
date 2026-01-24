/**
 * UNIQN Mobile - 구인공고 목록 훅
 *
 * @description TanStack Query 기반 무한스크롤 공고 목록
 * @version 1.1.0 - 날짜 정렬 추가
 */

import { useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getJobPostings, convertToCard } from '@/services';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
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
    staleTime: cachingPolicies.frequent, // 2분
    gcTime: cachingPolicies.standard * 2, // 10분
  });

  // 전체 데이터를 플랫하게 변환 후 정렬
  const jobs: JobPostingCard[] = useMemo(() => {
    const allJobs = query.data?.pages.flatMap((page) =>
      page.items.map(convertToCard)
    ) ?? [];

    // 오늘 날짜
    const today = new Date().toISOString().split('T')[0] ?? '';

    // 공고별 가장 빠른 미래 날짜+시간 계산
    const getEarliestFutureDateTime = (job: JobPostingCard): string => {
      // dateRequirements에서 가장 빠른 미래 날짜+시간 찾기
      if (job.dateRequirements?.length) {
        const futureDateTimes: string[] = [];
        const pastDateTimes: string[] = [];

        for (const dr of job.dateRequirements) {
          // 가장 빠른 시작 시간 찾기
          const times = dr.timeSlots
            ?.filter((ts) => !ts.isTimeToBeAnnounced && ts.startTime)
            .map((ts) => ts.startTime)
            .sort() ?? [];
          const earliestTime = times[0] ?? '99:99';

          const dateTime = `${dr.date} ${earliestTime}`;
          if (dr.date >= today) {
            futureDateTimes.push(dateTime);
          } else {
            pastDateTimes.push(dateTime);
          }
        }

        if (futureDateTimes.length > 0) {
          return futureDateTimes.sort()[0] ?? '9999-99-99 99:99';
        }
        if (pastDateTimes.length > 0) {
          return pastDateTimes.sort().reverse()[0] ?? '9999-99-99 99:99';
        }
      }
      // 레거시: workDate + timeSlot
      const time = job.timeSlot?.split(' - ')[0] ?? '99:99';
      return `${job.workDate || '9999-99-99'} ${time}`;
    };

    // 정렬: 오늘 이후 날짜 먼저 (가까운 순), 그 다음 과거 날짜 (최근 순)
    return allJobs.sort((a, b) => {
      const dateTimeA = getEarliestFutureDateTime(a);
      const dateTimeB = getEarliestFutureDateTime(b);

      // 날짜 부분만 추출해서 미래/과거 판단
      const dateA = dateTimeA.split(' ')[0] ?? '';
      const dateB = dateTimeB.split(' ')[0] ?? '';

      const aIsFuture = dateA >= today;
      const bIsFuture = dateB >= today;

      // 미래 날짜가 과거보다 먼저
      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      // 둘 다 미래: 가까운 날짜+시간 먼저
      if (aIsFuture && bIsFuture) {
        return dateTimeA.localeCompare(dateTimeB);
      }

      // 둘 다 과거: 최근 날짜+시간 먼저
      return dateTimeB.localeCompare(dateTimeA);
    });
  }, [query.data]);

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
