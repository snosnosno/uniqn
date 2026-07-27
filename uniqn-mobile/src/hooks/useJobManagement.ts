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
  /**
   * 편집을 시작한 시점의 `updatedAt`(낙관적 잠금 baseline).
   * `null` 이면 잠금 없이 덮어쓴다 — 충돌 안내를 본 사용자가 재저장한 경우.
   */
  expectedUpdatedAt: string | null;
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

/**
 * mutation hook 들이 optimistic update 의 cancel/get/set/rollback 에 사용하는 queryKey 헬퍼.
 *
 * 4 mutation hook (delete/close/reopen/bulkUpdate) 가 동일한 user.uid + activeWorkspace.id
 * 조합으로 queryKey 를 만들었던 보일러플레이트를 추출. activeWorkspace 가 미전달인
 * 호출자 (admin global view 등) 에서도 fallback 'no-workspace' 키로 ghost cache 회피.
 */
function useMyPostingsQueryKey() {
  const { user } = useAuthStore();
  const { activeWorkspace } = useActiveWorkspace();
  return getMyJobPostingsQueryKey(user?.uid, activeWorkspace?.id);
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
  // P1#8: 목록 조회와 동일한 활성 워크스페이스 스코프로 공고를 생성한다.
  // 미선택(undefined)이면 서비스가 default 워크스페이스로 fallback.
  const { activeWorkspace } = useActiveWorkspace();

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
      return createJobPosting(
        params.input,
        user.uid,
        identity.preferredName || ownerName,
        activeWorkspace?.id
      );
    },
    onSuccess: () => {
      // 성공 토스트는 호출부(create 화면, postingType별 문구)가 담당 — 중복 토스트 제거(P2-2).
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
      // 그리드 "공고 열기/부족 모집" 발행 시 셀 +N 뱃지·스팬 집계 갱신(venue 무관 무해).
      queryClient.invalidateQueries({
        queryKey: queryKeys.workSchedule.all,
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
      return updateJobPosting(
        params.jobPostingId,
        params.input,
        user.uid,
        params.expectedUpdatedAt
      );
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
      // 공고의 인원·상태가 바뀌면 근무표 셀(부족/공고 뱃지·필요 인원)도 다시 계산돼야 한다.
      // 종전에는 '생성'에만 이 무효화가 있어, 수정·마감·삭제·재개방 후 근무표가 옛 수치를
      // 그대로 보여줬다(같은 날 중복 공고를 유도하는 경로). 라이프사이클 전체로 확장한다.
      queryClient.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
    },
    onError: createMutationErrorHandler('공고 수정', addToast),
  });
}

export function useDeleteJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const myPostingsQueryKey = useMyPostingsQueryKey();

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
      // 근무표 셀 재계산(공고 라이프사이클 전체 무효화 — useUpdateJobPosting 주석 참고).
      queryClient.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
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
  const myPostingsQueryKey = useMyPostingsQueryKey();

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
      // 근무표 셀 재계산(공고 라이프사이클 전체 무효화 — useUpdateJobPosting 주석 참고).
      queryClient.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
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
  const myPostingsQueryKey = useMyPostingsQueryKey();

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
      // 근무표 셀 재계산(공고 라이프사이클 전체 무효화 — useUpdateJobPosting 주석 참고).
      queryClient.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
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
  const myPostingsQueryKey = useMyPostingsQueryKey();

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
      // 근무표 셀 재계산(공고 라이프사이클 전체 무효화 — useUpdateJobPosting 주석 참고).
      queryClient.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
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
