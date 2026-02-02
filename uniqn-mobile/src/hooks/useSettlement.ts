/**
 * UNIQN Mobile - 정산 관리 훅 (구인자용)
 *
 * @description 근무 기록 조회, 시간 수정, 정산 처리
 * @version 1.0.0
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getWorkLogsByJobPosting,
  calculateSettlement,
  updateWorkTimeForSettlement,
  settleWorkLog,
  bulkSettlement,
  updateSettlementStatus,
  getJobPostingSettlementSummary,
  getMySettlementSummary,
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
import { errorHandlerPresets, createMutationErrorHandler } from '@/shared/errors';
import { requireAuth } from '@/errors/guardErrors';
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

  return useQuery({
    queryKey: queryKeys.settlement.byJobPosting(jobPostingId),
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

  return useQuery({
    queryKey: queryKeys.settlement.summary(jobPostingId),
    queryFn: () => getJobPostingSettlementSummary(jobPostingId, user!.uid),
    enabled: !!user && !!jobPostingId,
    staleTime: queryCachingOptions.settlement.staleTime,
    gcTime: queryCachingOptions.settlement.gcTime,
  });
}

/**
 * 내 전체 정산 요약 조회 훅
 */
export function useMySettlementSummary(dateRange?: { start: string; end: string }) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.settlement.mySummary(),
    queryFn: () => getMySettlementSummary(user!.uid, dateRange),
    enabled: !!user,
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
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: SettleWorkLogInput) => {
      requireAuth(user?.uid, 'useSettlement');
      return settleWorkLog(input, user.uid);
    },
    onSuccess: (result) => {
      if (result.success) {
        logger.info('개별 정산 완료', {
          workLogId: result.workLogId,
          amount: result.amount,
        });
        addToast({
          type: 'success',
          message: `${result.amount.toLocaleString()}원 정산 완료`,
        });
      } else {
        addToast({
          type: 'error',
          message: result.message,
        });
      }

      // 이벤트 기반 캐시 무효화
      invalidateRelated('settlement.process');
    },
    onError: errorHandlerPresets.settlement(addToast),
  });
}

/**
 * 일괄 정산 뮤테이션 훅
 */
export function useBulkSettlement() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: BulkSettlementInput) => {
      requireAuth(user?.uid, 'useSettlement');
      return bulkSettlement(input, user.uid);
    },
    onSuccess: (result) => {
      logger.info('일괄 정산 완료', {
        success: result.successCount,
        failed: result.failedCount,
        totalAmount: result.totalAmount,
      });

      if (result.successCount > 0) {
        addToast({
          type: 'success',
          message: `${result.successCount}건 / ${result.totalAmount.toLocaleString()}원 정산 완료`,
        });
      }

      if (result.failedCount > 0) {
        addToast({
          type: 'warning',
          message: `${result.failedCount}건 정산 실패`,
        });
      }

      // 이벤트 기반 캐시 무효화
      invalidateRelated('settlement.bulkProcess');
    },
    onError: errorHandlerPresets.settlement(addToast),
  });
}

/**
 * 정산 상태 변경 뮤테이션 훅
 */
export function useUpdateSettlementStatus() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({ workLogId, status }: { workLogId: string; status: PayrollStatus }) => {
      requireAuth(user?.uid, 'useSettlement');
      return updateSettlementStatus(workLogId, status, user.uid);
    },
    onSuccess: (_, { status }) => {
      logger.info('정산 상태 변경 완료', { status });

      const statusMessages: Record<PayrollStatus, string> = {
        pending: '정산 대기로 변경되었습니다.',
        processing: '정산 처리 중으로 변경되었습니다.',
        completed: '정산이 완료되었습니다.',
      };

      addToast({
        type: 'success',
        message: statusMessages[status],
      });

      // 이벤트 기반 캐시 무효화
      invalidateRelated('settlement.process');
    },
    onError: errorHandlerPresets.settlement(addToast),
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
        const wlWithCustomRole = wl as SettlementWorkLog & { customRole?: string };
        // 표준 역할 매칭
        if (wl.role === filters.role) return true;
        // 커스텀 역할 매칭: wl.role이 'other'이고 customRole이 filters.role과 일치
        if (wl.role === 'other' && wlWithCustomRole.customRole === filters.role) return true;
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
  const pendingWorkLogs = filterWorkLogs({ payrollStatus: 'pending' });

  // 정산 완료 목록
  const completedWorkLogs = filterWorkLogs({ payrollStatus: 'completed' });

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

    // 개별 정산
    settleWorkLog: settleMutation.mutate,
    settleWorkLogAsync: settleMutation.mutateAsync,
    isSettling: settleMutation.isPending,

    // 일괄 정산
    bulkSettle: bulkSettleMutation.mutate,
    bulkSettleAsync: bulkSettleMutation.mutateAsync,
    isBulkSettling: bulkSettleMutation.isPending,
    bulkSettleResult: bulkSettleMutation.data,

    // 상태 변경
    updateStatus: updateStatusMutation.mutate,
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

/**
 * 전체 정산 현황 훅 (대시보드용)
 */
export function useSettlementDashboard() {
  const summaryQuery = useMySettlementSummary();

  return {
    summary: summaryQuery.data,
    isLoading: summaryQuery.isLoading,
    error: summaryQuery.error,
    refresh: summaryQuery.refetch,

    // 계산된 값
    totalJobPostings: summaryQuery.data?.totalJobPostings ?? 0,
    totalWorkLogs: summaryQuery.data?.totalWorkLogs ?? 0,
    totalPendingAmount: summaryQuery.data?.totalPendingAmount ?? 0,
    totalCompletedAmount: summaryQuery.data?.totalCompletedAmount ?? 0,
    summariesByJobPosting: summaryQuery.data?.summariesByJobPosting ?? [],
  };
}

export default useSettlement;
