/**
 * UNIQN Mobile - 지원자 관리 훅 (구인자용)
 *
 * @description 지원자 조회, 확정, 거절, 대기열 관리
 * @version 1.0.0
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getApplicantsByJobPosting,
  confirmApplication,
  rejectApplication,
  bulkConfirmApplications,
  addToWaitlist,
  promoteFromWaitlist,
  markApplicationAsRead,
  getApplicantStatsByRole,
  reviewCancellationRequest,
  getCancellationRequests,
  type ApplicantWithDetails,
} from '@/services';
import {
  confirmApplicationWithHistory,
  cancelConfirmation,
} from '@/services/applicationHistoryService';
import {
  convertApplicantToStaff,
  batchConvertApplicants,
  canConvertToStaff,
} from '@/services/applicantConversionService';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import type { ConfirmApplicationInput, RejectApplicationInput, ApplicationStatus, Assignment } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ApplicantFilters {
  status?: string;
  role?: string;
  sortBy?: 'appliedAt' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// 지원자 조회 훅
// ============================================================================

/**
 * 공고별 지원자 목록 조회 훅
 */
export function useApplicantsByJobPosting(
  jobPostingId: string,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.applicantManagement.byJobPosting(jobPostingId),
    queryFn: () => getApplicantsByJobPosting(jobPostingId, user!.uid, statusFilter),
    enabled: !!user && !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });
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

// ============================================================================
// 지원자 확정/거절 훅
// ============================================================================

/**
 * 지원 확정 뮤테이션 훅
 */
export function useConfirmApplication() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ConfirmApplicationInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return confirmApplication(input, user.uid);
    },
    onSuccess: (result) => {
      logger.info('지원 확정 완료', {
        applicationId: result.applicationId,
        workLogId: result.workLogId,
      });
      addToast({
        type: 'success',
        message: '지원자가 확정되었습니다.',
      });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: (error) => {
      logger.error('지원 확정 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '확정에 실패했습니다.',
      });
    },
  });
}

/**
 * 지원 거절 뮤테이션 훅
 */
export function useRejectApplication() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: RejectApplicationInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return rejectApplication(input, user.uid);
    },
    onSuccess: () => {
      logger.info('지원 거절 완료');
      addToast({
        type: 'success',
        message: '지원이 거절되었습니다.',
      });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
    },
    onError: (error) => {
      logger.error('지원 거절 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '거절에 실패했습니다.',
      });
    },
  });
}

/**
 * 일괄 확정 뮤테이션 훅
 */
export function useBulkConfirmApplications() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (applicationIds: string[]) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return bulkConfirmApplications(applicationIds, user.uid);
    },
    onSuccess: (result) => {
      logger.info('일괄 확정 완료', {
        success: result.successCount,
        failed: result.failedCount,
      });

      if (result.successCount > 0) {
        addToast({
          type: 'success',
          message: `${result.successCount}명이 확정되었습니다.`,
        });
      }

      if (result.failedCount > 0) {
        addToast({
          type: 'warning',
          message: `${result.failedCount}명 확정에 실패했습니다.`,
        });
      }

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: (error) => {
      logger.error('일괄 확정 실패', error as Error);
      addToast({
        type: 'error',
        message: '일괄 확정에 실패했습니다.',
      });
    },
  });
}

// ============================================================================
// 대기열 관리 훅
// ============================================================================

/**
 * 대기열 추가 뮤테이션 훅
 */
export function useAddToWaitlist() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (applicationId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return addToWaitlist(applicationId, user.uid);
    },
    onSuccess: () => {
      logger.info('대기열 추가 완료');
      addToast({
        type: 'success',
        message: '대기열에 추가되었습니다.',
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
    },
    onError: (error) => {
      logger.error('대기열 추가 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '대기열 추가에 실패했습니다.',
      });
    },
  });
}

/**
 * 대기열 승격 뮤테이션 훅
 */
