/**
 * UNIQN Mobile - 정산 관리 훅 (구인자용)
 *
 * @description 근무 기록 조회, 시간 수정, 정산 처리
 * @version 1.0.0
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import {
  getWorkLogsByJobPosting,
  calculateSettlement,
  updateWorkTimeForSettlement,
  settleWorkLog,
  bulkSettlement,
  updateSettlementStatus,
  getJobPostingSettlementSummary,
  type SettlementWorkLog,
  type SettlementFilters,
  type CalculateSettlementInput,
  type SettleWorkLogInput,
  type BulkSettlementInput,
  type UpdateWorkTimeInput,
} from '@/services';
import { queryKeys, queryCachingOptions, invalidateRelated } from '@/lib';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { triggerBatchStart, triggerBatchEnd } from '@/utils/haptics';
import { stableFilters } from '@/utils/queryUtils';
import {
  buildWorkLogNameMap,
  formatBulkSettlementFailures,
} from '@/utils/settlementFailureMessage';
import { errorHandlerPresets, createMutationErrorHandler } from '@/shared/errors';
import { requireAuth } from '@/errors/guardErrors';
import { STATUS } from '@/constants';
import type { PayrollStatus } from '@/types';

// ============================================================================
// 근무 기록 조회 훅
// ============================================================================

/**
 * 공고별 근무 기록 조회 훅
 */
export function useWorkLogsByJobPosting(
  jobPostingId: string,
  filters?: Omit<SettlementFilters, 'jobPostingId'>
) {
  const { user } = useAuthStore();
  const normalizedFilters = stableFilters(filters);
  const workLogsQueryKey = [
    ...queryKeys.settlement.byJobPosting(jobPostingId),
    user?.uid ?? 'anonymous',
    normalizedFilters,
  ] as const;

  return useQuery({
    queryKey: workLogsQueryKey,
    queryFn: () => getWorkLogsByJobPosting(jobPostingId, user!.uid, filters),
    enabled: !!user && !!jobPostingId,
    staleTime: queryCachingOptions.settlement.staleTime,
    gcTime: queryCachingOptions.settlement.gcTime,
  });
}

/**
 * 공고별 정산 요약 조회 훅
 */
export function useSettlementSummary(jobPostingId: string) {
  const { user } = useAuthStore();
  const summaryQueryKey = [
    ...queryKeys.settlement.summary(jobPostingId),
    user?.uid ?? 'anonymous',
  ] as const;

  return useQuery({
    queryKey: summaryQueryKey,
    queryFn: () => getJobPostingSettlementSummary(jobPostingId, user!.uid),
    enabled: !!user && !!jobPostingId,
    staleTime: queryCachingOptions.settlement.staleTime,
    gcTime: queryCachingOptions.settlement.gcTime,
  });
}

// ============================================================================
// 정산 계산 훅
// ============================================================================

/**
 * 정산 금액 계산 훅
 */
export function useCalculateSettlement() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: (input: CalculateSettlementInput) => {
      requireAuth(user?.uid, 'useSettlement');
      return calculateSettlement(input, user.uid);
    },
    onSuccess: (result) => {
      logger.info('정산 금액 계산 완료', {
        workLogId: result.workLogId,
        netPay: result.netPay,
      });
      // 이벤트 기반 캐시 무효화
      invalidateRelated('settlement.process');
    },
    onError: errorHandlerPresets.settlement(addToast),
  });
}

// ============================================================================
// 시간 수정 훅
// ============================================================================

/**
 * 근무 시간 수정 뮤테이션 훅
 */
export function useUpdateWorkTime() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: UpdateWorkTimeInput) => {
      requireAuth(user?.uid, 'useSettlement');
      return updateWorkTimeForSettlement(input, user.uid);
    },
    onSuccess: (_, input) => {
      logger.info('근무 시간 수정 완료', { workLogId: input.workLogId });
      addToast({
        type: 'success',
        message: '근무 시간이 수정되었습니다.',
      });

      // 이벤트 기반 캐시 무효화
      invalidateRelated('workLog.update');
    },
    onError: createMutationErrorHandler('근무 시간 수정', addToast),
  });
}

