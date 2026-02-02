/**
 * UNIQN Mobile - 지원자 확정/거절 뮤테이션 훅
 *
 * @description 지원 확정, 거절, 일괄 확정, 읽음 처리
 * @version 1.0.0
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  confirmApplication,
  rejectApplication,
  bulkConfirmApplications,
  markApplicationAsRead,
} from '@/services';
import { queryKeys, invalidateRelated } from '@/lib';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { errorHandlerPresets } from '@/shared/errors';
import { requireAuth } from '@/errors/guardErrors';
import type { ConfirmApplicationInput, RejectApplicationInput } from '@/types';

// ============================================================================
// 지원자 확정/거절 훅
// ============================================================================

/**
 * 지원 확정 뮤테이션 훅
 */
export function useConfirmApplication() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: ConfirmApplicationInput) => {
      requireAuth(user?.uid, 'useApplicantMutations');
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

      // 이벤트 기반 캐시 무효화
      invalidateRelated('applicant.confirm');
    },
    onError: errorHandlerPresets.confirm(addToast),
  });
}

/**
 * 지원 거절 뮤테이션 훅
 */
export function useRejectApplication() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (input: RejectApplicationInput) => {
      requireAuth(user?.uid, 'useApplicantMutations');
      return rejectApplication(input, user.uid);
    },
    onSuccess: (_, variables) => {
      logger.info('지원 거절 완료', { applicationId: variables.applicationId });
      addToast({
        type: 'success',
        message: '지원이 거절되었습니다.',
      });

      // 이벤트 기반 캐시 무효화
      invalidateRelated('applicant.reject');
    },
    onError: errorHandlerPresets.reject(addToast),
  });
}

/**
 * 일괄 확정 뮤테이션 훅
 */
export function useBulkConfirmApplications() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (applicationIds: string[]) => {
      requireAuth(user?.uid, 'useApplicantMutations');
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

      // 이벤트 기반 캐시 무효화
      invalidateRelated('applicant.bulkConfirm');
    },
    onError: errorHandlerPresets.confirm(addToast),
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
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: (applicationId: string) => {
      requireAuth(user?.uid, 'useApplicantMutations');
      return markApplicationAsRead(applicationId, user.uid);
    },
    onSuccess: () => {
      logger.debug('지원서 읽음 처리 완료');
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicantManagement.all,
      });
    },
    onError: errorHandlerPresets.notification(addToast), // 사일런트 에러 처리
  });
}
