import {
  doc,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Transaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import {
  updatePostingScheduleFilled,
  addCancellationToEntry,
  findActiveConfirmation,
} from '@/domains/application';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { normalizeAssignmentRole } from '@/types/assignment';
import { type Application, type Assignment, type JobPosting } from '@/types';
import { COLLECTIONS, STATUS } from '@/constants';
import { BusinessError, ERROR_CODES } from '@/errors';

type WorkLogSnapshot = {
  ref: DocumentReference<DocumentData>;
  data: Record<string, unknown> | undefined;
  exists: boolean;
};

type ExpectedWorkLog = {
  assignmentGroupId: string | null;
  customRole: string | null;
  date: string;
  role: string;
  timeSlot: string;
};

function countAssignmentDates(assignments: Application['assignments'] = []): number {
  return assignments.reduce((sum, assignment) => sum + assignment.dates.length, 0);
}

function getTimestampMillis(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  return 0;
}

function buildExpectedWorkLogs(assignments: Assignment[]): ExpectedWorkLog[] {
  return assignments.flatMap((assignment) => {
    const normalizedRole = normalizeAssignmentRole(assignment.roleIds[0]);

    return assignment.dates.map((date) => ({
      assignmentGroupId: assignment.groupId ?? null,
      customRole: normalizedRole.customRole ?? null,
      date,
      role: normalizedRole.role,
      timeSlot: assignment.timeSlot,
    }));
  });
}

function matchesExpectedWorkLog(snapshot: WorkLogSnapshot, expected: ExpectedWorkLog): boolean {
  if (!snapshot.exists || !snapshot.data) {
    return false;
  }

  return (
    snapshot.data.date === expected.date &&
    snapshot.data.timeSlot === expected.timeSlot &&
    snapshot.data.role === expected.role &&
    (snapshot.data.customRole ?? null) === expected.customRole &&
    (snapshot.data.assignmentGroupId ?? null) === expected.assignmentGroupId
  );
}

async function loadRelatedWorkLogs(
  transaction: Transaction,
  workLogIds: string[]
): Promise<WorkLogSnapshot[]> {
  const snapshots: WorkLogSnapshot[] = [];

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

function selectActiveConfirmationWorkLogs(
  workLogSnapshots: WorkLogSnapshot[],
  assignments: Assignment[]
): WorkLogSnapshot[] {
  const expectedWorkLogs = buildExpectedWorkLogs(assignments);
  const selected: WorkLogSnapshot[] = [];
  const consumedIds = new Set<string>();

  const sortedSnapshots = [...workLogSnapshots]
    .filter((snapshot) => snapshot.exists && snapshot.data)
    .sort((left, right) => {
      const leftCreatedAt = getTimestampMillis(left.data?.createdAt);
      const rightCreatedAt = getTimestampMillis(right.data?.createdAt);

      if (leftCreatedAt !== rightCreatedAt) {
        return rightCreatedAt - leftCreatedAt;
      }

      return getTimestampMillis(right.data?.updatedAt) - getTimestampMillis(left.data?.updatedAt);
    });

  for (const expected of expectedWorkLogs) {
    const match = sortedSnapshots.find((snapshot) => {
      if (consumedIds.has(snapshot.ref.id)) {
        return false;
      }

      return matchesExpectedWorkLog(snapshot, expected);
    });

    if (!match) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '활성 확정에 연결된 근무 기록을 찾을 수 없습니다.',
      });
    }

    consumedIds.add(match.ref.id);
    selected.push(match);
  }

  return selected;
}

function assertCancellableConfirmationWorkLogs(workLogs: WorkLogSnapshot[]): void {
  const nonCancellableWorkLog = workLogs.find(
    (snapshot) => snapshot.data?.status !== STATUS.WORK_LOG.SCHEDULED
  );

  if (nonCancellableWorkLog) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '이미 진행되었거나 종료된 확정은 전체 취소할 수 없습니다.',
    });
  }
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

  const workLogSnapshots = await loadRelatedWorkLogs(transaction, relatedWorkLogIds);
  const activeConfirmationWorkLogs = selectActiveConfirmationWorkLogs(
    workLogSnapshots,
    activeConfirmation.assignments
  );

  assertCancellableConfirmationWorkLogs(activeConfirmationWorkLogs);

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

  const jobUpdateData: Record<string, unknown> = {
    filledPositions: newFilledPositions,
    schedule: updatedSchedule,
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

  for (const snapshot of activeConfirmationWorkLogs) {
    transaction.update(snapshot.ref, {
      status: STATUS.WORK_LOG.CANCELLED,
      updatedAt: serverTimestamp(),
    });
  }

  return {
    cancelledAt: Timestamp.now(),
    nextApplicationStatus,
  };
}