// ============================================================================
// 정산 처리 훅
// ============================================================================

/**
 * 개별 정산 뮤테이션 훅
 */
export function useSettleWorkLog() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: SettleWorkLogInput) => {
      requireAuth(user?.uid, 'useSettlement');
      const result = await settleWorkLog(input, user.uid);
      // soft failure를 reject로 전환하여 onError 롤백 보장
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settlement.all });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.settlement.all });

      queryClient.setQueriesData({ queryKey: queryKeys.settlement.all }, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((wl: Record<string, unknown>) =>
          wl.workLogId === input.workLogId || wl.id === input.workLogId
            ? { ...wl, payrollStatus: STATUS.PAYROLL.COMPLETED }
            : wl
        );
      });

      return { previousData };
    },
    onSuccess: (result) => {
      logger.info('개별 정산 완료', {
        workLogId: result.workLogId,
        amount: result.amount,
      });
      addToast({
        type: 'success',
        message: `${result.amount.toLocaleString()}원 정산 완료`,
      });

      // 이벤트 기반 캐시 무효화
      invalidateRelated('settlement.process');
    },
    onError: createMutationErrorHandler('정산 처리', addToast, {
      onRollback: (ctx) => {
        const { previousData } = ctx as { previousData: [readonly unknown[], unknown][] };
        previousData?.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    }),
  });
}

/**
 * 일괄 정산 뮤테이션 훅
 */
export function useBulkSettlement() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  // 핸들러를 훅 인스턴스당 한 번만 생성 (에러마다 factory 호출 방지).
  // onRollback closure는 queryClient 참조 → deps에 포함 필수.
  const handleBulkSettleError = useMemo(
    () =>
      createMutationErrorHandler('정산 처리', addToast, {
        onRollback: (rollbackCtx) => {
          const { previousData } = rollbackCtx as {
            previousData: [readonly unknown[], unknown][];
          };
          previousData?.forEach(([key, data]) => {
            queryClient.setQueryData(key, data);
          });
        },
      }),
    [addToast, queryClient]
  );

  return useMutation({
    mutationFn: (input: BulkSettlementInput) => {
      requireAuth(user?.uid, 'useSettlement');
      return bulkSettlement(input, user.uid);
    },
    onMutate: async (input) => {
      // impeccable v2 §17 — 일괄 액션 시작 Light 햅틱 1회(개별 햅틱 대체)
      void triggerBatchStart();

      await queryClient.cancelQueries({ queryKey: queryKeys.settlement.all });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.settlement.all });

      queryClient.setQueriesData({ queryKey: queryKeys.settlement.all }, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((wl: Record<string, unknown>) =>
          input.workLogIds.includes(wl.workLogId as string) ||
          input.workLogIds.includes(wl.id as string)
            ? { ...wl, payrollStatus: STATUS.PAYROLL.COMPLETED }
            : wl
        );
      });

      return { previousData };
    },
    onSuccess: (result, _variables, context) => {
      logger.info('일괄 정산 완료', {
        success: result.successCount,
        failed: result.failedCount,
        totalAmount: result.totalAmount,
      });

      // 부분 실패는 reject 가 아니라 resolve 로 돌아온다 → onError 롤백이 안 걸린다.
      // onMutate 가 요청한 **전 행**을 이미 '정산 완료' 로 칠해 둔 상태라, 실패분까지
      // 초록으로 보인다. 아래 invalidate 가 결국 진실로 덮지만 오프라인·refetch 실패 시
      // 잘못된 완료 표시가 그대로 남는다 — 금전 화면에서 이건 조용한 오답이다.
      // 실패가 하나라도 있으면 낙관 갱신을 통째로 되돌리고 서버 값으로 다시 채운다.
      if (result.failedCount > 0) {
        const { previousData } = (context ?? {}) as {
          previousData?: [readonly unknown[], unknown][];
        };
        previousData?.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }

      if (result.successCount > 0) {
        addToast({
          type: 'success',
          message: `${result.successCount}건 / ${result.totalAmount.toLocaleString()}원 정산 완료`,
        });
      }

      if (result.failedCount > 0) {
        // 서버 results[]로 실패자 이름 나열 (QW3). 이름은 settlement 캐시에서 해소.
        const nameByWorkLogId = buildWorkLogNameMap(
          queryClient.getQueriesData({ queryKey: queryKeys.settlement.all })
        );
        const failureMessage = formatBulkSettlementFailures(result, nameByWorkLogId);
        if (failureMessage) {
          addToast({ type: 'warning', message: failureMessage });
        }
      }

      // impeccable v2 §17 — 일괄 정산 "종료" 햅틱. 여기 **한 번만** 울린다.
      // 예전엔 이 함수 앞부분에서 `triggerBatchEnd(result.failedCount === 0)` 을 한 번 더
      // 호출해, 일괄 정산 한 번에 햅틱이 두 번 울리고 두 호출의 성공 판정마저 서로 달랐다
      // (실패 1건이면 앞은 warning, 뒤는 success). 부분 성공은 성공 톤 유지가 맞다 —
      // 실패분은 아래 warning 토스트가 이미 이름까지 나열해 알린다.
      void triggerBatchEnd(result.successCount > 0);

      // 이벤트 기반 캐시 무효화
      invalidateRelated('settlement.bulkProcess');
    },
    onError: (error, variables, ctx) => {
      // impeccable v2 §17 — 일괄 정산 실패 종료 햅틱. 에러 토스트보다 먼저.
      void triggerBatchEnd(false);
      return handleBulkSettleError(error, variables, ctx);
    },
  });
}

