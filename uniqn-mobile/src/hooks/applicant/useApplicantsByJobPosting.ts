import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getApplicantsByJobPosting,
  getApplicantStatsByRole,
  subscribeToApplicantsAsync,
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

function filterApplicantsByStatus(
  result: ApplicantListResult | undefined,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): ApplicantListResult | undefined {
  if (!result || !statusFilter) {
    return result;
  }

  const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];

  return {
    ...result,
    applicants: result.applicants.filter((applicant) => statuses.includes(applicant.status)),
  };
}

export function useApplicantsByJobPosting(
  jobPostingId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[],
  options: UseApplicantsByJobPostingOptions = {}
) {
  const { realtime = false } = options;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
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
  const queryKey = useMemo(
    () => queryKeys.applicantManagement.byJobPosting(jobPostingId, user?.uid, statusFilterKey),
    [jobPostingId, statusFilterKey, user?.uid]
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

          const filteredResult = filterApplicantsByStatus(result, statusFilterRef.current) ?? null;

          setRealtimeData(filteredResult);
          if (filteredResult) {
            queryClient.setQueryData(queryKey, filteredResult);
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
  }, [jobPostingId, queryClient, queryKey, realtime, user]);

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
    setRealtimeData(null);
    setRealtimeError(null);
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
    queryKey,
    queryFn: () => getApplicantsByJobPosting(jobPostingId, user!.uid, normalizedStatusFilter),
    enabled: !!user && !!jobPostingId && !realtime,
    staleTime: cachingPolicies.frequent,
  });

  const refreshRealtimeData = useCallback(async () => {
    if (!user || !jobPostingId) {
      return { data: realtimeData ?? undefined };
    }

    try {
      const result = await query.refetch();
      if (result.error) {
        const normalizedError = toError(result.error);
        setRealtimeError(normalizedError);
        throw normalizedError;
      }

      const fetchedData = filterApplicantsByStatus(
        (result.data as ApplicantListResult | undefined) ?? undefined,
        statusFilterRef.current
      );

      if (fetchedData) {
        setRealtimeData(fetchedData);
        queryClient.setQueryData(queryKey, fetchedData);
      }

      setRealtimeError(null);

      return { data: fetchedData ?? undefined };
    } catch (error) {
      const normalizedError = toError(error);
      setRealtimeError(normalizedError);
      throw normalizedError;
    }
  }, [jobPostingId, query, queryClient, queryKey, realtimeData, user]);

  if (realtime) {
    return {
      // query.data 를 먼저 본다 — 구독 onUpdate 가 realtimeData 와 쿼리 캐시를 **함께** 쓰므로
      // (:111-114) 두 값은 정상 경로에서 같다. 반대로 낙관 갱신(useApplicantMutations 의
      // onMutate → setQueriesData)은 캐시에만 반영되는데, realtimeData 를 먼저 읽으면 그
      // 그림자에 가려 낙관 갱신 3곳과 롤백이 통째로 죽은 코드가 된다(APPL-5).
      // `?? undefined` 는 빈 값 표현을 undefined 로 유지하기 위한 것 — realtimeData 는
      // 초기화 시 null 이라 그대로 흘리면 '데이터 없음' 이 null 로 바뀌어 계약이 달라진다.
      data: query.data ?? realtimeData ?? undefined,
      isLoading: !realtimeData && !query.data && !realtimeError,
      error: realtimeError ?? query.error,
      refetch: refreshRealtimeData,
      isRefetching: query.isFetching || query.isRefetching,
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
