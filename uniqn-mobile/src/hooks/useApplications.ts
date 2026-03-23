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
} from '@/services';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { requireAuth } from '@/errors';
import { logger } from '@/utils/logger';
import { createMutationErrorHandler } from '@/shared/errors';
import { STATUS } from '@/constants';
import type { Application, ApplicationStatus, Assignment, PreQuestionAnswer } from '@/types';

interface SubmitApplicationV2Params {
  jobPostingId: string;
  assignments: Assignment[];
  preQuestionAnswers?: PreQuestionAnswer[];
  message?: string;
}

interface RequestCancellationParams {
  applicationId: string;
  reason: string;
}

const APPLICATIONS_CACHE_SCHEMA_VERSION = 2;
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
      : []) ?? [];

  const shouldUseCachedApplications =
    !!user?.uid && !isOnline && myApplicationsQuery.data === undefined;
  const effectiveApplications =
    myApplicationsQuery.data ?? (shouldUseCachedApplications ? cachedApplications : []);

  const submitV2Mutation = useMutation({
    mutationFn: (params: SubmitApplicationV2Params) => {
      requireAuth(user?.uid, 'useApplications');
      requireOnlineForMutation('useApplications.submitApplication');

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
        undefined,
        applicantNickname,
        applicantPhotoURL
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
        { applicationId: params.applicationId, reason: params.reason },
        user.uid
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

export default useApplications;
