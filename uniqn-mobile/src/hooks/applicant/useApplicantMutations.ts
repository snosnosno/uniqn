/**
 * UNIQN Mobile - applicant mutation hooks
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ERROR_CODES } from '@/errors';
import { requireAuth } from '@/errors/guardErrors';
import { invalidateRelated, queryKeys } from '@/lib';
import { errorHandlerPresets, createMutationErrorHandler } from '@/shared/errors';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { ConfirmApplicationInput, RejectApplicationInput } from '@/types';
import { logger } from '@/utils/logger';
import { triggerBatchStart, triggerBatchEnd } from '@/utils/haptics';
import {
  bulkConfirmApplications,
  confirmApplication,
  markApplicationAsRead,
  rejectApplication,
} from '@/services';
import { findJobPostingIdForApplications } from './cacheContext';

function getApplicantCacheId(item: Record<string, unknown>): string | undefined {
  if (typeof item.id === 'string' && item.id.length > 0) {
    return item.id;
  }

  if (typeof item.applicationId === 'string' && item.applicationId.length > 0) {
    return item.applicationId;
  }

  return undefined;
}

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
          if (!old || typeof old !== 'object' || !('applicants' in old)) {
            return old;
          }

          const data = old as { applicants: Record<string, unknown>[] };
          return {
            ...data,
            applicants: data.applicants.map((applicant) =>
              getApplicantCacheId(applicant) === input.applicationId
                ? { ...applicant, status: 'confirmed' }
                : applicant
            ),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (result) => {
      const jobPostingId = findJobPostingIdForApplications(queryClient, [result.applicationId]);

      logger.info('지원자 확정 완료', {
        applicationId: result.applicationId,
        workLogId: result.workLogId,
      });
      addToast({
        type: 'success',
        message: '지원자가 확정되었습니다.',
      });

      invalidateRelated('applicant.confirm', jobPostingId ? { jobPostingId } : undefined);
    },
    onError: createMutationErrorHandler('확정 처리', addToast, {
      customMessages: {
        [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '이미 확정된 지원자입니다.',
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
          if (!old || typeof old !== 'object' || !('applicants' in old)) {
            return old;
          }

          const data = old as { applicants: Record<string, unknown>[] };
          return {
            ...data,
            applicants: data.applicants.map((applicant) =>
              getApplicantCacheId(applicant) === input.applicationId
                ? { ...applicant, status: 'rejected' }
                : applicant
            ),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (_, variables) => {
      const jobPostingId = findJobPostingIdForApplications(queryClient, [variables.applicationId]);

      logger.info('지원 거절 완료', { applicationId: variables.applicationId });
      addToast({
        type: 'success',
        message: '지원이 거절되었습니다.',
      });

      invalidateRelated('applicant.reject', jobPostingId ? { jobPostingId } : undefined);
    },
    onError: createMutationErrorHandler('거절 처리', addToast, {
      customMessages: {
        [ERROR_CODES.BUSINESS_INVALID_STATE]: '이미 처리된 지원자입니다.',
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
      // impeccable v2 §17 — 일괄 확정 시작 Light 햅틱(개별 Medium 대체)
      void triggerBatchStart();

      await queryClient.cancelQueries({ queryKey: queryKeys.applicantManagement.all });
      const previousData = queryClient.getQueriesData({
        queryKey: queryKeys.applicantManagement.all,
      });

      queryClient.setQueriesData(
        { queryKey: queryKeys.applicantManagement.all },
        (old: unknown) => {
          if (!old || typeof old !== 'object' || !('applicants' in old)) {
            return old;
          }

          const data = old as { applicants: Record<string, unknown>[] };
          return {
            ...data,
            applicants: data.applicants.map((applicant) =>
              applicationIds.includes(getApplicantCacheId(applicant) ?? '')
                ? { ...applicant, status: 'confirmed' }
                : applicant
            ),
          };
        }
      );

      return { previousData };
    },
    onSuccess: (result, variables) => {
      const jobPostingId = findJobPostingIdForApplications(queryClient, variables);

      logger.info('일괄 확정 완료', {
        success: result.successCount,
        failed: result.failedCount,
      });

      // §17 — 종료 햅틱. 실패 0이면 success, 일부라도 실패면 warning.
      void triggerBatchEnd(result.failedCount === 0);

      if (result.successCount > 0) {
        addToast({
          type: 'success',
          message: `${result.successCount}명이 확정되었습니다.`,
        });
      }

      if (result.failedCount > 0) {
        const capacityFull = result.failed.filter(
          (f) => f.code === ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED
        ).length;
        addToast({
          type: 'warning',
          message:
            capacityFull > 0
              ? `${result.failedCount}명 확정 실패 (정원 마감 ${capacityFull}명).`
              : `${result.failedCount}명 확정이 실패했습니다.`,
        });
      }

      invalidateRelated('applicant.bulkConfirm', jobPostingId ? { jobPostingId } : undefined);
    },
    onError: createMutationErrorHandler('확정 처리', addToast, {
      customMessages: {
        [ERROR_CODES.BUSINESS_ALREADY_APPLIED]: '이미 확정된 지원자입니다.',
        [ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED]: '모집 인원이 마감되었습니다.',
      },
      onRollback: (ctx) => {
        // §17 — 일괄 작업 전체 실패 시 warning 햅틱
        void triggerBatchEnd(false);
        const { previousData } = ctx as { previousData: [readonly unknown[], unknown][] };
        previousData?.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      },
    }),
  });
}

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
    onError: errorHandlerPresets.notification(addToast),
  });
}
