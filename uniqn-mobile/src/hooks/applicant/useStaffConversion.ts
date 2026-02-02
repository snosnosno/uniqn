/**
 * UNIQN Mobile - 스태프 변환 및 히스토리 기반 확정/취소 훅
 *
 * @description v2.0 히스토리 기반 확정, 확정 취소, 스태프 변환
 * @version 1.0.0
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  confirmApplicationWithHistory,
  cancelConfirmation,
} from '@/services/applicationHistoryService';
import {
  convertApplicantToStaff,
  batchConvertApplicants,
  canConvertToStaff,
} from '@/services/applicantConversionService';
import { queryKeys, cachingPolicies, invalidateRelated } from '@/lib';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { errorHandlerPresets, createMutationErrorHandler } from '@/shared/errors';
import { requireAuth } from '@/errors/guardErrors';
import type { Assignment } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ConfirmWithHistoryInput {
  applicationId: string;
  selectedAssignments?: Assignment[];
  notes?: string;
}

interface ConvertToStaffInput {
  applicationId: string;
  jobPostingId: string;
  notes?: string;
}

// ============================================================================
// v2.0 히스토리 기반 확정/취소 훅
// ============================================================================

/**
 * v2.0 지원 확정 뮤테이션 훅 (히스토리 기록 포함)
 */
export function useConfirmApplicationWithHistory() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ConfirmWithHistoryInput) => {
      requireAuth(user?.uid, 'useStaffConversion');
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

      // 이벤트 기반 캐시 무효화
      invalidateRelated('applicant.confirm');
    },
    onError: errorHandlerPresets.confirm(addToast),
  });
}

/**
 * 확정 취소 뮤테이션 훅
 */
export function useCancelConfirmation() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason?: string }) => {
      requireAuth(user?.uid, 'useStaffConversion');
      return cancelConfirmation(applicationId, user.uid, reason);
    },
    onSuccess: (result) => {
      logger.info('확정 취소 완료', { applicationId: result.applicationId });
      addToast({
        type: 'success',
        message: '확정이 취소되었습니다.',
      });

      // 이벤트 기반 캐시 무효화
      invalidateRelated('applicant.reviewCancellation');
    },
    onError: errorHandlerPresets.cancel(addToast),
  });
}

// ============================================================================
// 스태프 변환 훅
// ============================================================================

/**
 * 지원자 → 스태프 변환 뮤테이션 훅
 */
export function useConvertToStaff() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ConvertToStaffInput) => {
      requireAuth(user?.uid, 'useStaffConversion');
      return convertApplicantToStaff(input.applicationId, input.jobPostingId, user.uid, {
        notes: input.notes,
      });
    },
    onSuccess: (result, variables) => {
      logger.info('스태프 변환 완료', {
        applicationId: result.applicationId,
        staffId: result.staffId,
        isNewStaff: result.isNewStaff,
      });
      addToast({
        type: 'success',
        message: result.message,
      });

      // 이벤트 기반 캐시 무효화 (확정과 동일한 효과)
      invalidateRelated('applicant.confirm', { jobPostingId: variables.jobPostingId });
    },
    onError: createMutationErrorHandler('스태프 변환', addToast),
  });
}

/**
 * 일괄 스태프 변환 뮤테이션 훅
 */
export function useBatchConvertToStaff() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({
      applicationIds,
      jobPostingId,
    }: {
      applicationIds: string[];
      jobPostingId: string;
    }) => {
      requireAuth(user?.uid, 'useStaffConversion');
      return batchConvertApplicants(applicationIds, jobPostingId, user.uid);
    },
    onSuccess: (result, variables) => {
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

      // 이벤트 기반 캐시 무효화
      invalidateRelated('applicant.bulkConfirm', { jobPostingId: variables.jobPostingId });
    },
    onError: createMutationErrorHandler('일괄 스태프 변환', addToast),
  });
}

/**
 * 스태프 변환 가능 여부 확인 훅
 */
export function useCanConvertToStaff(applicationId: string) {
  return useQuery({
    queryKey: queryKeys.applicantManagement.canConvertToStaff(applicationId),
    queryFn: () => canConvertToStaff(applicationId),
    enabled: !!applicationId,
    staleTime: cachingPolicies.standard,
  });
}
