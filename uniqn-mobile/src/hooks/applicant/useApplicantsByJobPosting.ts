import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getApplicantsByJobPosting,
  getApplicantStatsByRole,
  subscribeToApplicantsAsync,
  type ApplicantWithDetails,
  type ApplicantListResult,
} from '@/services';
import { isNetworkError, toError } from '@/errors';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queryKeys, cachingPolicies } from '@/lib';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import type { ApplicationStatus } from '@/types';

export interface UseApplicantsByJobPostingOptions {
  realtime?: boolean;
}

function normalizeApplicantStatusFilter(
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): ApplicationStatus | ApplicationStatus[] | undefined {
  if (!statusFilter) {
    return undefined;
  }

  if (!Array.isArray(statusFilter)) {
    return statusFilter;
  }

  return [...new Set(statusFilter)].sort();
}

function getApplicantStatusFilterKey(
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): string {
  if (!statusFilter) {
    return 'all';
  }

  return Array.isArray(statusFilter) ? [...new Set(statusFilter)].sort().join(',') : statusFilter;
}

export function useApplicantsByJobPosting(
  jobPostingId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[],
  options: UseApplicantsByJobPostingOptions = {}
) {
  const { realtime = false } = options;
  const { user } = useAuthStore();
  const normalizedStatusFilter = useMemo(
    () => normalizeApplicantStatusFilter(statusFilter),
    [statusFilter]
  );

  const [realtimeData, setRealtimeData] = useState<ApplicantListResult | null>(null);
  const [realtimeError, setRealtimeError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  const statusFilterKey = useMemo(
    () => getApplicantStatusFilterKey(normalizedStatusFilter),
    [normalizedStatusFilter]
  );
  const statusFilterRef = useRef<ApplicationStatus | ApplicationStatus[] | undefined>(
    normalizedStatusFilter
  );
  statusFilterRef.current = normalizedStatusFilter;

  const startSubscription = useCallback(async () => {
    if (!realtime || !user || !jobPostingId) {
      return;
    }

    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    logger.info('Starting applicant realtime subscription', { jobPostingId });

    try {
      const unsubscribe = await subscribeToApplicantsAsync(jobPostingId, user.uid, {
        onUpdate: (result: ApplicantListResult) => {
          if (!mountedRef.current) {
            return;
          }

          const currentFilter = statusFilterRef.current;
          if (currentFilter) {
            const statuses = Array.isArray(currentFilter) ? currentFilter : [currentFilter];
            const filteredApplicants = result.applicants.filter((applicant: ApplicantWithDetails) =>
              statuses.includes(applicant.status)
            );

            setRealtimeData({
              ...result,
              applicants: filteredApplicants,
            });
          } else {
            setRealtimeData(result);
          }

          setRealtimeError(null);
        },
        onError: (error: Error) => {
          if (!mountedRef.current) {
            return;
          }

          logger.error('Applicant realtime subscription failed', error, { jobPostingId });
          setRealtimeError(error);

          if (isNetworkError(error)) {
            logger.warn('Applicant realtime subscription is waiting for reconnect', {
              jobPostingId,
            });
          }
        },
      });

      if (mountedRef.current) {
        unsubscribeRef.current = unsubscribe;
      } else {
        unsubscribe();
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      const normalizedError = toError(error);
      logger.error('Failed to start applicant subscription', normalizedError, { jobPostingId });
      setRealtimeError(normalizedError);
    }
  }, [jobPostingId, realtime, user]);

  useNetworkStatus({
    onOnline: useCallback(() => {
      if (realtime && realtimeError && isNetworkError(realtimeError)) {
        logger.info('Restarting applicant subscription after reconnect', { jobPostingId });
        void startSubscription();
      }
    }, [jobPostingId, realtime, realtimeError, startSubscription]),
  });

  useEffect(() => {
    mountedRef.current = true;
    void startSubscription();

    return () => {
      mountedRef.current = false;

      if (unsubscribeRef.current) {
        logger.info('Cleaning up applicant realtime subscription', { jobPostingId });
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [jobPostingId, startSubscription, statusFilterKey]);

  const query = useQuery({
    queryKey: queryKeys.applicantManagement.byJobPosting(jobPostingId, user?.uid, statusFilterKey),
    queryFn: () => getApplicantsByJobPosting(jobPostingId, user!.uid, normalizedStatusFilter),
    enabled: !!user && !!jobPostingId && !realtime,
    staleTime: cachingPolicies.frequent,
  });

  if (realtime) {
    return {
      data: realtimeData,
      isLoading: !realtimeData && !realtimeError,
      error: realtimeError,
      refetch: async () => ({ data: realtimeData }),
      isRefetching: false,
    };
  }

  return query;
}

export function useApplicantStats(jobPostingId: string) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.applicantManagement.stats(jobPostingId, user?.uid),
    queryFn: () => getApplicantStatsByRole(jobPostingId, user!.uid),
    enabled: !!user && !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });
}
