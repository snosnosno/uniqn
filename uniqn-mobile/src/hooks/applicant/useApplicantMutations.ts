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
import { errorHandlerPresets, createMutationErrorHandler } from '@/shared/errors';
import { requireAuth } from '@/errors/guardErrors';
import { ERROR_CODES } from '@/errors';
import type { ConfirmApplicationInput, RejectApplicationInput } from '@/types';

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
      requireAuth(user?.uid, 'useApplicantMutations');
      return confirmApplication(input, user.uid);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applicantManagement.all });
      const previousData = queryClient.getQueriesData({
        queryKey: queryKeys.applicantManagement.all,
      });

      queryClient.setQueriesData(
        { queryKey: queryKeys.applicantManagement.all },
        (old: unknown) => {
          if (!old || typeof old !== 'object' || !('applicants' in old)) return old;
          const data = old as { applicants: Record<string, unknown>[] };
          return {
            ...data,
            applicants: data.applicants.map((a) =>
              a.applicationId === input.applicationId ? { ...a, status: 'confirmed' } : a
            ),
          };
        }
      );

      return { previousData };
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
    onError: createMutationErrorHandler('확정 처리', addToast, {
      customMessages: {
        [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '이미 확정된 지원입니다.',
        [ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED]: '모집 인원이 마감되었습니다.',
      },
      onRollback: (ctx) => {
        const { previousData } = ctx as { previousData: [readonly unknown[], unknown][] };
        previousData?.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    }),
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
      requireAuth(user?.uid, 'useApplicantMutations');
      return rejectApplication(input, user.uid);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applicantManagement.all });
      const previousData = queryClient.getQueriesData({
        queryKey: queryKeys.applicantManagement.all,
      });

      queryClient.setQueriesData(
        { queryKey: queryKeys.applicantManagement.all },
        (old: unknown) => {
          if (!old || typeof old !== 'object' || !('applicants' in old)) return old;
          const data = old as { applicants: Record<string, unknown>[] };
          return {
            ...data,
            applicants: data.applicants.map((a) =>
              a.applicationId === input.applicationId ? { ...a, status: 'rejected' } : a
            ),
          };
        }
      );

      return { previousData };
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
    onError: createMutationErrorHandler('거절 처리', addToast, {
      customMessages: {
        [ERROR_CODES.BUSINESS_INVALID_STATE]: '이미 처리된 지원입니다.',
      },
      onRollback: (ctx) => {
        const { previousData } = ctx as { previousData: [readonly unknown[], unknown][] };
        previousData?.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    }),
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
      requireAuth(user?.uid, 'useApplicantMutations');
      return bulkConfirmApplications(applicationIds, user.uid);
    },
    onMutate: async (applicationIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applicantManagement.all });
      const previousData = queryClient.getQueriesData({
        queryKey: queryKeys.applicantManagement.all,
      });

      queryClient.setQueriesData(
        { queryKey: queryKeys.applicantManagement.all },
        (old: unknown) => {
          if (!old || typeof old !== 'object' || !('applicants' in old)) return old;
          const data = old as { applicants: Record<string, unknown>[] };
          return {
            ...data,
            applicants: data.applicants.map((a) =>
              applicationIds.includes(a.applicationId as string) ? { ...a, status: 'confirmed' } : a
            ),
          };
        }
      );

      return { previousData };
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
    onError: createMutationErrorHandler('확정 처리', addToast, {
      customMessages: {
        [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '이미 확정된 지원입니다.',
        [ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED]: '모집 인원이 마감되었습니다.',
      },
      onRollback: (ctx) => {
        const { previousData } = ctx as { previousData: [readonly unknown[], unknown][] };
        previousData?.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    }),
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
