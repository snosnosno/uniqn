import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { handleTriggerError } from '../errors';
import { createAndSendNotification } from '../utils/notificationUtils';
import { formatJobPostingLocation, type JobPostingLocationInput } from '../utils/jobPosting';

const db = admin.firestore();

interface CancellationRequestData {
  status?: 'pending' | 'approved' | 'rejected';
  reason?: string;
  rejectionReason?: string;
}

interface ApplicationData {
  applicantId: string;
  jobPostingId: string;
  status: string;
  cancellationRequest?: CancellationRequestData;
}

interface JobPostingData {
  title?: string;
  location?: JobPostingLocationInput;
  ownerId?: string;
  createdBy?: string;
}

function getJobLabel(title?: string): string {
  return title ? `'${title}'` : 'This job';
}

async function sendNotification(
  recipientId: string,
  type:
    | 'application_confirmed'
    | 'confirmation_cancelled'
    | 'application_rejected'
    | 'cancellation_approved'
    | 'cancellation_rejected',
  title: string,
  body: string,
  applicationId: string,
  application: ApplicationData,
  jobPosting: JobPostingData,
  data: Record<string, string> = {}
): Promise<void> {
  const result = await createAndSendNotification(recipientId, type, title, body, {
    link: '/schedule',
    priority: type === 'application_confirmed' || type === 'cancellation_rejected' ? 'high' : 'normal',
    relatedId: applicationId,
    senderId: jobPosting.ownerId ?? jobPosting.createdBy,
    data: {
      applicationId,
      jobPostingId: application.jobPostingId,
      jobPostingTitle: jobPosting.title ?? '',
      location: formatJobPostingLocation(jobPosting.location),
      ...data,
    },
  });

  logger.info('Sent application lifecycle notification', {
    applicationId,
    type,
    notificationId: result.notificationId,
  });
}

export const onApplicationStatusChanged = onDocumentUpdated(
  { document: 'applications/{applicationId}', region: 'asia-northeast3' },
  async (event) => {
    const applicationId = event.params.applicationId;
    const before = event.data?.before.data() as ApplicationData | undefined;
    const after = event.data?.after.data() as ApplicationData | undefined;

    if (!before || !after) {
      return;
    }

    const statusChanged = before.status !== after.status;
    const cancellationStatusChanged =
      before.cancellationRequest?.status !== after.cancellationRequest?.status;

    if (!statusChanged && !cancellationStatusChanged) {
      return;
    }

    try {
      const jobPostingDoc = await db.collection('jobPostings').doc(after.jobPostingId).get();
      if (!jobPostingDoc.exists) {
        logger.warn('Job posting not found for application notification', {
          applicationId,
          jobPostingId: after.jobPostingId,
        });
        return;
      }

      const jobPosting = jobPostingDoc.data() as JobPostingData;

      if (statusChanged && before.status === 'applied' && after.status === 'confirmed') {
        await sendNotification(
          after.applicantId,
          'application_confirmed',
          'Application confirmed',
          `${getJobLabel(jobPosting.title)} has been confirmed.`,
          applicationId,
          after,
          jobPosting
        );
      }

      if (
        statusChanged &&
        after.status === 'cancelled' &&
        after.cancellationRequest?.status !== 'approved'
      ) {
        await sendNotification(
          after.applicantId,
          'confirmation_cancelled',
          'Confirmation cancelled',
          `${getJobLabel(jobPosting.title)} was cancelled.`,
          applicationId,
          after,
          jobPosting
        );
      }

      if (statusChanged && after.status === 'rejected') {
        await sendNotification(
          after.applicantId,
          'application_rejected',
          'Application rejected',
          `${getJobLabel(jobPosting.title)} was rejected.`,
          applicationId,
          after,
          jobPosting
        );
      }

      if (cancellationStatusChanged && after.cancellationRequest?.status === 'approved') {
        await sendNotification(
          after.applicantId,
          'cancellation_approved',
          'Cancellation approved',
          `${getJobLabel(jobPosting.title)} cancellation was approved.`,
          applicationId,
          after,
          jobPosting
        );
      }

      if (cancellationStatusChanged && after.cancellationRequest?.status === 'rejected') {
        await sendNotification(
          after.applicantId,
          'cancellation_rejected',
          'Cancellation rejected',
          `${getJobLabel(jobPosting.title)} cancellation was rejected.`,
          applicationId,
          after,
          jobPosting,
          {
            rejectionReason: after.cancellationRequest?.rejectionReason ?? '',
          }
        );
      }
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: 'onApplicationStatusChanged',
        context: { applicationId, applicantId: after.applicantId },
      });
    }
  }
);
