/**
 * UNIQN Mobile - 관리자 대시보드 훅
 *
 * @description TanStack Query 기반 대시보드 데이터 관리
 * @version 1.0.0
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUserRole,
  setUserActive,
  getSystemMetrics,
} from '@/services/adminService';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';
import type {
  AdminUserFilters,
  DashboardStats,
  PaginatedUsers,
  AdminUser,
  SystemMetrics,
} from '@/types/admin';
import type { UserRole } from '@/types/role';

// ============================================================================
// Dashboard Stats Hook
// ============================================================================

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: getDashboardStats,
    staleTime: cachingPolicies.frequent,
    gcTime: 10 * 60 * 1000,
  });
}

// ============================================================================
// User Management Hooks
// ============================================================================

interface UseAdminUsersOptions {
  filters?: AdminUserFilters;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export function useAdminUsers(options: UseAdminUsersOptions = {}) {
  const { filters = {}, page = 1, pageSize = 20, enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.admin.users({ ...filters, page, pageSize }),
    queryFn: () => getUsers(filters, page, pageSize),
    staleTime: cachingPolicies.frequent,
    gcTime: 10 * 60 * 1000,
    enabled,
  });
}

export function useAdminUserDetail(userId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.userDetail(userId),
    queryFn: () => getUserById(userId),
    staleTime: cachingPolicies.standard,
    enabled: enabled && !!userId,
  });
}

// ============================================================================
// User Mutations
// ============================================================================

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      newRole,
      reason,
    }: {
      userId: string;
      newRole: UserRole;
      reason?: string;
    }) => updateUserRole(userId, newRole, reason),
    onSuccess: (_data, variables) => {
      logger.info('사용자 역할 변경 성공', { userId: variables.userId });
      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: (error, variables) => {
      logger.error('사용자 역할 변경 실패', toError(error), {
        userId: variables.userId,
      });
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      isActive,
      reason,
    }: {
      userId: string;
      isActive: boolean;
      reason?: string;
    }) => setUserActive(userId, isActive, reason),
    onSuccess: (_data, variables) => {
      logger.info('사용자 상태 변경 성공', {
        userId: variables.userId,
        isActive: variables.isActive,
      });
      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: (error, variables) => {
      logger.error('사용자 상태 변경 실패', toError(error), {
        userId: variables.userId,
      });
    },
  });
}

// ============================================================================
// System Metrics Hook
// ============================================================================

export function useSystemMetrics(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.metrics(),
    queryFn: getSystemMetrics,
    staleTime: cachingPolicies.frequent,
    gcTime: 10 * 60 * 1000,
    enabled,
  });
}

// ============================================================================
// Combined Dashboard Hook
// ============================================================================

/**
 * 대시보드 전체 데이터를 한번에 가져오는 통합 훅
 */
export function useAdminDashboard() {
  const statsQuery = useAdminDashboardStats();
  const metricsQuery = useSystemMetrics();
  const queryClient = useQueryClient();

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.metrics() }),
    ]);
  };

  return {
    // Stats
    stats: statsQuery.data,
    isStatsLoading: statsQuery.isLoading,
    statsError: statsQuery.error,

    // Metrics
    metrics: metricsQuery.data,
    isMetricsLoading: metricsQuery.isLoading,
    metricsError: metricsQuery.error,

    // Combined states
    isLoading: statsQuery.isLoading || metricsQuery.isLoading,
    isRefreshing: statsQuery.isRefetching || metricsQuery.isRefetching,
    error: statsQuery.error || metricsQuery.error,

    // Actions
    refresh,
  };
}

// ============================================================================
// Type exports
// ============================================================================

export type { DashboardStats, PaginatedUsers, AdminUser, SystemMetrics };

export default useAdminDashboard;
