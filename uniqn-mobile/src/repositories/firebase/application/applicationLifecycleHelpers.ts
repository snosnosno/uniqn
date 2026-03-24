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

function hasMatchingScheduleKey(snapshot: WorkLogSnapshot, expected: ExpectedWorkLog): boolean {
  if (!snapshot.exists || !snapshot.data) {
    return false;
  }

  return (
    snapshot.data.date === expected.date &&
    snapshot.data.timeSlot === expected.timeSlot &&
    (snapshot.data.assignmentGroupId ?? null) === expected.assignmentGroupId
  );
}

function matchesExpectedWorkLogExactly(
  snapshot: WorkLogSnapshot,
  expected: ExpectedWorkLog
): boolean {
  if (!hasMatchingScheduleKey(snapshot, expected)) {
    return false;
  }

  const data = snapshot.data;

  if (!data) {
    return false;
  }

  return data.role === expected.role && (data.customRole ?? null) === expected.customRole;
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

function trySelectActiveConfirmationWorkLogs(
  workLogSnapshots: WorkLogSnapshot[],
  assignments: Assignment[]
): WorkLogSnapshot[] | null {
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
    const exactMatch = sortedSnapshots.find((snapshot) => {
      if (consumedIds.has(snapshot.ref.id)) {
        return false;
      }

      return matchesExpectedWorkLogExactly(snapshot, expected);
    });

    if (exactMatch) {
      consumedIds.add(exactMatch.ref.id);
      selected.push(exactMatch);
      continue;
    }

    const scheduleMatches = sortedSnapshots.filter((snapshot) => {
      if (consumedIds.has(snapshot.ref.id)) {
        return false;
      }

      return hasMatchingScheduleKey(snapshot, expected);
    });

    if (scheduleMatches.length !== 1) {
      return null;
    }

    consumedIds.add(scheduleMatches[0].ref.id);
    selected.push(scheduleMatches[0]);
  }

  return selected;
}

function selectActiveConfirmationWorkLogs(
  workLogSnapshots: WorkLogSnapshot[],
  assignments: Assignment[]
): WorkLogSnapshot[] {
  const selected = trySelectActiveConfirmationWorkLogs(workLogSnapshots, assignments);

  if (!selected) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '?쒖꽦 ?뺤젙???곌껐??洹쇰Т 湲곕줉??李얠쓣 ???놁뒿?덈떎.',
    });
  }

  return selected;
}

function assertCancellableConfirmationWorkLogs(workLogs: WorkLogSnapshot[]): void {
  const nonCancellableWorkLog = workLogs.find(
    (snapshot) => snapshot.data?.status !== STATUS.WORK_LOG.SCHEDULED
  );

  if (nonCancellableWorkLog) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '?대? 吏꾪뻾?섏뿀嫄곕굹 醫낅즺???뺤젙? ?꾩껜 痍⑥냼?????놁뒿?덈떎.',
    });
  }
}

function isCompletedWorkLogSnapshot(snapshot: WorkLogSnapshot): boolean {
  const status = snapshot.data?.status;

  return (
    status === STATUS.WORK_LOG.CHECKED_OUT ||
    status === STATUS.WORK_LOG.COMPLETED ||
    status === STATUS.WORK_LOG.NO_SHOW ||
    (status === STATUS.WORK_LOG.CANCELLED && Boolean(snapshot.data?.noShowAt))
  );
}

export async function resolveConfirmedApplicationStatusInTransaction(params: {
  transaction: Transaction;
  assignments: Assignment[];
  relatedWorkLogIds: string[];
}): Promise<Application['status']> {
  const { transaction, assignments, relatedWorkLogIds } = params;

  if (relatedWorkLogIds.length === 0) {
    return STATUS.APPLICATION.CONFIRMED;
  }

  const workLogSnapshots = await loadRelatedWorkLogs(transaction, relatedWorkLogIds);
  const matchedWorkLogs = trySelectActiveConfirmationWorkLogs(workLogSnapshots, assignments);

  if (!matchedWorkLogs || matchedWorkLogs.length === 0) {
    return STATUS.APPLICATION.CONFIRMED;
  }

  return matchedWorkLogs.every(isCompletedWorkLogSnapshot)
    ? STATUS.APPLICATION.COMPLETED
    : STATUS.APPLICATION.CONFIRMED;
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
      userMessage: '痍⑥냼???뺤젙 ?대젰???놁뒿?덈떎.',
    });
  }

  const activeConfirmationWorkLogs =
    relatedWorkLogIds.length > 0
      ? selectActiveConfirmationWorkLogs(
          await loadRelatedWorkLogs(transaction, relatedWorkLogIds),
          activeConfirmation.assignments
        )
      : [];

  if (activeConfirmationWorkLogs.length > 0) {
    assertCancellableConfirmationWorkLogs(activeConfirmationWorkLogs);
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
