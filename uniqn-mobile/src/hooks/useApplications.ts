/**
 * UNIQN Mobile - 지원 관리 훅
 *
 * @description 지원서 제출, 조회, 취소 관리
 * @version 1.0.0
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyApplications, applyToJob, cancelApplication as cancelApplicationService } from '@/services';
import { queryKeys } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import type { Application, StaffRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface SubmitApplicationParams {
  jobPostingId: string;
  role: StaffRole;
  message?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useApplications() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  // 내 지원 내역 조회
  const myApplicationsQuery = useQuery({
    queryKey: queryKeys.applications.mine(),
    queryFn: () => getMyApplications(user!.uid),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2분
  });

  // 지원 제출
  const submitMutation = useMutation({
    mutationFn: (params: SubmitApplicationParams) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return applyToJob(
        {
          jobPostingId: params.jobPostingId,
          appliedRole: params.role,
          message: params.message,
        },
        user.uid,
        user.displayName ?? '익명',
        user.phoneNumber ?? undefined
      );
    },
    onSuccess: (data) => {
      logger.info('지원 완료', { applicationId: data.id });
      addToast({ type: 'success', message: '지원이 완료되었습니다.' });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.mine(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: (error) => {
      logger.error('지원 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '지원에 실패했습니다.',
      });
    },
  });

  // 지원 취소
  const cancelMutation = useMutation({
    mutationFn: (applicationId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return cancelApplicationService(applicationId, user.uid);
    },
    onSuccess: (_, applicationId) => {
      logger.info('지원 취소', { applicationId });
      addToast({ type: 'success', message: '지원이 취소되었습니다.' });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.mine(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: (error) => {
      logger.error('지원 취소 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '취소에 실패했습니다.',
      });
    },
  });

  // 특정 공고 지원 여부 확인
  const hasApplied = (jobPostingId: string): boolean => {
    const applications: Application[] = myApplicationsQuery.data ?? [];
    return applications.some(
      (app: Application) => app.jobPostingId === jobPostingId && app.status !== 'cancelled'
    );
  };

  // 특정 공고 지원 상태 조회
  const getApplicationStatus = (jobPostingId: string): Application | null => {
    const applications: Application[] = myApplicationsQuery.data ?? [];
    return (
      applications.find(
        (app: Application) => app.jobPostingId === jobPostingId && app.status !== 'cancelled'
      ) ?? null
    );
  };

  return {
    // 내 지원 내역
    myApplications: myApplicationsQuery.data ?? [],
    isLoading: myApplicationsQuery.isLoading,
    isRefreshing: myApplicationsQuery.isRefetching,
    error: myApplicationsQuery.error,

    // 지원 제출
    submitApplication: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,

    // 지원 취소
    cancelApplication: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,

    // 유틸리티
    hasApplied,
    getApplicationStatus,

    // 리프레시
    refresh: () => myApplicationsQuery.refetch(),
  };
}

export default useApplications;
