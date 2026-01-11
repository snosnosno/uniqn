/**
 * UNIQN Mobile - 공고 관리 훅 (구인자용)
 *
 * @description 공고 생성, 수정, 삭제, 상태 관리
 * @version 1.0.0
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type {
  CreateJobPostingInput,
  UpdateJobPostingInput,
  JobPostingStatus,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// 내 공고 목록 조회 훅
// ============================================================================

/**
 * 내 공고 목록 조회 (구인자)
 */
export function useMyJobPostings() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.jobManagement.myPostings(),
    queryFn: () => getMyJobPostings(user!.uid),
    enabled: !!user,
    staleTime: cachingPolicies.frequent,
  });
}

// ============================================================================
// 공고 통계 조회 훅
// ============================================================================

/**
 * 내 공고 통계 조회 (구인자)
 */
export function useJobPostingStats() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.jobManagement.stats(),
    queryFn: () => getMyJobPostingStats(user!.uid),
    enabled: !!user,
    staleTime: cachingPolicies.frequent,
  });
}

// ============================================================================
// 공고 CRUD 훅
// ============================================================================

/**
 * 공고 생성 뮤테이션 훅
 *
 * @description
 * - regular/urgent 타입에서 여러 날짜 선택 시 날짜별로 개별 공고 생성
 * - 단일 생성 시 CreateJobPostingResult, 다중 생성 시 CreateJobPostingResult[] 반환
 */
export function useCreateJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (params: CreateJobParams) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return createJobPosting(
        params.input,
        user.uid,
        user.displayName ?? '익명'
      );
    },
    onSuccess: (data) => {
      // 다중 공고 생성 여부 확인
      if (Array.isArray(data)) {
        logger.info('다중 공고 생성 완료', {
          count: data.length,
          ids: data.map((d) => d.id),
        });
        addToast({
          type: 'success',
          message: `${data.length}개의 공고가 등록되었습니다.`,
        });
      } else {
        logger.info('공고 생성 완료', { jobPostingId: data.id });
        addToast({ type: 'success', message: '공고가 등록되었습니다.' });
      }

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: (error) => {
      logger.error('공고 생성 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 등록에 실패했습니다.',
      });
    },
  });
}

/**
 * 공고 수정 뮤테이션 훅
 */
export function useUpdateJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (params: UpdateJobParams) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return updateJobPosting(params.jobPostingId, params.input, user.uid);
    },
    onSuccess: (_, params) => {
      logger.info('공고 수정 완료', { jobPostingId: params.jobPostingId });
      addToast({ type: 'success', message: '공고가 수정되었습니다.' });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.detail(params.jobPostingId),
      });
    },
    onError: (error) => {
      logger.error('공고 수정 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 수정에 실패했습니다.',
      });
    },
  });
}

/**
 * 공고 삭제 뮤테이션 훅
 */
export function useDeleteJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (jobPostingId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return deleteJobPosting(jobPostingId, user.uid);
    },
    onSuccess: (_, jobPostingId) => {
      logger.info('공고 삭제 완료', { jobPostingId });
      addToast({ type: 'success', message: '공고가 삭제되었습니다.' });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: (error) => {
      logger.error('공고 삭제 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 삭제에 실패했습니다.',
      });
    },
  });
}

// ============================================================================
// 공고 상태 변경 훅
// ============================================================================

/**
 * 공고 마감 뮤테이션 훅
 */
export function useCloseJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (jobPostingId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return closeJobPosting(jobPostingId, user.uid);
    },
    onSuccess: (_, jobPostingId) => {
      logger.info('공고 마감 완료', { jobPostingId });
      addToast({ type: 'success', message: '공고가 마감되었습니다.' });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.detail(jobPostingId),
      });
    },
    onError: (error) => {
      logger.error('공고 마감 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 마감에 실패했습니다.',
      });
    },
  });
}

/**
 * 공고 재오픈 뮤테이션 훅
 */
export function useReopenJobPosting() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (jobPostingId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return reopenJobPosting(jobPostingId, user.uid);
    },
    onSuccess: (_, jobPostingId) => {
      logger.info('공고 재오픈 완료', { jobPostingId });
      addToast({ type: 'success', message: '공고가 다시 활성화되었습니다.' });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.detail(jobPostingId),
      });
    },
    onError: (error) => {
      logger.error('공고 재오픈 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 재오픈에 실패했습니다.',
      });
    },
  });
}

/**
 * 공고 일괄 상태 변경 뮤테이션 훅
 */
export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (params: BulkStatusParams) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return bulkUpdateJobPostingStatus(
        params.jobPostingIds,
        params.status,
        user.uid
      );
    },
    onSuccess: (successCount) => {
      logger.info('공고 일괄 상태 변경 완료', { successCount });
      addToast({
        type: 'success',
        message: `${successCount}개 공고 상태가 변경되었습니다.`,
      });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: (error) => {
      logger.error('공고 일괄 상태 변경 실패', error as Error);
      addToast({
        type: 'error',
        message: '상태 변경에 실패했습니다.',
      });
    },
  });
}

// ============================================================================
// 통합 훅
// ============================================================================

/**
 * 공고 관리 통합 훅 (구인자)
 *
 * @description 공고 관리에 필요한 모든 기능 제공
 */
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
    // 내 공고 목록
    myPostings: myPostingsQuery.data ?? [],
    isLoadingPostings: myPostingsQuery.isLoading,
    postingsError: myPostingsQuery.error,
    refreshPostings: myPostingsQuery.refetch,

    // 통계
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,

    // 공고 CRUD
    createJobPosting: createMutation.mutate,
    createJobPostingAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateJobPosting: updateMutation.mutate,
    updateJobPostingAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    deleteJobPosting: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,

    // 상태 변경
    closeJobPosting: closeMutation.mutate,
    isClosing: closeMutation.isPending,

    reopenJobPosting: reopenMutation.mutate,
    isReopening: reopenMutation.isPending,

    bulkUpdateStatus: bulkStatusMutation.mutate,
    isBulkUpdating: bulkStatusMutation.isPending,
  };
}

export default useJobManagement;
