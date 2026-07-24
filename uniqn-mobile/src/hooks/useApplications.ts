import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getJobDetailQueryKey } from '@/hooks/useJobDetail';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import {
  getCriticalOfflineCache,
  setCriticalOfflineCache,
} from '@/services/offline/criticalOfflineCache';
import {
  requireOnlineForMutation,
  shouldApplyOptimisticUpdate,
} from '@/services/offline/remoteMutationGuard';
import {
  getMyApplications,
  applyToJobV2,
  cancelApplication as cancelApplicationService,
  requestCancellation as requestCancellationService,
  hasAppliedToJob,
} from '@/services';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { requireAuth } from '@/errors';
import { logger } from '@/utils/logger';
import { createMutationErrorHandler } from '@/shared/errors';
import { buildCurrentUserIdentitySnapshot } from '@/shared/profile/identity';
import { resolveSessionUserId } from '@/hooks/internal/sessionUserId';
import { STATUS } from '@/constants';
import type { Application, ApplicationStatus, Assignment, PreQuestionAnswer } from '@/types';
import type { BoardAuthorRole, BoardJobSummary } from '@/types/board';

interface SubmitApplicationV2Params {
  jobPostingId: string;
  assignments: Assignment[];
  preQuestionAnswers?: PreQuestionAnswer[];
  message?: string;
  /** 개보법 §17 — 지원 시점 제3자 제공 동의 timestamp (ISO 8601) */
  provisionConsentAt: string;
  /** THIRD_PARTY_CONSENT_VERSION_TAG */
  provisionConsentVersion: string;
}

interface RequestCancellationParams {
  applicationId: string;
  reason: string;
  wantsSubstitutePost?: boolean;
  applicantContext?: { name: string; role: BoardAuthorRole; jobSummary: BoardJobSummary };
}

const APPLICATIONS_CACHE_SCHEMA_VERSION = 2;
// 데이터 부재 시 매 렌더 새 배열 생성 방지 — 파생 useMemo/renderItem 안정성 (QW1 리뷰 반영)
const EMPTY_APPLICATIONS: Application[] = [];
const ACTIVE_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  STATUS.APPLICATION.APPLIED,
  STATUS.APPLICATION.CONFIRMED,
  STATUS.APPLICATION.CANCELLATION_PENDING,
]);

