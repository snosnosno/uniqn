import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { handleTriggerError } from '../errors';
import { createAndSendNotification } from '../utils/notificationUtils';
import { extractUserId, formatTime } from '../utils/helpers';
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
}

interface WorkLogData {
  staffId: string;
  jobPostingId: string;
  date?: string;
  timeSlot?: string;
  checkInTime?: admin.firestore.Timestamp | string | null;
  checkOutTime?: admin.firestore.Timestamp | string | null;
}

interface TimeModificationLogData {
  workLogId?: string;
  previousStartTime?: admin.firestore.Timestamp | string | null;
  previousEndTime?: admin.firestore.Timestamp | string | null;
  newStartTime?: admin.firestore.Timestamp | string | null;
  newEndTime?: admin.firestore.Timestamp | string | null;
}

export const onWorkTimeChanged = onDocumentCreated(
  {
    document: 'workLogs/{workLogId}/timeModificationLogs/{logId}',
    region: 'asia-northeast3',
  },
  async (event) => {
    const workLogId = event.params.workLogId;
    const modification = event.data?.data() as TimeModificationLogData | undefined;

    if (!modification) {
      return;
    }

    const startChanged =
      formatTime(modification.previousStartTime) !== formatTime(modification.newStartTime);
    const endChanged =
      formatTime(modification.previousEndTime) !== formatTime(modification.newEndTime);

    if (!startChanged && !endChanged) {
      return;
    }

    try {
      const workLogDoc = await db.collection('workLogs').doc(workLogId).get();
      if (!workLogDoc.exists) {
        logger.warn('WorkLog not found for work time change notification', { workLogId });
        return;
      }

      const workLog = workLogDoc.data() as WorkLogData;
      const jobPostingDoc = await db.collection('jobPostings').doc(workLog.jobPostingId).get();
      if (!jobPostingDoc.exists) {
        logger.warn('Job posting not found for work time change notification', {
          workLogId,
          jobPostingId: workLog.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;
      const recipientId = extractUserId(workLog.staffId);
      const changes: string[] = [];

      if (startChanged) {
        changes.push(
          `start ${formatTime(modification.previousStartTime)} -> ${formatTime(modification.newStartTime)}`
        );
      }

      if (endChanged) {
        changes.push(
          `end ${formatTime(modification.previousEndTime)} -> ${formatTime(modification.newEndTime)}`
        );
      }

      const result = await createAndSendNotification(
        recipientId,
        'schedule_change',
        'Work time updated',
        `${jobPosting.title ? `'${jobPosting.title}'` : 'This shift'} was updated: ${changes.join(', ')}`,
        {
          link: '/schedule',
          priority: 'high',
          relatedId: workLogId,
          senderId: jobPosting.ownerId,
          channelId: 'reminders',
          data: {
            workLogId,
            jobPostingId: workLog.jobPostingId,
            jobPostingTitle: jobPosting.title ?? '',
            date: workLog.date ?? '',
            timeSlot: workLog.timeSlot ?? '',
            checkInTime: formatTime(workLog.checkInTime ?? modification.newStartTime),
            checkOutTime: formatTime(workLog.checkOutTime ?? modification.newEndTime),
            location: formatJobPostingLocation(jobPosting.location),
            district: getJobPostingDistrict(jobPosting.location),
          },
        }
      );

      logger.info('Sent work time changed notification', {
        workLogId,
        notificationId: result.notificationId,
      });
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: 'onWorkTimeChanged',
        context: { workLogId },
      });
    }
  }
);
