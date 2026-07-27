/**
 * UNIQN Mobile - applicant management barrel
 *
 * @description Active public surface for employer applicant management.
 * Legacy applicant-to-staff conversion hooks are intentionally excluded.
 */

import { useCallback, useMemo } from 'react';
import type { ApplicantWithDetails } from '@/services';
import { STATUS } from '@/constants';
import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';
import { toDateValue } from '@/utils/date';
import { useApplicantsByJobPosting } from './useApplicantsByJobPosting';
import { getPrimaryRoleId, getAllRoleIds } from './helpers';
import {
  useConfirmApplication,
  useRejectApplication,
  useBulkConfirmApplications,
  useMarkAsRead,
} from './useApplicantMutations';
import { useReviewCancellation } from './useCancellationManagement';
import { useConfirmApplicationWithHistory, useCancelConfirmation } from './useStaffConversion';
import type { ApplicationStats, StaffRole } from '@/types';

interface ApplicantFilters {
  status?: string;
  role?: string;
  sortBy?: 'appliedAt' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface UseApplicantManagementOptions {
  realtime?: boolean;
}

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
export { useConfirmApplicationWithHistory, useCancelConfirmation } from './useStaffConversion';
export { getPrimaryRoleId, getAllRoleIds } from './helpers';

function createEmptyApplicationStats(): ApplicationStats {
  return {
    total: 0,
    applied: 0,
    confirmed: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
    cancellationPending: 0,
  };
}

/**
 * 지원자를 assignments의 **모든** 역할에 1씩 카운트한다.
 * 멀티역할(딜러+플로어 겸직) 지원자는 각 역할 statsByRole에 1번씩 반영.
 *
 * 주의: Σ statsByRole[role].total > applicants.length 가능 (중복 카운트는 의도됨).
 * 이유: "역할별 지원자 수" 카드는 각 역할 관점의 수요를 보여줘야 하고,
 *       전체 합계는 별도 overall count(`confirmedCount` 등)에서 사람 단위로 제공.
 */
function buildStatsByRole(applicants: ApplicantWithDetails[]): Record<StaffRole, ApplicationStats> {
  const statsByRole: Record<string, ApplicationStats> = {};

  applicants.forEach((application) => {
    const roleIds = getAllRoleIds(application.assignments);
    const baseRoles = roleIds.length > 0 ? roleIds : ['other'];
    const effectiveRoles = baseRoles.map((roleId) =>
      roleId === 'other' && application.customRole ? application.customRole : roleId
    );
    // 같은 application이 다수 assignment에서 동일 역할을 가지면 1번만 카운트
    const uniqueEffectiveRoles = Array.from(new Set(effectiveRoles));

    const statsKey = STATUS_TO_STATS_KEY[application.status];

    uniqueEffectiveRoles.forEach((role) => {
      if (!statsByRole[role]) {
        statsByRole[role] = createEmptyApplicationStats();
      }

      statsByRole[role].total++;

      if (statsKey && statsKey !== 'total') {
        statsByRole[role][statsKey]++;
      }
    });
  });

  return statsByRole as Record<StaffRole, ApplicationStats>;
}

export function useApplicantManagement(
  jobPostingId: string,
  options: UseApplicantManagementOptions = {}
) {
  const applicantsQuery = useApplicantsByJobPosting(jobPostingId, undefined, {
    realtime: options.realtime,
  });

  const confirmMutation = useConfirmApplication();
  const rejectMutation = useRejectApplication();
  const bulkConfirmMutation = useBulkConfirmApplications();
  const markAsReadMutation = useMarkAsRead();
  const confirmWithHistoryMutation = useConfirmApplicationWithHistory();
  const cancelConfirmationMutation = useCancelConfirmation();
  const reviewCancellationMutation = useReviewCancellation();

  const applicants = useMemo(
    () => applicantsQuery.data?.applicants ?? [],
    [applicantsQuery.data?.applicants]
  );
  const statsByRole = useMemo(() => buildStatsByRole(applicants), [applicants]);
  const cancellationRequests = useMemo(
    () =>
      applicants.filter(
        (application) => application.status === STATUS.APPLICATION.CANCELLATION_PENDING
      ),
    [applicants]
  );

  const filterApplicants = useCallback(
    (filters: ApplicantFilters): ApplicantWithDetails[] => {
      let result = [...applicants];

      if (filters.status) {
        result = result.filter((application) => application.status === filters.status);
      }

      if (filters.role) {
        result = result.filter((application) => {
          const primaryRole = getPrimaryRoleId(application.assignments);
          if (primaryRole === filters.role) {
            return true;
          }

          return primaryRole === 'other' && application.customRole === filters.role;
        });
      }

      if (filters.sortBy) {
        result = result.sort((left, right) => {
          let comparison = 0;

          switch (filters.sortBy) {
            case 'appliedAt': {
              const leftTime = toDateValue(left.createdAt);
              const rightTime = toDateValue(right.createdAt);

              if (leftTime === null && rightTime === null) {
                comparison = 0;
              } else if (leftTime === null) {
                comparison = 1;
              } else if (rightTime === null) {
                comparison = -1;
              } else {
                comparison = leftTime - rightTime;
              }
              break;
            }
            case 'name':
              comparison = (left.applicantName || '').localeCompare(right.applicantName || '');
              break;
            case 'status':
              comparison = (left.status || '').localeCompare(right.status || '');
              break;
          }

          return filters.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      return result;
    },
    [applicants]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const application of applicants) {
      counts[application.status] = (counts[application.status] || 0) + 1;
    }

    return counts;
  }, [applicants]);

  const countByStatus = useCallback(
    (status: string): number => statusCounts[status] || 0,
    [statusCounts]
  );

  return {
    applicants,
    isLoading: applicantsQuery.isLoading,
    isRefreshing: applicantsQuery.isRefetching,
    error: applicantsQuery.error,
    refresh: applicantsQuery.refetch,

    stats: applicantsQuery.data?.stats,
    statsByRole,
    isLoadingStatsByRole: applicantsQuery.isLoading,

    confirmApplication: confirmMutation.mutate,
    confirmApplicationAsync: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,

    rejectApplication: rejectMutation.mutate,
    rejectApplicationAsync: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,

    bulkConfirm: bulkConfirmMutation.mutate,
    isBulkConfirming: bulkConfirmMutation.isPending,

    markAsRead: markAsReadMutation.mutate,

    confirmWithHistory: confirmWithHistoryMutation.mutate,
    confirmWithHistoryAsync: confirmWithHistoryMutation.mutateAsync,
    isConfirmingWithHistory: confirmWithHistoryMutation.isPending,

    cancelConfirmation: cancelConfirmationMutation.mutate,
    cancelConfirmationAsync: cancelConfirmationMutation.mutateAsync,
    isCancellingConfirmation: cancelConfirmationMutation.isPending,

    cancellationRequests,
    isLoadingCancellationRequests: applicantsQuery.isLoading,
    isRefetchingCancellationRequests: applicantsQuery.isRefetching,
    refreshCancellationRequests: applicantsQuery.refetch,

    reviewCancellation: reviewCancellationMutation.mutate,
    reviewCancellationAsync: reviewCancellationMutation.mutateAsync,
    isReviewingCancellation: reviewCancellationMutation.isPending,
    /**
     * 지금 검토 중인 지원서 id — 전역 isPending 을 목록 전체에 뿌리면 1건 처리 중에
     * 나머지 카드까지 잠긴다(CANCEL-15). 대상 카드만 잠그는 데 쓴다.
     */
    reviewingCancellationId: reviewCancellationMutation.isPending
      ? (reviewCancellationMutation.variables?.applicationId ?? null)
      : null,

    filterApplicants,
    countByStatus,

    pendingCount: countByStatus(STATUS.APPLICATION.APPLIED),
    confirmedCount: countByStatus(STATUS.APPLICATION.CONFIRMED),
    rejectedCount: countByStatus(STATUS.APPLICATION.REJECTED),
    completedCount: countByStatus(STATUS.APPLICATION.COMPLETED),
    cancellationPendingCount: countByStatus(STATUS.APPLICATION.CANCELLATION_PENDING),
  };
}

export default useApplicantManagement;
