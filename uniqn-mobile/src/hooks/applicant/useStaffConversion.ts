/**
 * UNIQN Mobile - confirmation history lifecycle hooks
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/errors/guardErrors';
import { invalidateRelated } from '@/lib';
import { errorHandlerPresets } from '@/shared/errors';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { Assignment } from '@/types';
import { logger } from '@/utils/logger';
import {
  cancelConfirmation,
  confirmApplicationWithHistory,
} from '@/services/jobs/applicationHistoryService';
import { findJobPostingIdForApplications } from './cacheContext';

interface ConfirmWithHistoryInput {
  applicationId: string;
  selectedAssignments?: Assignment[];
  notes?: string;
}

export function useConfirmApplicationWithHistory() {
  const queryClient = useQueryClient();
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
      const jobPostingId = findJobPostingIdForApplications(queryClient, [result.applicationId]);

      logger.info('Application confirmation (v2.0) completed', {
        applicationId: result.applicationId,
        workLogIds: result.workLogIds,
      });
      addToast({
        type: 'success',
        message: result.message,
      });

      invalidateRelated('applicant.confirm', jobPostingId ? { jobPostingId } : undefined);
    },
    onError: errorHandlerPresets.confirm(addToast),
  });
}

export function useCancelConfirmation() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason?: string }) => {
      requireAuth(user?.uid, 'useStaffConversion');
      return cancelConfirmation(applicationId, user.uid, reason);
    },
    onSuccess: (result) => {
      const jobPostingId = findJobPostingIdForApplications(queryClient, [result.applicationId]);

      logger.info('Confirmation cancel completed', { applicationId: result.applicationId });
      addToast({
        type: 'success',
        message: '확정이 취소되었습니다.',
      });

      invalidateRelated(
        'applicant.reviewCancellation',
        jobPostingId ? { jobPostingId } : undefined
      );
    },
    onError: errorHandlerPresets.cancel(addToast),
  });
}