export function useApplications() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user, profile } = useAuthStore();
  const { isOnline } = useNetworkStatus();
  const applicationsCacheKey = user?.uid
    ? `applications:${user.uid}:mine`
    : 'applications:anonymous:mine';
  const myApplicationsQueryKey = [
    ...queryKeys.applications.mine(),
    user?.uid ?? 'anonymous',
  ] as const;

  const myApplicationsQuery = useQuery({
    queryKey: myApplicationsQueryKey,
    queryFn: () => getMyApplications(user!.uid),
    enabled: !!user && isOnline,
    staleTime: cachingPolicies.frequent,
  });

  useEffect(() => {
    if (!user?.uid || !myApplicationsQuery.data) {
      return;
    }

    setCriticalOfflineCache(applicationsCacheKey, myApplicationsQuery.data, {
      userId: user.uid,
      schemaVersion: APPLICATIONS_CACHE_SCHEMA_VERSION,
    });
  }, [applicationsCacheKey, myApplicationsQuery.data, user?.uid]);

  const cachedApplications =
    (user?.uid
      ? getCriticalOfflineCache<Application[]>(applicationsCacheKey, {
          ttlMs: cachingPolicies.standard,
          userId: user.uid,
          schemaVersion: APPLICATIONS_CACHE_SCHEMA_VERSION,
        })?.data
      : EMPTY_APPLICATIONS) ?? EMPTY_APPLICATIONS;

  const shouldUseCachedApplications =
    !!user?.uid && !isOnline && myApplicationsQuery.data === undefined;
  const effectiveApplications =
    myApplicationsQuery.data ??
    (shouldUseCachedApplications ? cachedApplications : EMPTY_APPLICATIONS);

  const submitV2Mutation = useMutation({
    mutationFn: (params: SubmitApplicationV2Params) => {
      requireAuth(user?.uid, 'useApplications');
      requireOnlineForMutation('useApplications.submitApplication');
      const identity = buildCurrentUserIdentitySnapshot({
        profile,
        authUser: user,
        fallbackName: '익명',
      });

      const applicantName = profile?.name || profile?.nickname || user.displayName || '익명';
      const applicantPhone = profile?.phone || user.phoneNumber || undefined;
      const applicantNickname = identity.nickname;
      const applicantPhotoURL = identity.photoURL;
      const applicantPhotoURLBlurhash = identity.photoURLBlurhash ?? undefined;

      return applyToJobV2(
        {
          jobPostingId: params.jobPostingId,
          assignments: params.assignments,
          preQuestionAnswers: params.preQuestionAnswers,
          message: params.message,
          provisionConsentAt: params.provisionConsentAt,
          provisionConsentVersion: params.provisionConsentVersion,
        },
        user.uid,
        identity.preferredName || applicantName,
        applicantPhone,
        undefined,
        applicantNickname,
        applicantPhotoURL,
        applicantPhotoURLBlurhash
      );
    },
    onSuccess: (data) => {
      logger.info('Application submission completed', {
        applicationId: data.id,
        assignmentCount: data.assignments?.length ?? 0,
      });
      addToast({ type: 'success', message: '지원이 완료되었습니다.' });

      void queryClient.invalidateQueries({
        queryKey: myApplicationsQueryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: getJobDetailQueryKey(data.jobPostingId, user?.uid),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.schedules.all,
      });
    },
    onError: createMutationErrorHandler('지원', addToast),
  });

  const cancelMutation = useMutation({
    mutationFn: (applicationId: string) => {
      requireAuth(user?.uid, 'useApplications');
      requireOnlineForMutation('useApplications.cancelApplication');
      return cancelApplicationService(applicationId, user.uid);
    },
    onMutate: async (applicationId: string) => {
      if (!shouldApplyOptimisticUpdate()) {
        return { previousApplications: undefined };
      }

      await queryClient.cancelQueries({
        queryKey: myApplicationsQueryKey,
      });

      const previousApplications = queryClient.getQueryData<Application[]>(myApplicationsQueryKey);

      if (previousApplications) {
        queryClient.setQueryData<Application[]>(
          myApplicationsQueryKey,
          previousApplications.map((application) =>
            application.id === applicationId
              ? { ...application, status: STATUS.APPLICATION.CANCELLED }
              : application
          )
        );
      }

      return { previousApplications };
    },
    onSuccess: (_, applicationId) => {
      logger.info('Application cancelled', { applicationId });
      const targetApplication = effectiveApplications.find(
        (application) => application.id === applicationId
      );
      if (targetApplication) {
        void queryClient.invalidateQueries({
          queryKey: getJobDetailQueryKey(targetApplication.jobPostingId, user?.uid),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.schedules.all,
      });
      addToast({ type: 'success', message: '지원이 취소되었습니다.' });
    },
    onError: createMutationErrorHandler('지원 취소', addToast, {
      onRollback: (ctx) => {
        const rollbackCtx = ctx as { previousApplications?: Application[] };
        if (rollbackCtx?.previousApplications) {
          queryClient.setQueryData(myApplicationsQueryKey, rollbackCtx.previousApplications);
        }
      },
    }),
    onSettled: () => {
      if (!isOnline) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: myApplicationsQueryKey,
      });
    },
  });

  const requestCancellationMutation = useMutation({
    mutationFn: (params: RequestCancellationParams) => {
      requireAuth(user?.uid, 'useApplications');
      requireOnlineForMutation('useApplications.requestCancellation');
      return requestCancellationService(
        {
          applicationId: params.applicationId,
          reason: params.reason,
          wantsSubstitutePost: params.wantsSubstitutePost,
        },
        user.uid,
        params.applicantContext
      );
    },
    onMutate: async ({ applicationId }) => {
      if (!shouldApplyOptimisticUpdate()) {
        return { previousApplications: undefined };
      }

      await queryClient.cancelQueries({
        queryKey: myApplicationsQueryKey,
      });

      const previousApplications = queryClient.getQueryData<Application[]>(myApplicationsQueryKey);

      if (previousApplications) {
        queryClient.setQueryData<Application[]>(
          myApplicationsQueryKey,
          previousApplications.map((application) =>
            application.id === applicationId
              ? { ...application, status: STATUS.APPLICATION.CANCELLATION_PENDING }
              : application
          )
        );
      }

      return { previousApplications };
    },
    onSuccess: (_, { applicationId }) => {
      logger.info('Cancellation request submitted', { applicationId });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.schedules.all,
      });
      const targetApplication = effectiveApplications.find(
        (application) => application.id === applicationId
      );
      if (targetApplication) {
        void queryClient.invalidateQueries({
          queryKey: getJobDetailQueryKey(targetApplication.jobPostingId, user?.uid),
        });
      }
      addToast({ type: 'success', message: '취소 요청이 제출되었습니다.' });
    },
    onError: createMutationErrorHandler('취소 요청', addToast, {
      onRollback: (ctx) => {
        const rollbackCtx = ctx as { previousApplications?: Application[] };
        if (rollbackCtx?.previousApplications) {
          queryClient.setQueryData(myApplicationsQueryKey, rollbackCtx.previousApplications);
        }
      },
    }),
    onSettled: () => {
      if (!isOnline) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: myApplicationsQueryKey,
      });
    },
  });

  const hasApplied = (jobPostingId: string): boolean => {
    return effectiveApplications.some(
      (application) =>
        application.jobPostingId === jobPostingId &&
        ACTIVE_APPLICATION_STATUSES.has(application.status)
    );
  };

  const getApplicationStatus = (jobPostingId: string): Application | null => {
    return (
      effectiveApplications.find(
        (application) =>
          application.jobPostingId === jobPostingId &&
          ACTIVE_APPLICATION_STATUSES.has(application.status)
      ) ?? null
    );
  };

  return {
    myApplications: effectiveApplications,
    isLoading: effectiveApplications.length === 0 ? myApplicationsQuery.isLoading : false,
    isRefreshing: isOnline ? myApplicationsQuery.isRefetching : false,
    error: isOnline ? myApplicationsQuery.error : null,
    submitApplication: useThrottledCallback(submitV2Mutation.mutate, 1000),
    // mutateAsync — 호출부에서 await + try/catch 로 에러를 직접 표면화할 때 사용.
    // (네이티브 모달 위 토스트가 가려지는 문제 회피: 호출부에서 Alert.alert 로 노출)
    submitApplicationAsync: submitV2Mutation.mutateAsync,
    isSubmitting: submitV2Mutation.isPending,
    cancelApplication: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
    requestCancellation: requestCancellationMutation.mutate,
    isRequestingCancellation: requestCancellationMutation.isPending,
    hasApplied,
    getApplicationStatus,
    refresh: () => (isOnline ? myApplicationsQuery.refetch() : Promise.resolve()),
  };
}

export function useHasAppliedToJob(jobPostingId?: string) {
  const { user, isInitialized } = useAuthStore();
  const { isOnline } = useNetworkStatus();
  const applicantId = resolveSessionUserId(user?.uid, isInitialized);

  return useQuery({
    queryKey: [
      ...queryKeys.applications.detail(`exists:${jobPostingId ?? 'unknown'}`),
      applicantId ?? 'anonymous',
    ],
    queryFn: () => hasAppliedToJob(jobPostingId!, applicantId!),
    enabled: !!jobPostingId && !!applicantId && (isOnline || typeof window !== 'undefined'),
    staleTime: cachingPolicies.frequent,
    refetchOnMount: 'always',
    networkMode: 'always',
  });
}
