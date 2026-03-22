import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { handleTriggerError } from '../errors';
import { createAndSendNotification } from '../utils/notificationUtils';
import { extractUserId } from '../utils/helpers';

const db = admin.firestore();

interface JobPostingData {
  title?: string;
  ownerId?: string;
  createdBy?: string;
}

interface UserData {
  name?: string;
  nickname?: string;
}

interface WorkLogData {
  staffId: string;
  jobPostingId: string;
  date?: string;
  noShowAt?: admin.firestore.Timestamp | string | null;
}

export const onNoShow = onDocumentUpdated(
  { document: 'workLogs/{workLogId}', region: 'asia-northeast3' },
  async (event) => {
    const workLogId = event.params.workLogId;
    const before = event.data?.before.data() as WorkLogData | undefined;
    const after = event.data?.after.data() as WorkLogData | undefined;

    if (!before || !after) {
      return;
    }

    if (Boolean(before.noShowAt) || !Boolean(after.noShowAt)) {
      return;
    }

    try {
      const jobPostingDoc = await db.collection('jobPostings').doc(after.jobPostingId).get();
      if (!jobPostingDoc.exists) {
        logger.warn('Job posting not found for no-show notification', {
          workLogId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;
      const employerId = jobPosting.ownerId ?? jobPosting.createdBy;
      if (!employerId) {
        logger.warn('Employer not found for no-show notification', {
          workLogId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const staffUserId = extractUserId(after.staffId);
      const staffDoc = await db.collection('users').doc(staffUserId).get();
      const staffData = (staffDoc.data() as UserData | undefined) ?? {};
      const staffName = staffData.nickname ?? staffData.name ?? 'Staff';

      const result = await createAndSendNotification(
        employerId,
        'no_show_alert',
        'No-show alert',
        `${staffName} was marked as no-show${jobPosting.title ? ` for '${jobPosting.title}'` : ''}.`,
        {
          link: `/employer/applicants/${after.jobPostingId}`,
          priority: 'urgent',
          relatedId: workLogId,
          senderId: staffUserId,
          data: {
            workLogId,
            jobPostingId: after.jobPostingId,
            jobPostingTitle: jobPosting.title ?? '',
            staffId: after.staffId,
            staffName,
            date: after.date ?? '',
          },
        }
      );

      logger.info('Sent no-show notification', {
        workLogId,
        notificationId: result.notificationId,
      });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: 'onNoShow',
        context: { workLogId, staffId: after.staffId },
      });
    }
  }
);