export function usePromoteFromWaitlist() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (applicationId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return promoteFromWaitlist(applicationId, user.uid);
    },
    onSuccess: (result) => {
      logger.info('대기열 승격 완료', { workLogId: result.workLogId });
      addToast({
        type: 'success',
        message: '대기열에서 확정되었습니다.',
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
    },
    onError: (error) => {
      logger.error('대기열 승격 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '승격에 실패했습니다.',
      });
    },
  });
}

// ============================================================================
// 유틸리티 훅
// ============================================================================

/**
 * 지원서 읽음 처리 뮤테이션 훅
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (applicationId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return markApplicationAsRead(applicationId, user.uid);
    },
    onSuccess: () => {
      logger.debug('지원서 읽음 처리 완료');
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
    },
    onError: (error) => {
      logger.error('지원서 읽음 처리 실패', error as Error);
    },
  });
}

// ============================================================================
// 취소 요청 관리 훅
// ============================================================================

/**
 * 공고별 취소 요청 조회 훅
 */
export function useCancellationRequests(jobPostingId: string) {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.applicantManagement.cancellationRequests(jobPostingId),
    queryFn: () => getCancellationRequests(jobPostingId, user!.uid),
    enabled: !!user && !!jobPostingId,
    staleTime: cachingPolicies.frequent,
  });
}

interface ReviewCancellationInput {
  applicationId: string;
  approved: boolean;
  rejectionReason?: string;
}

/**
 * 취소 요청 검토 뮤테이션 훅
 */
export function useReviewCancellation() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ReviewCancellationInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return reviewCancellationRequest(
        { applicationId: input.applicationId, approved: input.approved, rejectionReason: input.rejectionReason },
        user.uid
      );
    },
    onSuccess: (_, variables) => {
      const action = variables.approved ? '승인' : '거절';
      logger.info(`취소 요청 ${action} 완료`, { applicationId: variables.applicationId });
      addToast({
        type: 'success',
        message: `취소 요청이 ${action}되었습니다.`,
      });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
    },
    onError: (error) => {
      logger.error('취소 요청 검토 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '취소 요청 검토에 실패했습니다.',
      });
    },
  });
}

// ============================================================================
// v2.0 히스토리 기반 확정/취소 훅
// ============================================================================

interface ConfirmWithHistoryInput {
  applicationId: string;
  selectedAssignments?: Assignment[];
  notes?: string;
}

/**
 * v2.0 지원 확정 뮤테이션 훅 (히스토리 기록 포함)
 */
export function useConfirmApplicationWithHistory() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ConfirmWithHistoryInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return confirmApplicationWithHistory(
        input.applicationId,
        input.selectedAssignments,
        user.uid,
        input.notes
      );
    },
    onSuccess: (result) => {
      logger.info('지원 확정 (v2.0) 완료', {
        applicationId: result.applicationId,
        workLogIds: result.workLogIds,
      });
      addToast({
        type: 'success',
        message: result.message,
      });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workLogs.all,
      });
    },
    onError: (error) => {
      logger.error('지원 확정 (v2.0) 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '확정에 실패했습니다.',
      });
    },
  });
}

/**
 * 확정 취소 뮤테이션 훅
 */
export function useCancelConfirmation() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason?: string }) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return cancelConfirmation(applicationId, user.uid, reason);
    },
    onSuccess: (result) => {
      logger.info('확정 취소 완료', { applicationId: result.applicationId });
      addToast({
        type: 'success',
        message: '확정이 취소되었습니다.',
      });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.all,
      });
    },
    onError: (error) => {
      logger.error('확정 취소 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '확정 취소에 실패했습니다.',
      });
    },
  });
}

// ============================================================================
// 스태프 변환 훅
// ============================================================================

interface ConvertToStaffInput {
  applicationId: string;
  eventId: string;
  notes?: string;
}

/**
 * 지원자 → 스태프 변환 뮤테이션 훅
 */
export function useConvertToStaff() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ConvertToStaffInput) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return convertApplicantToStaff(
        input.applicationId,
        input.eventId,
        user.uid,
        { notes: input.notes }
      );
    },
    onSuccess: (result) => {
      logger.info('스태프 변환 완료', {
        applicationId: result.applicationId,
        staffId: result.staffId,
        isNewStaff: result.isNewStaff,
      });
      addToast({
        type: 'success',
        message: result.message,
      });

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workLogs.all,
      });
    },
    onError: (error) => {
      logger.error('스태프 변환 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '스태프 변환에 실패했습니다.',
      });
    },
  });
}