/**
 * 정산 상태 변경 뮤테이션 훅
 */
export function useUpdateSettlementStatus() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({
      workLogId,
      status,
      reason,
    }: {
      workLogId: string;
      status: PayrollStatus;
      /** 지급 완료 되돌리기 사유 — completed→그 외 전환에서는 필수(서버 강제). */
      reason?: string;
    }) => {
      requireAuth(user?.uid, 'useSettlement');
      return updateSettlementStatus(workLogId, status, user.uid, { reason });
    },
    onMutate: async ({ workLogId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settlement.all });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.settlement.all });

      queryClient.setQueriesData({ queryKey: queryKeys.settlement.all }, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((wl: Record<string, unknown>) =>
          wl.workLogId === workLogId || wl.id === workLogId ? { ...wl, payrollStatus: status } : wl
        );
      });

      return { previousData };
    },
    onSuccess: (_, { status }) => {
      logger.info('정산 상태 변경 완료', { status });

      // 실제 호출부는 PENDING(되돌리기)과 COMPLETED 둘뿐이다. 'failed' 로 전이시키는
      // 경로는 UI 에 존재하지 않지만 타입상 가능하므로 문구는 남겨 둔다.
      const statusMessages: Record<PayrollStatus, string> = {
        pending: '정산 대기로 변경되었습니다.',
        completed: '정산이 완료되었습니다.',
        failed: '정산이 실패 처리되었습니다.',
      };

      addToast({
        type: 'success',
        message: statusMessages[status],
      });

      // 이벤트 기반 캐시 무효화
      invalidateRelated('settlement.process');
    },
    onError: createMutationErrorHandler('정산 상태 변경', addToast, {
      onRollback: (ctx) => {
        const { previousData } = ctx as { previousData: [readonly unknown[], unknown][] };
        previousData?.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    }),
  });
}

// ============================================================================
// 통합 훅
// ============================================================================

/**
 * 정산 관리 통합 훅 (구인자)
 *
 * @description 특정 공고의 정산 관리에 필요한 모든 기능 제공
 */
