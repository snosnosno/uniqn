/**
 * UNIQN Mobile - 지원자 조회 훅
 *
 * @description 공고별 지원자 목록 및 통계 조회
 * @version 1.1.0 - 실시간 구독 옵션 추가
 */

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

// ============================================================================
// Types
// ============================================================================

export interface UseApplicantsByJobPostingOptions {
  /** 실시간 구독 활성화 (기본값: false) */
  realtime?: boolean;
}

// ============================================================================
// 지원자 조회 훅
// ============================================================================

/**
 * 공고별 지원자 목록 조회 훅
 *
 * @description realtime 옵션을 활성화하면 onSnapshot으로 실시간 동기화됩니다.
 *              기본값은 false로 2분 폴링 방식입니다.
 */
export function useApplicantsByJobPosting(
  jobPostingId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[],
  options: UseApplicantsByJobPostingOptions = {}
) {
  const { realtime = false } = options;
  const { user } = useAuthStore();

  // 실시간 모드용 상태
  const [realtimeData, setRealtimeData] = useState<ApplicantListResult | null>(null);
  const [realtimeError, setRealtimeError] = useState<Error | null>(null);

  // 구독 해제 함수 저장 (W4: 재연결 시 사용)
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // 마운트 상태 추적
  const mountedRef = useRef(true);

  // statusFilter를 안정적인 키로 변환 (배열 참조 변경으로 인한 재구독 방지)
  const statusFilterKey = useMemo(
    () => (statusFilter ? JSON.stringify(statusFilter) : ''),
    [statusFilter]
  );
  // 콜백에서 최신 statusFilter 참조
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;

  /**
   * 구독 시작 함수 (S1: 비동기 권한 검증 포함)
   * W4: 네트워크 복구 시 재연결에도 사용
   */
  const startSubscription = useCallback(async () => {
    if (!realtime || !user || !jobPostingId) return;

    // 기존 구독 해제
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    logger.info('지원자 실시간 구독 시작', { jobPostingId });

    try {
      // S1: 비동기 권한 검증 후 구독 (subscribeToApplicantsAsync)
      const unsubscribe = await subscribeToApplicantsAsync(jobPostingId, user.uid, {
        onUpdate: (result: ApplicantListResult) => {
          if (!mountedRef.current) return;

          // statusFilter 적용 (ref로 최신값 참조)
          const currentFilter = statusFilterRef.current;
          if (currentFilter) {
            const statuses = Array.isArray(currentFilter) ? currentFilter : [currentFilter];
            const filteredApplicants = result.applicants.filter((a: ApplicantWithDetails) =>
              statuses.includes(a.status)
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
          if (!mountedRef.current) return;

          logger.error('지원자 실시간 구독 에러', error);
          setRealtimeError(error);

          // W4: NetworkError인 경우 재연결 대기 (onOnline 콜백이 처리)
          if (isNetworkError(error)) {
            logger.warn('네트워크 에러, 재연결 대기 중', { jobPostingId });
          }
        },
      });

      if (mountedRef.current) {
        unsubscribeRef.current = unsubscribe;
      } else {
        // 언마운트된 경우 즉시 해제
        unsubscribe();
      }
    } catch (error) {
      if (mountedRef.current) {
        logger.error('지원자 구독 시작 실패', toError(error), { jobPostingId });
        setRealtimeError(toError(error));
      }
    }
  }, [realtime, jobPostingId, user]);

  /**
   * W4: 네트워크 복구 시 자동 재연결
   */
  useNetworkStatus({
    onOnline: useCallback(() => {
      // 실시간 모드이고, 네트워크 에러로 인한 구독 실패 상태일 때만 재연결
      if (realtime && realtimeError && isNetworkError(realtimeError)) {
        logger.info('네트워크 복구, 구독 재시작', { jobPostingId });
        startSubscription();
      }
    }, [realtime, realtimeError, jobPostingId, startSubscription]),
  });

  // 실시간 구독 (realtime 모드) - 비동기 패턴
  useEffect(() => {
    mountedRef.current = true;

    startSubscription();

    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        logger.info('지원자 실시간 구독 해제', { jobPostingId });
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    // statusFilterKey로 안정적인 의존성 사용 (배열 참조 변경 무시)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSubscription, statusFilterKey]);

  // 폴링 모드 (기존)
  const query = useQuery({
    queryKey: queryKeys.applicantManagement.byJobPosting(jobPostingId),
    queryFn: () => getApplicantsByJobPosting(jobPostingId, user!.uid, statusFilter),
    enabled: !!user && !!jobPostingId && !realtime,
    staleTime: cachingPolicies.frequent,
  });

  // 실시간 모드일 때 반환값 구성
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

/**
 * 역할별 지원자 통계 조회 훅
 */
export function useApplicantStats(jobPostingId: string) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.applicantManagement.stats(jobPostingId),
    queryFn: () => getApplicantStatsByRole(jobPostingId, user!.uid),
    enabled: !!user && !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });
}
