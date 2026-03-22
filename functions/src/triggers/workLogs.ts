import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { handleTriggerError } from "../errors";

type ApplicationData = {
  applicantId?: string;
  confirmationHistory?: ConfirmationHistoryEntry[];
  jobPostingId?: string;
  status?: string;
};

type AssignmentData = {
  dates?: unknown[];
  groupId?: string | null;
  roleIds?: unknown[];
  timeSlot?: string;
};

type ConfirmationHistoryEntry = {
  assignments?: AssignmentData[];
  cancelledAt?: admin.firestore.Timestamp | null;
};

type ExpectedWorkLog = {
  assignmentGroupId: string | null;
  customRole: string | null;
  date: string;
  role: string;
  timeSlot: string;
};

type WorkLogData = {
  assignmentGroupId?: string | null;
  createdAt?: admin.firestore.Timestamp | null;
  customRole?: string | null;
  date?: string;
  jobPostingId?: string;
  noShowAt?: admin.firestore.Timestamp | string | null;
  role?: string;
  staffId?: string;
  status?: string;
  timeSlot?: string;
  updatedAt?: admin.firestore.Timestamp | null;
};

const STANDARD_STAFF_ROLES = new Set([
  "dealer",
  "floor",
  "serving",
  "manager",
  "staff",
  "other",
]);

const ACTIVE_APPLICATION_STATUSES = new Set(["confirmed", "completed"]);

function getTimestampMillis(
  value: admin.firestore.Timestamp | string | null | undefined,
): number {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toMillis();
  }

  return 0;
}

function collectImpactedApplicationIds(
  beforeData: WorkLogData | null | undefined,
  afterData: WorkLogData | null | undefined,
): string[] {
  const ids = new Set<string>();

  for (const data of [beforeData, afterData]) {
    if (
      data &&
      typeof data.jobPostingId === "string" &&
      typeof data.staffId === "string"
    ) {
      ids.add(`${data.jobPostingId}_${data.staffId}`);
    }
  }

  return Array.from(ids);
}

function normalizeAssignmentRole(roleId: unknown): {
  role: string;
  customRole: string | null;
} {
  if (typeof roleId !== "string" || roleId.length === 0 || roleId === "other") {
    return { role: "other", customRole: null };
  }

  if (STANDARD_STAFF_ROLES.has(roleId)) {
    return { role: roleId, customRole: null };
  }

  return {
    role: "other",
    customRole: roleId,
  };
}

function findActiveConfirmation(
  history: ConfirmationHistoryEntry[] | undefined,
): ConfirmationHistoryEntry | null {
  if (!Array.isArray(history)) {
    return null;
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry && !entry.cancelledAt) {
      return entry;
    }
  }

  return null;
}

function buildExpectedWorkLogs(assignments: AssignmentData[] | undefined): ExpectedWorkLog[] {
  if (!Array.isArray(assignments)) {
    return [];
  }

  const expected: ExpectedWorkLog[] = [];

  for (const assignment of assignments) {
    if (
      !assignment ||
      !Array.isArray(assignment.dates) ||
      assignment.dates.length === 0 ||
      typeof assignment.timeSlot !== "string"
    ) {
      continue;
    }

    const normalizedRole = normalizeAssignmentRole(
      Array.isArray(assignment.roleIds) ? assignment.roleIds[0] : undefined,
    );

    for (const rawDate of assignment.dates) {
      if (typeof rawDate !== "string") {
        continue;
      }

      expected.push({
        assignmentGroupId: assignment.groupId ?? null,
        customRole: normalizedRole.customRole,
        date: rawDate,
        role: normalizedRole.role,
        timeSlot: assignment.timeSlot,
      });
    }
  }

  return expected;
}

function matchesExpectedWorkLog(
  workLog: admin.firestore.QueryDocumentSnapshot,
  expected: ExpectedWorkLog,
): boolean {
  const data = workLog.data() as WorkLogData;

  return (
    data.date === expected.date &&
    data.timeSlot === expected.timeSlot &&
    data.role === expected.role &&
    (data.customRole ?? null) === expected.customRole &&
    (data.assignmentGroupId ?? null) === expected.assignmentGroupId
  );
}

