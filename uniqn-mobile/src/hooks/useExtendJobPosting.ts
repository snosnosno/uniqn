/**
 * UNIQN Mobile - 공고 기간 연장 hook (Lane D — featured/extend, 마이그 미적용 DRAFT)
 *
 * @description extend_job_posting RPC 배선. 다이아 차감 + 근무일/만료일 연장 + 재오픈은
 *   서버(RPC) 권위. 성공 시 toast + jobManagement/jobPostings 쿼리 무효화.
 *   ⚠️ RPC 가 prod 에 미적용(DRAFT)이라 현재 UI 노출은 없음.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { extendJobPosting } from '@/services';
import { getJobDetailQueryKey } from '@/hooks/useJobDetail';
import { queryKeys } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { createMutationErrorHandler } from '@/shared/errors';
import { requireAuth } from '@/errors';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';

interface ExtendJobParams {
  jobPostingId: string;
  extendDays?: number;
}

export function useExtendJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({ jobPostingId, extendDays }: ExtendJobParams) => {
      requireAuth(user?.uid, 'useExtendJobPosting');
      requireOnlineForMutation('useExtendJobPosting.extendJobPosting');
      return extendJobPosting(jobPostingId, user.uid, extendDays);
    },
    onSuccess: (_, { jobPostingId }) => {
      logger.info('공고 연장 완료', { jobPostingId });
      addToast({ type: 'success', message: '공고 기간이 연장되었습니다.' });

      queryClient.invalidateQueries({ queryKey: queryKeys.jobManagement.all });
      queryClient.invalidateQueries({
        queryKey: getJobDetailQueryKey(jobPostingId, user?.uid),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.lists() });
    },
    onError: createMutationErrorHandler('공고 연장', addToast),
  });
}

export default useExtendJobPosting;