export function useSettlement(jobPostingId: string) {
  const workLogsQuery = useWorkLogsByJobPosting(jobPostingId);
  const summaryQuery = useSettlementSummary(jobPostingId);

  const calculateMutation = useCalculateSettlement();
  const updateTimeMutation = useUpdateWorkTime();
  const settleMutation = useSettleWorkLog();
  const bulkSettleMutation = useBulkSettlement();
  const updateStatusMutation = useUpdateSettlementStatus();

  // 필터링 헬퍼
  const filterWorkLogs = (
    filters: Omit<SettlementFilters, 'jobPostingId'>
  ): SettlementWorkLog[] => {
    let result = workLogsQuery.data ?? [];

    if (filters.payrollStatus) {
      result = result.filter((wl) => wl.payrollStatus === filters.payrollStatus);
    }

    if (filters.role) {
      // 커스텀 역할 지원: role이 'other'이면 customRole로 매칭
      result = result.filter((wl) => {
        // 표준 역할 매칭
        if (wl.role === filters.role) return true;
        // 커스텀 역할 매칭: wl.role이 'other'이고 customRole이 filters.role과 일치
        if (wl.role === 'other' && wl.customRole === filters.role) return true;
        return false;
      });
    }

    if (filters.dateRange) {
      result = result.filter(
        (wl) => wl.date >= filters.dateRange!.start && wl.date <= filters.dateRange!.end
      );
    }

    return result;
  };

  // 정산 대기 목록
  const pendingWorkLogs = filterWorkLogs({ payrollStatus: STATUS.PAYROLL.PENDING });

  // 정산 완료 목록
  const completedWorkLogs = filterWorkLogs({ payrollStatus: STATUS.PAYROLL.COMPLETED });

  // 총 정산 대기 금액
  const totalPendingAmount = pendingWorkLogs.reduce(
    (sum, wl) => sum + (wl.calculatedAmount ?? 0),
    0
  );

  // 총 정산 완료 금액
  const totalCompletedAmount = completedWorkLogs.reduce(
    (sum, wl) => sum + (wl.payrollAmount ?? 0),
    0
  );

  return {
    // 근무 기록
    workLogs: workLogsQuery.data ?? [],
    isLoading: workLogsQuery.isLoading,
    isRefreshing: workLogsQuery.isRefetching,
    error: workLogsQuery.error,
    refresh: workLogsQuery.refetch,

    // 요약 정보
    summary: summaryQuery.data,
    isLoadingSummary: summaryQuery.isLoading,

    // 정산 계산
    calculate: calculateMutation.mutateAsync,
    isCalculating: calculateMutation.isPending,
    calculationResult: calculateMutation.data,

    // 시간 수정
    updateWorkTime: updateTimeMutation.mutate,
    isUpdatingTime: updateTimeMutation.isPending,

    // 개별 정산 - 2초 throttle
    settleWorkLog: useThrottledCallback(settleMutation.mutate, 2000),
    settleWorkLogAsync: settleMutation.mutateAsync,
    isSettling: settleMutation.isPending,

    // 일괄 정산 - 2초 throttle
    bulkSettle: useThrottledCallback(bulkSettleMutation.mutate, 2000),
    bulkSettleAsync: bulkSettleMutation.mutateAsync,
    isBulkSettling: bulkSettleMutation.isPending,
    bulkSettleResult: bulkSettleMutation.data,

    // 상태 변경 — 지급 완료 되돌리기는 결과를 보고 모달을 닫아야 하므로 Async 도 함께 노출한다.
    updateStatus: updateStatusMutation.mutate,
    updateStatusAsync: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,

    // 필터링 헬퍼
    filterWorkLogs,

    // 계산된 값
    pendingWorkLogs,
    completedWorkLogs,
    totalPendingAmount,
    totalCompletedAmount,
    pendingCount: pendingWorkLogs.length,
    completedCount: completedWorkLogs.length,
  };
}
