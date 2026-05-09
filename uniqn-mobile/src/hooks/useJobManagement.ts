/**
 * UNIQN Mobile - Employer job posting management hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { getJobDetailQueryKey } from '@/hooks/useJobDetail';
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
import {
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  closeJobPosting,
  reopenJobPosting,
  getMyJobPostingStats,
  bulkUpdateJobPostingStatus,
  getMyJobPostings,
} from '@/services';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { createMutationErrorHandler } from '@/shared/errors';
import { buildCurrentUserIdentitySnapshot } from '@/shared/profile/identity';
import { requireAuth } from '@/errors';
import {
  requireOnlineForMutation,
  shouldApplyOptimisticUpdate,
} from '@/services/offline/remoteMutationGuard';
import type { CreateJobPostingInput, UpdateJobPostingInput, JobPostingStatus } from '@/types';

interface CreateJobParams {
  input: CreateJobPostingInput;
}

interface UpdateJobParams {
  jobPostingId: string;
  input: UpdateJobPostingInput;
}

interface BulkStatusParams {
  jobPostingIds: string[];
  status: JobPostingStatus;
}

function getMyJobPostingsQueryKey(userId?: string, workspaceId?: string) {
  return [
    ...queryKeys.jobManagement.myPostings(),
    userId ?? 'anonymous',
    workspaceId ?? 'no-workspace',
  ] as const;
}

function getMyJobPostingStatsQueryKey(userId?: string) {
  return [...queryKeys.jobManagement.stats(), userId ?? 'anonymous'] as const;
}

export function useMyJobPostings() {
  const { user } = useAuthStore();
  const { activeWorkspace } = useActiveWorkspace();
  const myPostingsQueryKey = getMyJobPostingsQueryKey(user?.uid, activeWorkspace?.id);

  return useQuery({
    queryKey: myPostingsQueryKey,
    queryFn: () => getMyJobPostings(user!.uid, { workspaceId: activeWorkspace!.id }),
    enabled: !!user && !!activeWorkspace?.id,
    staleTime: cachingPolicies.frequent,
  });
}

export function useJobPostingStats() {
  const { user } = useAuthStore();
  const statsQueryKey = getMyJobPostingStatsQueryKey(user?.uid);

  return useQuery({
    queryKey: statsQueryKey,
    queryFn: () => getMyJobPostingStats(user!.uid),
    enabled: !!user,
    staleTime: cachingPolicies.frequent,
  });
}

export function useCreateJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user, profile } = useAuthStore();

  return useMutation({
    mutationFn: (params: CreateJobParams) => {
      requireAuth(user?.uid, 'useJobManagement');
      const identity = buildCurrentUserIdentitySnapshot({
        profile,
        authUser: user,
        fallbackName: '익명',
      });
      const ownerName = profile?.name || profile?.nickname || user.displayName || '익명';
      requireOnlineForMutation('useJobManagement.createJobPosting');
      return createJobPosting(params.input, user.uid, identity.preferredName || ownerName);
    },
    onSuccess: () => {
      addToast({ type: 'success', message: '공고가 등록되었습니다.' });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: createMutationErrorHandler('공고 생성', addToast),
  });
}

export function useUpdateJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (params: UpdateJobParams) => {
      requireAuth(user?.uid, 'useJobManagement');
      requireOnlineForMutation('useJobManagement.updateJobPosting');
      return updateJobPosting(params.jobPostingId, params.input, user.uid);
    },
    onSuccess: (_, params) => {
      logger.info('공고 수정 완료', { jobPostingId: params.jobPostingId });
      addToast({ type: 'success', message: '공고가 수정되었습니다.' });

      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: getJobDetailQueryKey(params.jobPostingId, user?.uid),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.lists(),
      });
    },
    onError: createMutationErrorHandler('공고 수정', addToast),
  });
}

export function useDeleteJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const { activeWorkspace } = useActiveWorkspace();
  const myPostingsQueryKey = getMyJobPostingsQueryKey(user?.uid, activeWorkspace?.id);

  return useMutation({
    mutationFn: (jobPostingId: string) => {
      requireAuth(user?.uid, 'useJobManagement');
      requireOnlineForMutation('useJobManagement.deleteJobPosting');
      return deleteJobPosting(jobPostingId, user.uid);
    },
    onMutate: async (jobPostingId) => {
      if (!shouldApplyOptimisticUpdate()) {
        return { previous: undefined };
      }

      await queryClient.cancelQueries({ queryKey: myPostingsQueryKey });
      const previous = queryClient.getQueryData(myPostingsQueryKey);

      if (Array.isArray(previous)) {
        queryClient.setQueryData(
          myPostingsQueryKey,
          previous.filter((p: Record<string, unknown>) => p.id !== jobPostingId)
        );
      }

      return { previous };
    },
    onSuccess: (_, jobPostingId) => {
      logger.info('공고 삭제 완료', { jobPostingId });
      addToast({ type: 'success', message: '공고가 삭제되었습니다.' });

      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: createMutationErrorHandler('공고 삭제', addToast, {
      onRollback: (ctx) => {
        const { previous } = ctx as { previous: unknown };
        if (previous) {
          queryClient.setQueryData(myPostingsQueryKey, previous);
        }
      },
    }),
  });
}

export function useCloseJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const { activeWorkspace } = useActiveWorkspace();
  const myPostingsQueryKey = getMyJobPostingsQueryKey(user?.uid, activeWorkspace?.id);

  return useMutation({
    mutationFn: (jobPostingId: string) => {
      requireAuth(user?.uid, 'useJobManagement');
      requireOnlineForMutation('useJobManagement.closeJobPosting');
      return closeJobPosting(jobPostingId, user.uid);
    },
    onMutate: async (jobPostingId) => {
      await queryClient.cancelQueries({ queryKey: myPostingsQueryKey });
      const previous = queryClient.getQueryData(myPostingsQueryKey);

      if (Array.isArray(previous)) {
        queryClient.setQueryData(
          myPostingsQueryKey,
          previous.map((p: Record<string, unknown>) =>
            p.id === jobPostingId ? { ...p, status: 'closed' } : p
          )
        );
      }

      return { previous };
    },
    onSuccess: (_, jobPostingId) => {
      logger.info('공고 마감 완료', { jobPostingId });
      addToast({ type: 'success', message: '공고가 마감되었습니다.' });

      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: getJobDetailQueryKey(jobPostingId, user?.uid),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.lists(),
      });
    },
    onError: createMutationErrorHandler('공고 마감', addToast, {
      onRollback: (ctx) => {
        const { previous } = ctx as { previous: unknown };
        if (previous) {
          queryClient.setQueryData(myPostingsQueryKey, previous);
        }
      },
    }),
  });
}

export function useReopenJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const { activeWorkspace } = useActiveWorkspace();
  const myPostingsQueryKey = getMyJobPostingsQueryKey(user?.uid, activeWorkspace?.id);

  return useMutation({
    mutationFn: (jobPostingId: string) => {
      requireAuth(user?.uid, 'useJobManagement');
      requireOnlineForMutation('useJobManagement.reopenJobPosting');
      return reopenJobPosting(jobPostingId, user.uid);
    },
    onMutate: async (jobPostingId) => {
      await queryClient.cancelQueries({ queryKey: myPostingsQueryKey });
      const previous = queryClient.getQueryData(myPostingsQueryKey);

      if (Array.isArray(previous)) {
        queryClient.setQueryData(
          myPostingsQueryKey,
          previous.map((p: Record<string, unknown>) =>
            p.id === jobPostingId ? { ...p, status: 'active' } : p
          )
        );
      }

      return { previous };
    },
    onSuccess: (_, jobPostingId) => {
      logger.info('공고 재오픈 완료', { jobPostingId });
      addToast({ type: 'success', message: '공고가 다시 활성화되었습니다.' });

      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: getJobDetailQueryKey(jobPostingId, user?.uid),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.lists(),
      });
    },
    onError: createMutationErrorHandler('공고 재오픈', addToast, {
      onRollback: (ctx) => {
        const { previous } = ctx as { previous: unknown };
        if (previous) {
          queryClient.setQueryData(myPostingsQueryKey, previous);
        }
      },
    }),
  });
}

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const { activeWorkspace } = useActiveWorkspace();
  const myPostingsQueryKey = getMyJobPostingsQueryKey(user?.uid, activeWorkspace?.id);

  return useMutation({
    mutationFn: (params: BulkStatusParams) => {
      requireAuth(user?.uid, 'useJobManagement');
      requireOnlineForMutation('useJobManagement.bulkUpdateStatus');
      return bulkUpdateJobPostingStatus(params.jobPostingIds, params.status, user.uid);
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: myPostingsQueryKey });
      const previous = queryClient.getQueryData(myPostingsQueryKey);

      if (Array.isArray(previous)) {
        queryClient.setQueryData(
          myPostingsQueryKey,
          previous.map((p: Record<string, unknown>) =>
            params.jobPostingIds.includes(p.id as string) ? { ...p, status: params.status } : p
          )
        );
      }

      return { previous };
    },
    onSuccess: (successCount) => {
      logger.info('공고 일괄 상태 변경 완료', { successCount });
      addToast({
        type: 'success',
        message: `${successCount}개 공고의 상태가 변경되었습니다.`,
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: createMutationErrorHandler('공고 일괄 상태 변경', addToast, {
      onRollback: (ctx) => {
        const { previous } = ctx as { previous: unknown };
        if (previous) {
          queryClient.setQueryData(myPostingsQueryKey, previous);
        }
      },
    }),
  });
}

export function useJobManagement() {
  const myPostingsQuery = useMyJobPostings();
  const statsQuery = useJobPostingStats();

  const createMutation = useCreateJobPosting();
  const updateMutation = useUpdateJobPosting();
  const deleteMutation = useDeleteJobPosting();
  const closeMutation = useCloseJobPosting();
  const reopenMutation = useReopenJobPosting();
  const bulkStatusMutation = useBulkUpdateStatus();

  return {
    myPostings: myPostingsQuery.data ?? [],
    isLoadingPostings: myPostingsQuery.isLoading,
    postingsError: myPostingsQuery.error,
    refreshPostings: myPostingsQuery.refetch,

    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,

    createJobPosting: useThrottledCallback(createMutation.mutate, 1000),
    createJobPostingAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateJobPosting: updateMutation.mutate,
    updateJobPostingAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    deleteJobPosting: useThrottledCallback(deleteMutation.mutate, 1000),
    isDeleting: deleteMutation.isPending,

    closeJobPosting: closeMutation.mutate,
    isClosing: closeMutation.isPending,

    reopenJobPosting: reopenMutation.mutate,
    isReopening: reopenMutation.isPending,

    bulkUpdateStatus: bulkStatusMutation.mutate,
    isBulkUpdating: bulkStatusMutation.isPending,
  };
}

export default useJobManagement;
