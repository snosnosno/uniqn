/**
 * UNIQN Mobile - 지원자 관리 훅 배럴
 *
 * @description 지원자 관리 관련 훅 통합 export
 * @version 1.1.0
 *
 * 기존 import 경로 호환성 유지:
 * - import { useApplicantManagement } from '@/hooks/useApplicantManagement'
 * - import { useApplicantManagement } from '@/hooks/applicant'
 * - import { useApplicantManagement } from '@/hooks'
 */

import type { ApplicantWithDetails } from '@/services';

import { useApplicantsByJobPosting, useApplicantStats } from './useApplicantsByJobPosting';
import { getPrimaryRoleId } from './helpers';

import {
  useConfirmApplication,
  useRejectApplication,
  useBulkConfirmApplications,
  useMarkAsRead,
} from './useApplicantMutations';

import { useCancellationRequests, useReviewCancellation } from './useCancellationManagement';

import {
  useConfirmApplicationWithHistory,
  useCancelConfirmation,
  useConvertToStaff,
  useBatchConvertToStaff,
} from './useStaffConversion';

// ============================================================================
// Types
// ============================================================================

/** 지원자 필터링 옵션 */
interface ApplicantFilters {
  status?: string;
  role?: string;
  sortBy?: 'appliedAt' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/** 지원자 관리 통합 훅 옵션 */
export interface UseApplicantManagementOptions {
  /** 실시간 구독 활성화 (기본값: false) */
  realtime?: boolean;
}

// ============================================================================
// Individual Hooks Re-export
// ============================================================================

export {
  useApplicantsByJobPosting,
  useApplicantStats,
  type UseApplicantsByJobPostingOptions,
} from './useApplicantsByJobPosting';

export {
  useConfirmApplication,
  useRejectApplication,
  useBulkConfirmApplications,
  useMarkAsRead,
} from './useApplicantMutations';

export { useCancellationRequests, useReviewCancellation } from './useCancellationManagement';

export {
  useConfirmApplicationWithHistory,
  useCancelConfirmation,
  useConvertToStaff,
  useBatchConvertToStaff,
  useCanConvertToStaff,
} from './useStaffConversion';

export { getPrimaryRoleId, getAllRoleIds } from './helpers';

// ============================================================================
// 통합 훅
// ============================================================================

/**
 * 지원자 관리 통합 훅 (구인자)
 *
 * @description 특정 공고의 지원자 관리에 필요한 모든 기능 제공
 * @param options.realtime - true일 경우 onSnapshot으로 실시간 동기화
 */
export function useApplicantManagement(
  jobPostingId: string,
  options: UseApplicantManagementOptions = {}
) {
  const applicantsQuery = useApplicantsByJobPosting(jobPostingId, undefined, {
    realtime: options.realtime,
  });
  const statsQuery = useApplicantStats(jobPostingId);

  const confirmMutation = useConfirmApplication();
  const rejectMutation = useRejectApplication();
  const bulkConfirmMutation = useBulkConfirmApplications();
  const markAsReadMutation = useMarkAsRead();

  // v2.0 히스토리 기반 확정/취소
  const confirmWithHistoryMutation = useConfirmApplicationWithHistory();
  const cancelConfirmationMutation = useCancelConfirmation();

  // 취소 요청 관리
  const cancellationRequestsQuery = useCancellationRequests(jobPostingId);
  const reviewCancellationMutation = useReviewCancellation();

  // 스태프 변환
  const convertToStaffMutation = useConvertToStaff();
  const batchConvertToStaffMutation = useBatchConvertToStaff();

  // 지원자 목록 추출 (ApplicantListResult에서 applicants 배열 추출)
  const applicants = applicantsQuery.data?.applicants ?? [];

  // 지원자 필터링 헬퍼
  const filterApplicants = (filters: ApplicantFilters): ApplicantWithDetails[] => {
    let result = [...applicants];

    if (filters.status) {
      result = result.filter((a) => a.status === filters.status);
    }

    if (filters.role) {
      // 역할 필터링: assignments 기반 (appliedRole 제거됨)
      result = result.filter((a) => {
        const primaryRole = getPrimaryRoleId(a.assignments);
        // 표준 역할 매칭
        if (primaryRole === filters.role) return true;
        // 커스텀 역할 매칭: primaryRole이 'other'이고 customRole이 filters.role과 일치
        if (primaryRole === 'other' && a.customRole === filters.role) return true;
        return false;
      });
    }

    if (filters.sortBy) {
      result = result.sort((a, b) => {
        let comparison = 0;
        switch (filters.sortBy) {
          case 'appliedAt': {
            const aTime = a.createdAt
              ? (typeof a.createdAt === 'string'
                  ? new Date(a.createdAt)
                  : a.createdAt instanceof Date
                    ? a.createdAt
                    : a.createdAt.toDate()
                ).getTime()
              : 0;
            const bTime = b.createdAt
              ? (typeof b.createdAt === 'string'
                  ? new Date(b.createdAt)
                  : b.createdAt instanceof Date
                    ? b.createdAt
                    : b.createdAt.toDate()
                ).getTime()
              : 0;
            comparison = aTime - bTime;
            break;
          }
          case 'name':
            comparison = (a.applicantName || '').localeCompare(b.applicantName || '');
            break;
          case 'status':
            comparison = (a.status || '').localeCompare(b.status || '');
            break;
        }
        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  };

  // 상태별 지원자 수
  const countByStatus = (status: string): number => {
    return applicants.filter((a) => a.status === status).length;
  };

  return {
    // 지원자 목록
    applicants,
    isLoading: applicantsQuery.isLoading,
    error: applicantsQuery.error,
    refresh: applicantsQuery.refetch,

    // 전체 통계 (ApplicationStats)
    stats: applicantsQuery.data?.stats,

    // 역할별 통계 (Record<StaffRole, ApplicationStats>)
    statsByRole: statsQuery.data,
    isLoadingStatsByRole: statsQuery.isLoading,

    // 확정/거절
    confirmApplication: confirmMutation.mutate,
    confirmApplicationAsync: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,

    rejectApplication: rejectMutation.mutate,
    rejectApplicationAsync: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,

    bulkConfirm: bulkConfirmMutation.mutate,
    isBulkConfirming: bulkConfirmMutation.isPending,

    // 읽음 처리
    markAsRead: markAsReadMutation.mutate,

    // v2.0 히스토리 기반 확정/취소
    confirmWithHistory: confirmWithHistoryMutation.mutate,
    confirmWithHistoryAsync: confirmWithHistoryMutation.mutateAsync,
    isConfirmingWithHistory: confirmWithHistoryMutation.isPending,

    cancelConfirmation: cancelConfirmationMutation.mutate,
    cancelConfirmationAsync: cancelConfirmationMutation.mutateAsync,
    isCancellingConfirmation: cancelConfirmationMutation.isPending,

    // 스태프 변환
    convertToStaff: convertToStaffMutation.mutate,
    convertToStaffAsync: convertToStaffMutation.mutateAsync,
    isConvertingToStaff: convertToStaffMutation.isPending,

    batchConvertToStaff: batchConvertToStaffMutation.mutate,
    isBatchConvertingToStaff: batchConvertToStaffMutation.isPending,

    // 취소 요청 관리
    cancellationRequests: cancellationRequestsQuery.data ?? [],
    isLoadingCancellationRequests: cancellationRequestsQuery.isLoading,
    refreshCancellationRequests: cancellationRequestsQuery.refetch,

    reviewCancellation: reviewCancellationMutation.mutate,
    reviewCancellationAsync: reviewCancellationMutation.mutateAsync,
    isReviewingCancellation: reviewCancellationMutation.isPending,

    // 헬퍼
    filterApplicants,
    countByStatus,

    // 상태별 카운트 단축키
    pendingCount: countByStatus('pending'),
    confirmedCount: countByStatus('confirmed'),
    rejectedCount: countByStatus('rejected'),
    completedCount: countByStatus('completed'),
    cancellationPendingCount: countByStatus('cancellation_pending'),
  };
}

export default useApplicantManagement;
