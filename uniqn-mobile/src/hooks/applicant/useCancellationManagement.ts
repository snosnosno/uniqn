/**
 * UNIQN Mobile - cancellation management hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/errors/guardErrors';
import { cachingPolicies, invalidateRelated, queryKeys } from '@/lib';
import { createMutationErrorHandler } from '@/shared/errors';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { getCancellationRequests, reviewCancellationRequest } from '@/services';
import { findJobPostingIdForApplications } from './cacheContext';

interface ReviewCancellationInput {
  applicationId: string;
  approved: boolean;
  rejectionReason?: string;
}

export function useCancellationRequests(jobPostingId: string) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.applicantManagement.cancellationRequests(jobPostingId, user?.uid),
    queryFn: () => getCancellationRequests(jobPostingId, user!.uid),
    enabled: !!user && !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });
}

export function useReviewCancellation() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ReviewCancellationInput) => {
      requireAuth(user?.uid, 'useCancellationManagement');
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
      const jobPostingId = findJobPostingIdForApplications(queryClient, [variables.applicationId]);
      const action = variables.approved ? '승인' : '거절';

      logger.info(`취소 요청 ${action} 완료`, { applicationId: variables.applicationId });
      addToast({
        type: 'success',
        message: `취소 요청이 ${action}되었습니다.`,
      });

      invalidateRelated(
        'applicant.reviewCancellation',
        jobPostingId ? { jobPostingId } : undefined
      );
    },
    onError: createMutationErrorHandler('취소 요청 검토', addToast),
  });
}
