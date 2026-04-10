import { useQuery } from '@tanstack/react-query';
import { STATUS } from '@/constants';
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

async function fetchPostingTypeCounts(): Promise<PostingTypeCounts> {
  try {
    return await jobPostingRepository.getTypeCounts({ status: STATUS.JOB_POSTING.ACTIVE });
  } catch (error) {
    logger.warn('공고 타입 개수 조회 실패', { error });
    throw error;
  }
}

export function usePostingTypeCounts() {
  const { status } = useAuthStore();

  const queryResult = useQuery({
    queryKey: [...queryKeys.jobPostings.all, 'typeCounts'] as const,
    queryFn: fetchPostingTypeCounts,
    staleTime: cachingPolicies.frequent,
    gcTime: cachingPolicies.standard * 2,
    enabled: status === 'authenticated',
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

export default usePostingTypeCounts;
