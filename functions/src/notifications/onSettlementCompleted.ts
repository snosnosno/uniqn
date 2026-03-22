import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { STATUS } from '../constants/status';
import { handleTriggerError } from '../errors';
import { createAndSendNotification } from '../utils/notificationUtils';
import { extractUserId } from '../utils/helpers';

const db = admin.firestore();

interface WorkLogData {
  staffId: string;
  jobPostingId: string;
  date?: string;
  payrollStatus?: string;
  payrollAmount?: number;
  payrollDate?: admin.firestore.Timestamp | null;
}

export const onSettlementCompleted = onDocumentUpdated(
  { document: 'workLogs/{workLogId}', region: 'asia-northeast3' },
  async (event) => {
    const workLogId = event.params.workLogId;
    const before = event.data?.before.data() as WorkLogData | undefined;
    const after = event.data?.after.data() as WorkLogData | undefined;

    if (!before || !after) {
      return;
    }

    if (
      before.payrollStatus === after.payrollStatus ||
      after.payrollStatus !== STATUS.PAYROLL.COMPLETED
    ) {
      return;
    }

    try {
      const recipientId = extractUserId(after.staffId);
      const jobPostingDoc = await db.collection('jobPostings').doc(after.jobPostingId).get();
      const jobPostingTitle = jobPostingDoc.exists ? jobPostingDoc.data()?.title ?? '' : '';
      const payrollAmount = after.payrollAmount ?? 0;
      const amountLabel = payrollAmount.toLocaleString('ko-KR');
      const body = jobPostingTitle
        ? `Settlement for '${jobPostingTitle}' is complete. (${amountLabel} KRW)`
        : `Settlement is complete. (${amountLabel} KRW)`;

      const result = await createAndSendNotification(
        recipientId,
        'settlement_completed',
        'Settlement completed',
        body,
        {
          link: '/schedule',
          priority: 'high',
          relatedId: workLogId,
          data: {
            workLogId,
            jobPostingId: after.jobPostingId,
            jobPostingTitle,
            date: after.date ?? '',
            payrollAmount: String(payrollAmount),
            payrollDate: after.payrollDate ? after.payrollDate.toDate().toISOString() : '',
          },
        }
      );

      logger.info('Sent settlement completed notification', {
        workLogId,
        notificationId: result.notificationId,
      });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: 'onSettlementCompleted',
        context: { workLogId, staffId: after.staffId },
      });
    }
  }
);