function selectConfirmationWorkLogs(
  workLogs: admin.firestore.QueryDocumentSnapshot[],
  expectedWorkLogs: ExpectedWorkLog[],
): admin.firestore.QueryDocumentSnapshot[] {
  const selected: admin.firestore.QueryDocumentSnapshot[] = [];
  const consumedIds = new Set<string>();

  const sortedWorkLogs = [...workLogs].sort((left, right) => {
    const leftData = left.data() as WorkLogData;
    const rightData = right.data() as WorkLogData;
    const createdDelta =
      getTimestampMillis(rightData.createdAt) - getTimestampMillis(leftData.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return getTimestampMillis(rightData.updatedAt) - getTimestampMillis(leftData.updatedAt);
  });

  for (const expected of expectedWorkLogs) {
    const match = sortedWorkLogs.find((workLog) => {
      if (consumedIds.has(workLog.id)) {
        return false;
      }

      return matchesExpectedWorkLog(workLog, expected);
    });

    if (!match) {
      return [];
    }

    consumedIds.add(match.id);
    selected.push(match);
  }

  return selected;
}

function isCompletedFromWorkLog(data: WorkLogData): boolean {
  return (
    data.status === "checked_out" ||
    data.status === "completed" ||
    (data.status === "cancelled" && Boolean(data.noShowAt))
  );
}

async function reconcileApplicationCompletion(
  db: admin.firestore.Firestore,
  applicationId: string,
): Promise<void> {
  const applicationRef = db.collection("applications").doc(applicationId);
  const applicationSnapshot = await applicationRef.get();

  if (!applicationSnapshot.exists) {
    logger.debug("Skipping worklog completion sync for missing application", {
      applicationId,
    });
    return;
  }

  const applicationData = applicationSnapshot.data() as ApplicationData | undefined;
  if (
    !applicationData ||
    !ACTIVE_APPLICATION_STATUSES.has(applicationData.status ?? "") ||
    typeof applicationData.applicantId !== "string" ||
    typeof applicationData.jobPostingId !== "string"
  ) {
    return;
  }

  const activeConfirmation = findActiveConfirmation(applicationData.confirmationHistory);
  if (!activeConfirmation) {
    logger.warn("Skipping worklog completion sync without active confirmation", {
      applicationId,
      status: applicationData.status,
    });
    return;
  }

  const expectedWorkLogs = buildExpectedWorkLogs(activeConfirmation.assignments);
  if (expectedWorkLogs.length === 0) {
    logger.warn("Skipping worklog completion sync without expected assignments", {
      applicationId,
    });
    return;
  }

  const workLogsSnapshot = await db
    .collection("workLogs")
    .where("staffId", "==", applicationData.applicantId)
    .where("jobPostingId", "==", applicationData.jobPostingId)
    .get();

  const relatedWorkLogs = selectConfirmationWorkLogs(workLogsSnapshot.docs, expectedWorkLogs);
  if (relatedWorkLogs.length !== expectedWorkLogs.length) {
    logger.warn("Skipping worklog completion sync due to mismatched confirmation worklogs", {
      applicationId,
      expectedCount: expectedWorkLogs.length,
      matchedCount: relatedWorkLogs.length,
    });
    return;
  }

  const nextStatus = relatedWorkLogs.every((workLog) =>
    isCompletedFromWorkLog(workLog.data() as WorkLogData),
  )
    ? "completed"
    : "confirmed";

  if (applicationData.status === nextStatus) {
    return;
  }

  await applicationRef.update({
    status: nextStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info("Reconciled application status from worklogs", {
    applicationId,
    previousStatus: applicationData.status,
    nextStatus,
  });
}

export const syncApplicationCompletionFromWorkLogs = onDocumentWritten(
  { document: "workLogs/{workLogId}", region: "asia-northeast3" },
  async (event) => {
    const beforeData = event.data?.before.exists
      ? (event.data.before.data() as WorkLogData)
      : null;
    const afterData = event.data?.after.exists
      ? (event.data.after.data() as WorkLogData)
      : null;
    const impactedApplicationIds = collectImpactedApplicationIds(beforeData, afterData);

    if (impactedApplicationIds.length === 0) {
      return;
    }

    try {
      const db = admin.firestore();
      await Promise.all(
        impactedApplicationIds.map((applicationId) =>
          reconcileApplicationCompletion(db, applicationId),
        ),
      );
    } catch (error) {
      throw handleTriggerError(error, {
        operation: "syncApplicationCompletionFromWorkLogs",
        context: {
          impactedApplicationIds,
          workLogId: event.params.workLogId,
        },
      });
    }
  },
);
