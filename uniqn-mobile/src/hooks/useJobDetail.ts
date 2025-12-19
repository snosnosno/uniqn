/**
 * UNIQN Mobile - 구인공고 상세 훅
 *
 * @description 단일 공고 상세 정보 조회
 * @version 1.0.0
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJobPostingById } from '@/services';
import { queryKeys } from '@/lib/queryClient';

// ============================================================================
// Types
// ============================================================================

interface UseJobDetailOptions {
  enabled?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useJobDetail(jobId: string, options: UseJobDetailOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.jobPostings.detail(jobId),
    queryFn: () => getJobPostingById(jobId),
    enabled: enabled && !!jobId,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 30 * 60 * 1000, // 30분
  });

  // 리프레시 함수
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.jobPostings.detail(jobId),
    });
    await query.refetch();
  };

  return {
    job: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    error: query.error,
    refresh,
  };
}

export default useJobDetail;
