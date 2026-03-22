/**
 * UNIQN Mobile - confirmationHistory lifecycle hooks
 *
 * @description Public applicant management lifecycle is limited to
 * confirm/cancel confirmation flows. Legacy applicant-to-staff conversion
 * hooks are intentionally not exported from the active surface.
 */

import { useMutation } from '@tanstack/react-query';
import {
  confirmApplicationWithHistory,
  cancelConfirmation,
} from '@/services/jobs/applicationHistoryService';
import { invalidateRelated } from '@/lib';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';
import { errorHandlerPresets } from '@/shared/errors';
import { requireAuth } from '@/errors/guardErrors';
import type { Assignment } from '@/types';

interface ConfirmWithHistoryInput {
  applicationId: string;
  selectedAssignments?: Assignment[];
  notes?: string;
}

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
      logger.info('Application confirmation (v2.0) completed', {
        applicationId: result.applicationId,
        workLogIds: result.workLogIds,
      });
      addToast({
        type: 'success',
        message: result.message,
      });

      invalidateRelated('applicant.confirm');
    },
    onError: errorHandlerPresets.confirm(addToast),
  });
}

export function useCancelConfirmation() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason?: string }) => {
      requireAuth(user?.uid, 'useStaffConversion');
      return cancelConfirmation(applicationId, user.uid, reason);
    },
    onSuccess: (result) => {
      logger.info('Confirmation cancel completed', { applicationId: result.applicationId });
      addToast({
        type: 'success',
        message: '확정을 취소했습니다.',
      });

      invalidateRelated('applicant.reviewCancellation');
    },
    onError: errorHandlerPresets.cancel(addToast),
  });
}
