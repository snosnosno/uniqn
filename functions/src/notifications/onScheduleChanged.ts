import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createAndSendNotification } from '../utils/notificationUtils';
import { extractUserId } from '../utils/helpers';
import {
  formatJobPostingLocation,
  getJobPostingDistrict,
  type JobPostingLocationInput,
} from '../utils/jobPosting';

const db = admin.firestore();

interface JobPostingData {
  title?: string;
  location?: JobPostingLocationInput;
  ownerId?: string;
  createdBy?: string;
}

interface WorkLogData {
  staffId: string;
  jobPostingId: string;
  date?: string;
  role?: string;
  status?: string;
  timeSlot?: string;
}

function getJobLabel(title?: string): string {
  return title ? `'${title}'` : '해당';
}

export const onScheduleCreated = onDocumentCreated(
  { document: 'workLogs/{workLogId}', region: 'asia-northeast3' },
  async (event) => {
    const workLogId = event.params.workLogId;
    const workLog = event.data?.data() as WorkLogData | undefined;

    if (!workLog) {
      return;
    }

    try {
      const jobPostingDoc = await db.collection('jobPostings').doc(workLog.jobPostingId).get();
      if (!jobPostingDoc.exists) {
        logger.warn('Job posting not found for schedule created notification', {
          workLogId,
          jobPostingId: workLog.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;
      const recipientId = extractUserId(workLog.staffId);
      const title = '새 근무 배정';
      const when = `${workLog.date ?? '예정된 일정'}${workLog.timeSlot ? ` (${workLog.timeSlot})` : ''}`;
      const body = `${getJobLabel(jobPosting.title)} 근무가 ${when}에 배정되었습니다.`;

      const result = await createAndSendNotification(
        recipientId,
        'schedule_created',
        title,
        body,
        {
          link: '/schedule',
          priority: 'high',
          relatedId: workLogId,
          senderId: jobPosting.ownerId ?? jobPosting.createdBy,
          data: {
            workLogId,
            jobPostingId: workLog.jobPostingId,
            jobPostingTitle: jobPosting.title ?? '',
            date: workLog.date ?? '',
            role: workLog.role ?? '',
            timeSlot: workLog.timeSlot ?? '',
            location: formatJobPostingLocation(jobPosting.location),
            district: getJobPostingDistrict(jobPosting.location),
          },
        }
      );

      logger.info('Sent schedule created notification', {
        workLogId,
        notificationId: result.notificationId,
      });
    } catch (error: unknown) {
      logger.error('Failed to handle schedule created notification', {
        workLogId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export const onScheduleCancelled = onDocumentUpdated(
  { document: 'workLogs/{workLogId}', region: 'asia-northeast3' },
  async (event) => {
    const workLogId = event.params.workLogId;
    const before = event.data?.before.data() as WorkLogData | undefined;
    const after = event.data?.after.data() as WorkLogData | undefined;

    if (!before || !after) {
      return;
    }

    if (before.status === after.status || after.status !== 'cancelled') {
      return;
    }

    try {
      const jobPostingDoc = await db.collection('jobPostings').doc(after.jobPostingId).get();
      if (!jobPostingDoc.exists) {
        logger.warn('Job posting not found for schedule cancelled notification', {
          workLogId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;
      const recipientId = extractUserId(after.staffId);
      const title = '근무 취소';
      const when = `${after.date ?? ''}${after.timeSlot ? ` (${after.timeSlot})` : ''}`.trim();
      const body = when
        ? `${getJobLabel(jobPosting.title)} ${when} 근무가 취소되었습니다.`
        : `${getJobLabel(jobPosting.title)} 근무가 취소되었습니다.`;

      const result = await createAndSendNotification(
        recipientId,
        'schedule_cancelled',
        title,
        body,
        {
          link: '/schedule',
          priority: 'high',
          relatedId: workLogId,
          senderId: jobPosting.ownerId ?? jobPosting.createdBy,
          data: {
            workLogId,
            jobPostingId: after.jobPostingId,
            jobPostingTitle: jobPosting.title ?? '',
            date: after.date ?? '',
            role: after.role ?? '',
            timeSlot: after.timeSlot ?? '',
          },
        }
      );

      logger.info('Sent schedule cancelled notification', {
        workLogId,
        notificationId: result.notificationId,
      });
    } catch (error: unknown) {
      logger.error('Failed to handle schedule cancelled notification', {
        workLogId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);
