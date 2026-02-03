/**
 * UNIQN Mobile - 구인공고 상세 훅
 *
 * @description 단일 공고 상세 정보 조회
 * @version 1.1.0
 *
 * @changelog
 * - 1.1.0: staleTime: 0으로 변경 (지원 직전 최신 데이터 필요)
 *          gcTime은 유지하여 뒤로가기 시 즉시 표시
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getJobPostingById } from '@/services';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';

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
    // 공고 상세는 지원 직전 확인이므로 항상 fresh fetch
    staleTime: 0,
    // 뒤로가기 시 즉시 표시를 위해 메모리 유지
    gcTime: cachingPolicies.standard,
  });

  // 리프레시 함수 (useCallback으로 안정화)
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.jobPostings.detail(jobId),
    });
    await query.refetch();
  }, [queryClient, jobId, query]);

  return {
    job: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    error: query.error,
    refresh,
  };
}

export default useJobDetail;
