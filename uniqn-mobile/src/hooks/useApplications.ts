/**
 * UNIQN Mobile - 지원 관리 훅
 *
 * @description 지원서 제출, 조회, 취소 관리
 * @version 2.0.0 - v2.0 Assignment + PreQuestion 지원
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyApplications,
  applyToJobV2,
  cancelApplication as cancelApplicationService,
  requestCancellation as requestCancellationService,
} from '@/services';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';
import { createMutationErrorHandler } from '@/shared/errors';
import type { Application, Assignment, PreQuestionAnswer } from '@/types';

// ============================================================================
// Types
// ============================================================================

/** v2.0 지원 파라미터 (Assignment + PreQuestion) */
interface SubmitApplicationV2Params {
  jobPostingId: string;
  assignments: Assignment[];
  preQuestionAnswers?: PreQuestionAnswer[];
  message?: string;
}

/** 취소 요청 파라미터 */
interface RequestCancellationParams {
  applicationId: string;
  reason: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useApplications() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user, profile } = useAuthStore();

  // 내 지원 내역 조회
  const myApplicationsQuery = useQuery({
    queryKey: queryKeys.applications.mine(),
    queryFn: () => getMyApplications(user!.uid),
    enabled: !!user,
    staleTime: cachingPolicies.frequent, // 2분
  });

  // 지원 제출 (v2.0: Assignment + PreQuestion)
  const submitV2Mutation = useMutation({
    mutationFn: (params: SubmitApplicationV2Params) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      // Firestore profile 우선, Auth displayName 폴백
      const applicantName = profile?.name || profile?.nickname || user.displayName || '익명';
      const applicantPhone = profile?.phone || user.phoneNumber || undefined;
      const applicantNickname = profile?.nickname || undefined;
      const applicantPhotoURL = profile?.photoURL || user.photoURL || undefined;
      return applyToJobV2(
        {
          jobPostingId: params.jobPostingId,
          assignments: params.assignments,
          preQuestionAnswers: params.preQuestionAnswers,
          message: params.message,
        },
        user.uid,
        applicantName,
        applicantPhone,
        undefined, // applicantEmail은 나중에 추가
        applicantNickname,
        applicantPhotoURL
      );
    },
    onSuccess: (data) => {
      logger.info('v2.0 지원 완료', {
        applicationId: data.id,
        assignmentCount: data.assignments?.length ?? 0,
      });
      addToast({ type: 'success', message: '지원이 완료되었습니다.' });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.mine(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: createMutationErrorHandler('v2.0 지원', addToast),
  });

  // 지원 취소 (Optimistic Update 적용)
  const cancelMutation = useMutation({
    mutationFn: (applicationId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return cancelApplicationService(applicationId, user.uid);
    },
    // Optimistic Update: 서버 응답 전에 UI 즉시 업데이트
    onMutate: async (applicationId: string) => {
      // 진행 중인 refetch 취소 (낙관적 업데이트와 충돌 방지)
      await queryClient.cancelQueries({
        queryKey: queryKeys.applications.mine(),
      });

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousApplications = queryClient.getQueryData<Application[]>(
        queryKeys.applications.mine()
      );

      // 낙관적으로 UI 업데이트 (취소된 것처럼 표시)
      if (previousApplications) {
        queryClient.setQueryData<Application[]>(
          queryKeys.applications.mine(),
          previousApplications.map(app =>
            app.id === applicationId
              ? { ...app, status: 'cancelled' as const }
              : app
          )
        );
      }

      // 컨텍스트 반환 (롤백에 사용)
      return { previousApplications };
    },
    onSuccess: (_, applicationId) => {
      logger.info('지원 취소', { applicationId });
      addToast({ type: 'success', message: '지원이 취소되었습니다.' });
    },
    onError: (error, _, context) => {
      logger.error('지원 취소 실패', toError(error));
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '취소에 실패했습니다.',
      });

      // 롤백: 이전 데이터로 복원
      if (context?.previousApplications) {
        queryClient.setQueryData(
          queryKeys.applications.mine(),
          context.previousApplications
        );
      }
    },
    // 성공/실패 관계없이 최종적으로 서버 데이터와 동기화
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.mine(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
  });

  // 취소 요청 (확정된 지원에 대해 취소 요청, Optimistic Update 적용)
  const requestCancellationMutation = useMutation({
    mutationFn: (params: RequestCancellationParams) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return requestCancellationService(
        { applicationId: params.applicationId, reason: params.reason },
        user.uid
      );
    },
    // Optimistic Update: 서버 응답 전에 UI 즉시 업데이트
    onMutate: async ({ applicationId }) => {
      // 진행 중인 refetch 취소 (낙관적 업데이트와 충돌 방지)
      await queryClient.cancelQueries({
        queryKey: queryKeys.applications.mine(),
      });

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousApplications = queryClient.getQueryData<Application[]>(
        queryKeys.applications.mine()
      );

      // 낙관적으로 UI 업데이트 (취소 요청 중으로 표시)
      if (previousApplications) {
        queryClient.setQueryData<Application[]>(
          queryKeys.applications.mine(),
          previousApplications.map(app =>
            app.id === applicationId
              ? { ...app, status: 'cancellation_pending' as const }
              : app
          )
        );
      }

      // 컨텍스트 반환 (롤백에 사용)
      return { previousApplications };
    },
    onSuccess: (_, { applicationId }) => {
      logger.info('취소 요청 완료', { applicationId });
      addToast({ type: 'success', message: '취소 요청이 제출되었습니다.' });
    },
    onError: (error, _, context) => {
      logger.error('취소 요청 실패', toError(error));
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '취소 요청에 실패했습니다.',
      });

      // 롤백: 이전 데이터로 복원
      if (context?.previousApplications) {
        queryClient.setQueryData(
          queryKeys.applications.mine(),
          context.previousApplications
        );
      }
    },
    // 성공/실패 관계없이 최종적으로 서버 데이터와 동기화
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.mine(),
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

    // 지원 제출 (v2.0: Assignment + PreQuestion)
    submitApplication: submitV2Mutation.mutate,
    isSubmitting: submitV2Mutation.isPending,

    // 지원 취소
    cancelApplication: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,

    // 취소 요청 (확정된 지원)
    requestCancellation: requestCancellationMutation.mutate,
    isRequestingCancellation: requestCancellationMutation.isPending,

    // 유틸리티
    hasApplied,
    getApplicationStatus,

    // 리프레시
    refresh: () => myApplicationsQuery.refetch(),
  };
}

export default useApplications;
