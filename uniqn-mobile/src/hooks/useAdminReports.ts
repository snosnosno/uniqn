/**
 * UNIQN Mobile - 관리자 신고 관리 훅
 *
 * @description 관리자용 신고 조회 및 처리 기능
 * @version 1.0.0
 *
 * 기능:
 * - 전체 신고 목록 조회 (필터링)
 * - 신고 상세 조회
 * - 신고 처리 (상태 변경)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllReports,
  getReportById,
  reviewReport,
  type GetAllReportsFilters,
} from '@/services/reportService';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { ReviewReportInput } from '@/types/report';

// Get toast from the store (can be called outside of React components)
const getToast = () => useToastStore.getState();

// ============================================================================
// Types
// ============================================================================

export type { GetAllReportsFilters as ReportFilters };

// ============================================================================
// Hooks
// ============================================================================

/**
 * 전체 신고 목록 조회 훅 (관리자용)
 *
 * @example
 * ```tsx
 * const { data: reports, isLoading, refetch } = useAdminReports({
 *   status: 'pending',
 *   severity: 'critical',
 * });
 * ```
 */
export function useAdminReports(filters: GetAllReportsFilters = {}) {
  return useQuery({
    queryKey: [...queryKeys.reports.all, 'admin', filters],
    queryFn: () => getAllReports(filters),
    staleTime: cachingPolicies.frequent, // 2분
  });
}

/**
 * 신고 상세 조회 훅
 *
 * @example
 * ```tsx
 * const { data: report, isLoading } = useReportDetail(reportId);
 * ```
 */
export function useReportDetail(reportId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.detail(reportId),
    queryFn: () => getReportById(reportId),
    staleTime: cachingPolicies.standard, // 5분
    enabled: enabled && !!reportId,
  });
}

/**
 * 신고 처리 Mutation 훅
 *
 * @description 신고 상태 변경 및 처리 메모 작성
 *
 * @example
 * ```tsx
 * const { mutateAsync: review, isPending } = useReviewReport();
 *
 * await review({
 *   reportId: '...',
 *   status: 'resolved',
 *   reviewerNotes: '처리 완료',
 * });
 * ```
 */
export function useReviewReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReviewReportInput) => reviewReport(input),
    onSuccess: (_, variables) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });

      logger.info('신고 처리 완료', {
        component: 'useReviewReport',
        reportId: variables.reportId,
        status: variables.status,
      });

      getToast().success('신고가 처리되었습니다');
    },
    onError: (error) => {
      logger.error('신고 처리 실패', error as Error, {
        component: 'useReviewReport',
      });

      getToast().error('신고 처리에 실패했습니다');
    },
  });
}

/**
 * 신고 통계 훅 (대시보드용)
 *
 * @description pending 상태의 신고 수를 반환
 */
export function useReportStats() {
  const { data: pendingReports } = useAdminReports({ status: 'pending' });

  return {
    pendingCount: pendingReports?.length ?? 0,
    criticalCount: pendingReports?.filter((r) => r.severity === 'critical').length ?? 0,
    highCount: pendingReports?.filter((r) => r.severity === 'high').length ?? 0,
  };
}

export default {
  useAdminReports,
  useReportDetail,
  useReviewReport,
  useReportStats,
};
