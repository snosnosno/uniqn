import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';
import type { PostingTypeCounts } from '@/repositories/interfaces/IJobPostingRepository';
import { useAuthStore } from '@/stores/authStore';
import type { PostingType } from '@/types';
import { logger } from '@/utils/logger';

export interface PostingTypeAvailability {
  urgent: boolean;
  tournament: boolean;
  regular: boolean;
  fixed: boolean;
}

const DEFAULT_COUNTS: PostingTypeCounts = {
  regular: 0,
  urgent: 0,
  fixed: 0,
  tournament: 0,
  total: 0,
};

export const AUTO_SELECT_PRIORITY: PostingType[] = ['urgent', 'tournament', 'regular', 'fixed'];

async function fetchPostingTypeCounts(
  region: string | null,
  regions: string[]
): Promise<PostingTypeCounts> {
  try {
    // status 미지정 → 브라우즈 가시성 기본값(active + capacity_full)으로 집계.
    // (EF-jobsearch-11: 정원 마감 공고가 칩 카운트에서 누락되던 회귀)
    // 지역 지정 시 해당 지역으로 좁혀 브라우즈 목록(getList)의 지역 필터와 정합(A1).
    // regions(멀티/그룹 확장)가 region(단일)보다 우선 — repository applyRegionScope 와 동일 규칙.
    if (regions.length > 0) {
      return await jobPostingRepository.getTypeCounts({ regions });
    }
    return await jobPostingRepository.getTypeCounts(region ? { region } : undefined);
  } catch (error) {
    logger.warn('공고 타입 개수 조회 실패', { error });
    throw error;
  }
}

export interface UsePostingTypeCountsOptions {
  /** 선택된 지역 slug. 지정 시 칩 카운트를 해당 지역으로 좁힌다. */
  region?: string | null;
  /** 지역 slug 목록(그룹 확장 결과). 비어있지 않으면 region 보다 우선. */
  regions?: string[];
  /**
   * 지역 변경으로 캐시 키가 바뀌어도 직전 카운트를 placeholder 로 유지.
   * 필터 시트의 "공고 N건 보기" 라벨 플리커 방지용 — 목록 화면 칩은 기본값(false) 유지.
   */
  keepPreviousCounts?: boolean;
}

export function usePostingTypeCounts(options?: UsePostingTypeCountsOptions) {
  const { status } = useAuthStore();
  const region = options?.region ?? null;
  const regions = options?.regions ?? [];
  // 배열 identity 무관하게 캐시 키 안정화 (slug 에 ',' 미포함 — regions.ts 계약)
  const regionScopeKey = regions.length > 0 ? regions.join(',') : region;

  const queryResult = useQuery({
    queryKey: [...queryKeys.jobPostings.all, 'typeCounts', regionScopeKey] as const,
    queryFn: () => fetchPostingTypeCounts(region, regions),
    staleTime: cachingPolicies.frequent,
    gcTime: cachingPolicies.standard * 2,
    enabled: status === 'authenticated',
    ...(options?.keepPreviousCounts ? { placeholderData: keepPreviousData } : {}),
  });

  const counts = queryResult.isSuccess ? queryResult.data : undefined;
  const resolvedCounts = counts ?? DEFAULT_COUNTS;
  const hasCounts = counts !== undefined;

  const availability: PostingTypeAvailability = {
    urgent: resolvedCounts.urgent > 0,
    tournament: resolvedCounts.tournament > 0,
    regular: resolvedCounts.regular > 0,
    fixed: resolvedCounts.fixed > 0,
  };

  const firstAvailableType: PostingType | null = (() => {
    for (const type of AUTO_SELECT_PRIORITY) {
      if (resolvedCounts[type] > 0) {
        return type;
      }
    }

    return null;
  })();

  return {
    availability,
    counts,
    hasCounts,
    firstAvailableType,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
  };
}