/**
 * 일괄 스태프 변환 뮤테이션 훅
 */
export function useBatchConvertToStaff() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({ applicationIds, eventId }: { applicationIds: string[]; eventId: string }) => {
      if (!user) {
        throw new Error('로그인이 필요합니다');
      }
      return batchConvertApplicants(applicationIds, eventId, user.uid);
    },
    onSuccess: (result) => {
      logger.info('일괄 스태프 변환 완료', {
        success: result.successCount,
        failed: result.failedCount,
      });

      if (result.successCount > 0) {
        addToast({
          type: 'success',
          message: `${result.successCount}명이 스태프로 변환되었습니다.`,
        });
      }

      if (result.failedCount > 0) {
        addToast({
          type: 'warning',
          message: `${result.failedCount}명 변환에 실패했습니다.`,
        });
      }

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workLogs.all,
      });
    },
    onError: (error) => {
      logger.error('일괄 스태프 변환 실패', error as Error);
      addToast({
        type: 'error',
        message: '일괄 변환에 실패했습니다.',
      });
    },
  });
}

/**
 * 스태프 변환 가능 여부 확인 훅
 */
export function useCanConvertToStaff(applicationId: string) {
  return useQuery({
    queryKey: ['canConvertToStaff', applicationId],
    queryFn: () => canConvertToStaff(applicationId),
    enabled: !!applicationId,
    staleTime: cachingPolicies.standard,
  });
}

// ============================================================================
// 통합 훅
// ============================================================================

/**
 * 지원자 관리 통합 훅 (구인자)
 *
 * @description 특정 공고의 지원자 관리에 필요한 모든 기능 제공
 */
export function useApplicantManagement(jobPostingId: string) {
  const applicantsQuery = useApplicantsByJobPosting(jobPostingId);
  const statsQuery = useApplicantStats(jobPostingId);

  const confirmMutation = useConfirmApplication();
  const rejectMutation = useRejectApplication();
  const bulkConfirmMutation = useBulkConfirmApplications();
  const addToWaitlistMutation = useAddToWaitlist();
  const promoteFromWaitlistMutation = usePromoteFromWaitlist();
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
      result = result.filter((a) => a.appliedRole === filters.role);
    }

    if (filters.sortBy) {
      result = result.sort((a, b) => {
        let comparison = 0;
        switch (filters.sortBy) {
          case 'appliedAt': {
            const aTime = a.createdAt
              ? (typeof a.createdAt === 'string' ? new Date(a.createdAt) : a.createdAt instanceof Date ? a.createdAt : a.createdAt.toDate()).getTime()
              : 0;
            const bTime = b.createdAt
              ? (typeof b.createdAt === 'string' ? new Date(b.createdAt) : b.createdAt instanceof Date ? b.createdAt : b.createdAt.toDate()).getTime()
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

    // 통계 (ApplicantListResult에서도 stats 제공)
    stats: applicantsQuery.data?.stats ?? statsQuery.data,
    isLoadingStats: statsQuery.isLoading,

    // 확정/거절
    confirmApplication: confirmMutation.mutate,
    confirmApplicationAsync: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,

    rejectApplication: rejectMutation.mutate,
    rejectApplicationAsync: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,

    bulkConfirm: bulkConfirmMutation.mutate,
    isBulkConfirming: bulkConfirmMutation.isPending,

    // 대기열
    addToWaitlist: addToWaitlistMutation.mutate,
    isAddingToWaitlist: addToWaitlistMutation.isPending,

    promoteFromWaitlist: promoteFromWaitlistMutation.mutate,
    isPromoting: promoteFromWaitlistMutation.isPending,

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
    waitlistCount: countByStatus('waitlisted'),
    completedCount: countByStatus('completed'),
    cancellationPendingCount: countByStatus('cancellation_pending'),
  };
}

export default useApplicantManagement;
