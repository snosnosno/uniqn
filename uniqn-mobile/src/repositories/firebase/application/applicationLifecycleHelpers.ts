import {
  doc,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Transaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { updatePostingScheduleFilled } from '@/domains/application';
import {
  transitionPostingAggregateStats,
  normalizePostingAggregateStats,
} from '@/domains/job-posting';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import {
  addCancellationToEntry,
  findActiveConfirmation,
  type Application,
  type JobPosting,
} from '@/types';
import { COLLECTIONS, STATUS } from '@/constants';
import { BusinessError, ERROR_CODES } from '@/errors';

function countAssignmentDates(assignments: Application['assignments'] = []): number {
  return assignments.reduce((sum, assignment) => sum + assignment.dates.length, 0);
}

async function loadRelatedWorkLogs(
  transaction: Transaction,
  workLogIds: string[]
): Promise<
  {
    ref: DocumentReference<DocumentData>;
    data: Record<string, unknown> | undefined;
    exists: boolean;
  }[]
> {
  const snapshots: {
    ref: DocumentReference<DocumentData>;
    data: Record<string, unknown> | undefined;
    exists: boolean;
  }[] = [];

  for (const workLogId of workLogIds) {
    const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);
    const workLogSnap = await transaction.get(workLogRef);
    snapshots.push({
      ref: workLogRef,
      data: workLogSnap.exists() ? (workLogSnap.data() as Record<string, unknown>) : undefined,
      exists: workLogSnap.exists(),
    });
  }

  return snapshots;
}

export async function releaseConfirmedAssignmentsInTransaction(params: {
  transaction: Transaction;
  applicationRef: DocumentReference<DocumentData>;
  applicationData: Application;
  jobRef: DocumentReference<DocumentData>;
  jobData: JobPosting;
  relatedWorkLogIds: string[];
  ownerId: string;
  nextApplicationStatus: Application['status'];
  cancelReason?: string;
  cancellationRequest?: unknown;
}): Promise<{
  cancelledAt: Timestamp;
  nextApplicationStatus: Application['status'];
}> {
  const {
    transaction,
    applicationRef,
    applicationData,
    jobRef,
    jobData,
    relatedWorkLogIds,
    ownerId,
    nextApplicationStatus,
    cancelReason,
    cancellationRequest,
  } = params;

  const confirmationHistory = applicationData.confirmationHistory ?? [];
  const activeConfirmation = findActiveConfirmation(confirmationHistory);

  if (!activeConfirmation) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '취소할 확정 이력이 없습니다.',
    });
  }

  const activeIndex = confirmationHistory.findIndex((entry) => !entry.cancelledAt);
  const updatedHistory = confirmationHistory.map((entry, index) => {
    if (index === activeIndex) {
      return addCancellationToEntry(entry, cancelReason, ownerId);
    }
    return entry;
  });

  const cancelledAssignments = activeConfirmation.assignments;
  const decrementCount = countAssignmentDates(cancelledAssignments);
  const updatedSchedule = updatePostingScheduleFilled(
    jobData.schedule,
    cancelledAssignments,
    'decrement'
  );

  const { total: totalPositions, filled: currentFilled } = getClosingStatus(jobData);
  const newFilledPositions = Math.max(0, currentFilled - decrementCount);
  const shouldReopen =
    jobData.status === STATUS.JOB_POSTING.CLOSED && newFilledPositions < totalPositions;

  const nextStats = transitionPostingAggregateStats(
    normalizePostingAggregateStats(jobData.stats, jobData.schedule),
    {
      fromStatus: applicationData.status,
      toStatus: nextApplicationStatus,
      filledPositionsDelta: -decrementCount,
    }
  );

  const workLogSnapshots = await loadRelatedWorkLogs(transaction, relatedWorkLogIds);

  const jobUpdateData: Record<string, unknown> = {
    filledPositions: newFilledPositions,
    schedule: updatedSchedule,
    stats: {
      ...nextStats,
      filledPositions: newFilledPositions,
    },
    updatedAt: serverTimestamp(),
  };

  if (shouldReopen) {
    jobUpdateData.status = STATUS.JOB_POSTING.ACTIVE;
  }

  transaction.update(jobRef, jobUpdateData);

  const restoredAssignments =
    nextApplicationStatus === STATUS.APPLICATION.APPLIED
      ? (applicationData.originalApplication?.assignments ?? applicationData.assignments)
      : applicationData.assignments;

  transaction.update(applicationRef, {
    status: nextApplicationStatus,
    assignments: restoredAssignments,
    confirmationHistory: updatedHistory,
    ...(cancellationRequest ? { cancellationRequest } : {}),
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const snapshot of workLogSnapshots) {
    if (snapshot.exists && snapshot.data?.status === STATUS.WORK_LOG.SCHEDULED) {
      transaction.update(snapshot.ref, {
        status: STATUS.WORK_LOG.CANCELLED,
        updatedAt: serverTimestamp(),
      });
    }
  }

  return {
    cancelledAt: Timestamp.now(),
    nextApplicationStatus,
  };
}
