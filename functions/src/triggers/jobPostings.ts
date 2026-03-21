import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { handleTriggerError } from "../errors";
import {
  buildJobPostingSearchIndex,
  hasJobPostingSearchIndexSourceChanged,
} from "../utils/jobPosting";

export { onFixedPostingExpired } from "./onFixedPostingExpired";
export { onJobPostingOGSync } from "./onJobPostingOGSync";
export { onTournamentApprovalChange } from "./onTournamentApprovalChange";
export { onWorkDateExpired } from "./onWorkDateExpired";

function normalizeSearchIndex(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry: unknown): entry is string => typeof entry === "string")
    : [];
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function isCountedApplicationStatus(status: unknown): boolean {
  return typeof status === "string" && status !== "cancelled";
}

function collectImpactedJobPostingIds(
  beforeData: admin.firestore.DocumentData | null | undefined,
  afterData: admin.firestore.DocumentData | null | undefined,
): string[] {
  const beforeJobPostingId =
    typeof beforeData?.jobPostingId === "string" ? beforeData.jobPostingId : null;
  const afterJobPostingId =
    typeof afterData?.jobPostingId === "string" ? afterData.jobPostingId : null;
  const beforeCounted = isCountedApplicationStatus(beforeData?.status);
  const afterCounted = isCountedApplicationStatus(afterData?.status);

  if (
    beforeJobPostingId === afterJobPostingId &&
    beforeCounted === afterCounted
  ) {
    return [];
  }

  return Array.from(
    new Set(
      [beforeCounted ? beforeJobPostingId : null, afterCounted ? afterJobPostingId : null].filter(
        (jobPostingId): jobPostingId is string => typeof jobPostingId === "string",
      ),
    ),
  );
}

async function reconcileApplicationCount(
  db: admin.firestore.Firestore,
  jobPostingId: string,
): Promise<void> {
  const postingRef = db.collection("jobPostings").doc(jobPostingId);
  const [postingSnapshot, applicationsSnapshot] = await Promise.all([
    postingRef.get(),
    db
      .collection("applications")
      .where("jobPostingId", "==", jobPostingId)
      .select("status")
      .get(),
  ]);

  if (!postingSnapshot.exists) {
    logger.warn("Skipping applicationCount sync for missing job posting", {
      jobPostingId,
    });
    return;
  }

  const currentCount =
    typeof postingSnapshot.data()?.applicationCount === "number"
      ? postingSnapshot.data()?.applicationCount
      : 0;
  const nextCount = applicationsSnapshot.docs.reduce((count, snapshot) => {
    return count + (isCountedApplicationStatus(snapshot.get("status")) ? 1 : 0);
  }, 0);

  if (currentCount === nextCount) {
    logger.debug("Skipped applicationCount sync because canonical counter is already current", {
      jobPostingId,
      applicationCount: currentCount,
    });
    return;
  }

  await postingRef.update({
    applicationCount: nextCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(`Reconciled applicationCount for job posting ${jobPostingId}`, {
    previousCount: currentCount,
    nextCount,
  });
}

/**
 * Keeps the derived search index aligned with the canonical V3 source fields.
 * It intentionally avoids reshaping any other job posting fields.
 */
export const validateJobPostingData = onDocumentWritten(
  { document: "jobPostings/{postId}", region: "asia-northeast3" },
  async (event) => {
    const postId = event.params.postId;

    if (!event.data?.after.exists) {
      return;
    }

    const data = event.data.after.data();
    if (!data) {
      return;
    }

    const beforeData = event.data.before?.exists ? event.data.before.data() : null;
    const currentSearchIndex = normalizeSearchIndex(data.searchIndex);
    const previousSearchIndex = normalizeSearchIndex(beforeData?.searchIndex);

    if (
      beforeData &&
      currentSearchIndex.length > 0 &&
      !hasJobPostingSearchIndexSourceChanged(beforeData, data) &&
      areStringArraysEqual(currentSearchIndex, previousSearchIndex)
    ) {
      return;
    }

    const nextSearchIndex = buildJobPostingSearchIndex({
      title: data.title,
      description: data.description,
      location: data.location,
      roleCatalog: data.roleCatalog,
    });

    if (areStringArraysEqual(currentSearchIndex, nextSearchIndex)) {
      return;
    }

    try {
      await event.data.after.ref.update({ searchIndex: nextSearchIndex });
      logger.info(`Synced V3 searchIndex for post ${postId}`, {
        currentSearchIndex,
        nextSearchIndex,
      });
    } catch (error) {
      logger.error(`Failed to sync searchIndex for post ${postId}`, error);
      throw handleTriggerError(error, {
        operation: "validateJobPostingData",
        context: { postId },
      });
    }
  },
);

/**
 * Updates the canonical applicationCount counter on the owning job posting.
 */
export const updateJobPostingApplicantCount = onDocumentWritten(
  { document: "applications/{applicationId}", region: "asia-northeast3" },
  async (event) => {
    const db = admin.firestore();
    const applicationData = event.data?.after?.exists
      ? event.data.after.data()
      : null;
    const previousData = event.data?.before?.exists
      ? event.data.before.data()
      : null;
    const impactedJobPostingIds = collectImpactedJobPostingIds(previousData, applicationData);

    if (impactedJobPostingIds.length === 0) {
      return;
    }

    try {
      await Promise.all(
        impactedJobPostingIds.map((jobPostingId) => reconcileApplicationCount(db, jobPostingId)),
      );
    } catch (error) {
      logger.error("Error updating applicant count", error);
      throw handleTriggerError(error, {
        operation: "updateJobPostingApplicantCount",
        context: { jobPostingIds: impactedJobPostingIds },
      });
    }
  },
);
