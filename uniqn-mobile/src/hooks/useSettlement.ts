/**
 * UNIQN Mobile - 정산 관리 훅 (구인자용)
 *
 * @description 근무 기록 조회, 시간 수정, 정산 처리
 * @version 1.0.0
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
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
    staleTime: cachingPolicies.frequent,
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
    staleTime: cachingPolicies.frequent,
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
    staleTime: cachingPolicies.frequent,
  });
}

// ============================================================================
// 정산 계산 훅
// ============================================================================

/**
 * 정산 금액 계산 훅
 */
export function useCalculateSettlement() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: CalculateSettlementInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return calculateSettlement(input, user.uid);
    },
    onSuccess: (result) => {
      logger.info('정산 금액 계산 완료', {
        workLogId: result.workLogId,
        netPay: result.netPay,
      });
      // 정산 캐시 무효화 (계산 결과 즉시 반영)
      queryClient.invalidateQueries({
        queryKey: queryKeys.settlement.all,
      });
    },
    onError: (error) => {
      logger.error('정산 금액 계산 실패', error as Error);
    },
  });
}

// ============================================================================
// 시간 수정 훅
// ============================================================================

/**
 * 근무 시간 수정 뮤테이션 훅
 */
export function useUpdateWorkTime() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: UpdateWorkTimeInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return updateWorkTimeForSettlement(input, user.uid);
    },
    onSuccess: (_, input) => {
      logger.info('근무 시간 수정 완료', { workLogId: input.workLogId });
      addToast({
        type: 'success',
        message: '근무 시간이 수정되었습니다.',
      });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.settlement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workLogs.all,
      });
      // 스케줄 캐시 무효화 (ScheduleDetailModal 탭 간 동기화)
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedules.all,
      });
    },
    onError: (error) => {
      logger.error('근무 시간 수정 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '시간 수정에 실패했습니다.',
      });
    },
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
    mutationFn: (input: SettleWorkLogInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
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

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.settlement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workLogs.all,
      });
    },
    onError: (error) => {
      logger.error('개별 정산 실패', error as Error);
      addToast({
        type: 'error',
        message: '정산 처리에 실패했습니다.',
      });
    },
  });
}

/**
 * 일괄 정산 뮤테이션 훅
 */
export function useBulkSettlement() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: BulkSettlementInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
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

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.settlement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workLogs.all,
      });
    },
    onError: (error) => {
      logger.error('일괄 정산 실패', error as Error);
      addToast({
        type: 'error',
        message: '일괄 정산에 실패했습니다.',
      });
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
    }: {
      workLogId: string;
      status: PayrollStatus;
    }) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
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

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.settlement.all,
      });
    },
    onError: (error) => {
      logger.error('정산 상태 변경 실패', error as Error);
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
  const filterWorkLogs = (filters: Omit<SettlementFilters, 'jobPostingId'>): SettlementWorkLog[] => {
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
