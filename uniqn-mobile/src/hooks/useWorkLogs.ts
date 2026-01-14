/**
 * UNIQN Mobile - 근무 기록 훅
 *
 * @description TanStack Query 기반 출퇴근/근무 기록 훅
 * @version 1.0.0
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  getMyWorkLogs,
  getWorkLogsByDate,
  getWorkLogById,
  getTodayCheckedInWorkLog,
  isCurrentlyWorking,
  getWorkLogStats,
  getMonthlyPayroll,
} from '@/services/workLogService';
import { useAuthStore } from '@/stores/authStore';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';

// ============================================================================
// Types
// ============================================================================

interface UseWorkLogsOptions {
  limit?: number;
  enabled?: boolean;
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

// @deprecated useCheckIn, useCheckOut, useAttendance 훅은 제거됨
// 출퇴근은 QR 스캔으로만 가능: eventQRService.processEventQRCheckIn 사용

export default useWorkLogs;
