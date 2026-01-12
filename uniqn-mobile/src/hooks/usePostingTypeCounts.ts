/**
 * UNIQN Mobile - 공고 타입별 존재 여부 확인 훅
 *
 * @description 각 공고 타입별로 공고가 있는지 확인하여 자동 탭 선택에 사용
 * @version 1.0.0
 */

import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { queryKeys } from '@/lib/queryClient';
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
 * 특정 타입의 공고가 존재하는지 확인
 */
async function checkPostingTypeExists(postingType: PostingType): Promise<boolean> {
  try {
    const jobsRef = collection(getFirebaseDb(), 'jobPostings');
    const q = query(
      jobsRef,
      where('status', '==', 'active'),
      where('postingType', '==', postingType),
      limit(1)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    logger.warn('공고 타입 존재 확인 실패', { postingType, error });
    return false;
  }
}

/**
 * 모든 타입의 공고 존재 여부 확인
 */
async function fetchPostingTypeAvailability(): Promise<PostingTypeAvailability> {
  const [urgent, tournament, regular, fixed] = await Promise.all([
    checkPostingTypeExists('urgent'),
    checkPostingTypeExists('tournament'),
    checkPostingTypeExists('regular'),
    checkPostingTypeExists('fixed'),
  ]);

  return { urgent, tournament, regular, fixed };
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
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 10 * 60 * 1000, // 10분
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
