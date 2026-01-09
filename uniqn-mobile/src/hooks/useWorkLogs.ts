/**
 * UNIQN Mobile - 근무 기록 훅
 *
 * @description TanStack Query 기반 출퇴근/근무 기록 훅
 * @version 1.0.0
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  getMyWorkLogs,
  getWorkLogsByDate,
  getWorkLogById,
  getTodayCheckedInWorkLog,
  isCurrentlyWorking,
  getWorkLogStats,
  getMonthlyPayroll,
  checkIn,
  checkOut,
} from '@/services/workLogService';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { queryKeys, cachingPolicies, invalidateQueries } from '@/lib/queryClient';
import { logger } from '@/utils/logger';
// WorkLog type is used by the service functions

// ============================================================================
// Types
// ============================================================================

interface UseWorkLogsOptions {
  limit?: number;
  enabled?: boolean;
}

interface UseCheckInOutOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 내 근무 기록 목록 조회 훅
 */
export function useWorkLogs(options: UseWorkLogsOptions = {}) {
  const { limit = 50, enabled = true } = options;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: queryKeys.workLogs.mine(),
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getMyWorkLogs(staffId, limit);
    },
    enabled: enabled && !!staffId,
    staleTime: cachingPolicies.frequent,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.workLogs.all,
    });
  }, [queryClient]);

  return {
    workLogs: query.data ?? [],
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    error: query.error,
    refresh,
    refetch: query.refetch,
  };
}

/**
 * 특정 날짜의 근무 기록 조회 훅
 */
export function useWorkLogsByDate(date: string, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: queryKeys.workLogs.byDate(date),
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getWorkLogsByDate(staffId, date);
    },
    enabled: enabled && !!staffId && !!date,
    staleTime: cachingPolicies.frequent,
  });

  return {
    workLogs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 근무 기록 상세 조회 훅
 */
export function useWorkLogDetail(workLogId: string, enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.workLogs.bySchedule(workLogId),
    queryFn: () => getWorkLogById(workLogId),
    enabled: enabled && !!workLogId,
    staleTime: cachingPolicies.standard,
  });

  return {
    workLog: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 현재 근무 상태 조회 훅
 */
export function useCurrentWorkStatus(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: [...queryKeys.workLogs.all, 'current'],
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      const workLog = await getTodayCheckedInWorkLog(staffId);
      const working = await isCurrentlyWorking(staffId);
      return { workLog, isWorking: working };
    },
    enabled: enabled && !!staffId,
    staleTime: cachingPolicies.realtime,
    refetchInterval: 30 * 1000, // 30초마다 자동 갱신
  });

  return {
    currentWorkLog: query.data?.workLog ?? null,
    isWorking: query.data?.isWorking ?? false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 근무 기록 통계 조회 훅
 */
export function useWorkLogStats(enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: [...queryKeys.workLogs.all, 'stats'],
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getWorkLogStats(staffId);
    },
    enabled: enabled && !!staffId,
    staleTime: cachingPolicies.stable,
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 월별 정산 조회 훅
 */
export function useMonthlyPayroll(year: number, month: number, enabled = true) {
  const user = useAuthStore((state) => state.user);
  const staffId = user?.uid;

  const query = useQuery({
    queryKey: [...queryKeys.workLogs.all, 'payroll', year, month],
    queryFn: async () => {
      if (!staffId) throw new Error('로그인이 필요합니다.');
      return getMonthlyPayroll(staffId, year, month);
    },
    enabled: enabled && !!staffId,
    staleTime: cachingPolicies.stable,
  });

  return {
    payroll: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 출근 체크 훅
 */
export function useCheckIn(options: UseCheckInOutOptions = {}) {
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();
  // queryClient는 향후 캐시 무효화 시 활용
  void queryClient;
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async ({
      workLogId,
      qrCodeId,
    }: {
      workLogId: string;
      qrCodeId?: string;
    }) => {
      return checkIn(workLogId, qrCodeId);
    },
    onSuccess: (result) => {
      logger.info('출근 체크 성공', { workLogId: result.workLogId });

      // 캐시 무효화
      invalidateQueries.workLogs();
      invalidateQueries.schedules();

      addToast({
        type: 'success',
        message: result.message,
      });

      onSuccess?.();
    },
    onError: (error: Error) => {
      logger.error('출근 체크 실패', error);

      addToast({
        type: 'error',
        message: error.message || '출근 처리에 실패했습니다.',
      });

      onError?.(error);
    },
  });

  return {
    checkIn: mutation.mutate,
    checkInAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * 퇴근 체크 훅
 */
export function useCheckOut(options: UseCheckInOutOptions = {}) {
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();
  // queryClient는 향후 캐시 무효화 시 활용
  void queryClient;
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async ({
      workLogId,
      qrCodeId,
    }: {
      workLogId: string;
      qrCodeId?: string;
    }) => {
      return checkOut(workLogId, qrCodeId);
    },
    onSuccess: (result) => {
      logger.info('퇴근 체크 성공', {
        workLogId: result.workLogId,
        workDuration: result.workDuration,
      });

      // 캐시 무효화
      invalidateQueries.workLogs();
      invalidateQueries.schedules();

      const hours = Math.floor(result.workDuration / 60);
      const minutes = result.workDuration % 60;
      const durationText =
        hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;

      addToast({
        type: 'success',
        message: `${result.message} (근무시간: ${durationText})`,
      });

      onSuccess?.();
    },
    onError: (error: Error) => {
      logger.error('퇴근 체크 실패', error);

      addToast({
        type: 'error',
        message: error.message || '퇴근 처리에 실패했습니다.',
      });

      onError?.(error);
    },
  });

  return {
    checkOut: mutation.mutate,
    checkOutAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * 출퇴근 통합 훅
 */
export function useAttendance(options: UseCheckInOutOptions = {}) {
  const { currentWorkLog, isWorking, isLoading: isLoadingStatus, refetch } = useCurrentWorkStatus();
  const { checkIn, isLoading: isCheckingIn } = useCheckIn(options);
  const { checkOut, isLoading: isCheckingOut } = useCheckOut(options);

  const handleAttendance = useCallback(
    (workLogId: string, qrCodeId?: string) => {
      if (isWorking) {
        checkOut({ workLogId, qrCodeId });
      } else {
        checkIn({ workLogId, qrCodeId });
      }
    },
    [isWorking, checkIn, checkOut]
  );

  return {
    currentWorkLog,
    isWorking,
    isLoading: isLoadingStatus || isCheckingIn || isCheckingOut,
    isCheckingIn,
    isCheckingOut,
    checkIn,
    checkOut,
    handleAttendance,
    refetch,
  };
}

export default useWorkLogs;
