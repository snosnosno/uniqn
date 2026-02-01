/**
 * UNIQN Mobile - 취소 요청 관리 훅
 *
 * @description 취소 요청 조회 및 검토
 * @version 1.0.0
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { getCancellationRequests, reviewCancellationRequest } from '@/services';
import { queryKeys, cachingPolicies, invalidateRelated } from '@/lib';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { createMutationErrorHandler } from '@/shared/errors';

// ============================================================================
// Types
// ============================================================================

interface ReviewCancellationInput {
  applicationId: string;
  approved: boolean;
  rejectionReason?: string;
}

// ============================================================================
// 취소 요청 관리 훅
// ============================================================================

/**
 * 공고별 취소 요청 조회 훅
 */
export function useCancellationRequests(jobPostingId: string) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.applicantManagement.cancellationRequests(jobPostingId),
    queryFn: () => getCancellationRequests(jobPostingId, user!.uid),
    enabled: !!user && !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });
}

/**
 * 취소 요청 검토 뮤테이션 훅
 */
export function useReviewCancellation() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ReviewCancellationInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return reviewCancellationRequest(
        {
          applicationId: input.applicationId,
          approved: input.approved,
          rejectionReason: input.rejectionReason,
        },
        user.uid
      );
    },
    onSuccess: (_, variables) => {
      const action = variables.approved ? '승인' : '거절';
      logger.info(`취소 요청 ${action} 완료`, { applicationId: variables.applicationId });
      addToast({
        type: 'success',
        message: `취소 요청이 ${action}되었습니다.`,
      });

      // 이벤트 기반 캐시 무효화
      invalidateRelated('applicant.reviewCancellation');
    },
    onError: createMutationErrorHandler('취소 요청 검토', addToast),
  });
}
