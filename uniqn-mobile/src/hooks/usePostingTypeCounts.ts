/**
 * UNIQN Mobile - 공고 타입별 존재 여부 확인 훅
 *
 * @description 각 공고 타입별로 공고가 있는지 확인하여 자동 탭 선택에 사용
 * @version 1.1.0 - Repository 패턴 적용
 */

import { useQuery } from '@tanstack/react-query';
import { jobPostingRepository } from '@/repositories';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { logger } from '@/utils/logger';
import type { PostingType } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface PostingTypeAvailability {
  urgent: boolean;
  tournament: boolean;
  regular: boolean;
  fixed: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** 자동 탭 선택 우선순위 (공고가 있는 첫 번째 타입 선택) */
export const AUTO_SELECT_PRIORITY: PostingType[] = [
  'urgent',
  'tournament',
  'regular',
  'fixed',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 모든 타입의 공고 존재 여부 확인 (Repository 사용)
 */
async function fetchPostingTypeAvailability(): Promise<PostingTypeAvailability> {
  try {
    // Repository 메서드로 타입별 개수 조회
    const counts = await jobPostingRepository.getTypeCounts({ status: 'active' });

    // 개수 > 0 이면 존재
    return {
      urgent: counts.urgent > 0,
      tournament: counts.tournament > 0,
      regular: counts.regular > 0,
      fixed: counts.fixed > 0,
    };
  } catch (error) {
    logger.warn('공고 타입 존재 확인 실패', { error });
    // 에러 시 모두 false 반환 (graceful degradation)
    return {
      urgent: false,
      tournament: false,
      regular: false,
      fixed: false,
    };
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 공고 타입별 존재 여부 확인 훅
 *
 * @example
 * const { availability, firstAvailableType, isLoading } = usePostingTypeCounts();
 * // firstAvailableType: 우선순위에 따른 첫 번째 공고가 있는 타입
 */
export function usePostingTypeCounts() {
  const query_result = useQuery({
    queryKey: [...queryKeys.jobPostings.all, 'typeAvailability'] as const,
    queryFn: fetchPostingTypeAvailability,
    staleTime: cachingPolicies.frequent, // 2분
    gcTime: cachingPolicies.standard * 2, // 10분
  });

  // 우선순위에 따른 첫 번째 공고가 있는 타입 계산
  const firstAvailableType: PostingType | null = (() => {
    if (!query_result.data) return null;

    for (const type of AUTO_SELECT_PRIORITY) {
      if (query_result.data[type]) {
        return type;
      }
    }
    return null;
  })();

  return {
    /** 각 타입별 공고 존재 여부 */
    availability: query_result.data ?? {
      urgent: false,
      tournament: false,
      regular: false,
      fixed: false,
    },
    /** 우선순위에 따른 첫 번째 공고가 있는 타입 */
    firstAvailableType,
    /** 로딩 중 여부 */
    isLoading: query_result.isLoading,
    /** 에러 */
    error: query_result.error,
    /** 리프레시 */
    refetch: query_result.refetch,
  };
}

export default usePostingTypeCounts;
