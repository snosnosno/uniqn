import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { handleTriggerError } from "../errors";
import {
  buildJobPostingSearchIndex,
  hasJobPostingSearchIndexSourceChanged,
} from "../utils/jobPosting";

export { onJobPostingOGSync } from "./onJobPostingOGSync";
export { onFixedPostingExpired } from "./onFixedPostingExpired";
export { onTournamentApprovalChange } from "./onTournamentApprovalChange";
export { onWorkDateExpired } from "./onWorkDateExpired";

type PostingStats = {
  totalApplicants: number;
  activeApplicants: number;
  confirmedApplicants: number;
  cancellationPendingApplicants: number;
  filledPositions: number;
};

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

function collectImpactedJobPostingIds(
  beforeData: admin.firestore.DocumentData | null | undefined,
  afterData: admin.firestore.DocumentData | null | undefined,
): string[] {
  const beforeJobPostingId =
    typeof beforeData?.jobPostingId === "string" ? beforeData.jobPostingId : null;
  const afterJobPostingId =
    typeof afterData?.jobPostingId === "string" ? afterData.jobPostingId : null;
  const beforeStatus = typeof beforeData?.status === "string" ? beforeData.status : null;
  const afterStatus = typeof afterData?.status === "string" ? afterData.status : null;

  if (beforeJobPostingId === afterJobPostingId && beforeStatus === afterStatus) {
    return [];
  }

  return Array.from(
    new Set(
      [beforeJobPostingId, afterJobPostingId].filter(
        (jobPostingId): jobPostingId is string => typeof jobPostingId === "string",
      ),
    ),
  );
}

function isActiveApplicationStatus(status: unknown): boolean {
  return status === "applied" || status === "confirmed" || status === "cancellation_pending";
}

function isConfirmedApplicationStatus(status: unknown): boolean {
  return status === "confirmed";
}

function isCancellationPendingStatus(status: unknown): boolean {
  return status === "cancellation_pending";
}

function normalizePostingStats(
  postingData: admin.firestore.DocumentData | undefined,
): PostingStats {
  const stats = postingData?.stats;
  const filledPositions =
    typeof stats?.filledPositions === "number"
      ? stats.filledPositions
      : typeof postingData?.filledPositions === "number"
        ? postingData.filledPositions
        : 0;

  return {
    totalApplicants: typeof stats?.totalApplicants === "number" ? stats.totalApplicants : 0,
    activeApplicants: typeof stats?.activeApplicants === "number" ? stats.activeApplicants : 0,
    confirmedApplicants:
      typeof stats?.confirmedApplicants === "number" ? stats.confirmedApplicants : 0,
    cancellationPendingApplicants:
      typeof stats?.cancellationPendingApplicants === "number"
        ? stats.cancellationPendingApplicants
        : 0,
    filledPositions,
  };
}

function arePostingStatsEqual(left: PostingStats, right: PostingStats): boolean {
  return (
    left.totalApplicants === right.totalApplicants &&
    left.activeApplicants === right.activeApplicants &&
    left.confirmedApplicants === right.confirmedApplicants &&
    left.cancellationPendingApplicants === right.cancellationPendingApplicants &&
    left.filledPositions === right.filledPositions
  );
}

async function reconcilePostingStats(
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
    logger.warn("Skipping posting stats sync for missing job posting", {
      jobPostingId,
    });
    return;
  }

  const currentStats = normalizePostingStats(postingSnapshot.data());
  const nextStats = applicationsSnapshot.docs.reduce<PostingStats>(
    (accumulator, snapshot) => {
      const status = snapshot.get("status");
      accumulator.totalApplicants += 1;

      if (isActiveApplicationStatus(status)) {
        accumulator.activeApplicants += 1;
      }
      if (isConfirmedApplicationStatus(status)) {
        accumulator.confirmedApplicants += 1;
      }
      if (isCancellationPendingStatus(status)) {
        accumulator.cancellationPendingApplicants += 1;
      }

      return accumulator;
    },
    {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: currentStats.filledPositions,
    },
  );

  if (arePostingStatsEqual(currentStats, nextStats)) {
    logger.debug("Skipped posting stats sync because counters are already current", {
      jobPostingId,
      stats: currentStats,
    });
    return;
  }

  await postingRef.update({
    stats: nextStats,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(`Reconciled posting stats for job posting ${jobPostingId}`, {
    previousStats: currentStats,
    nextStats,
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
 * Reconciles canonical posting stats from application lifecycle writes.
 */
export const updateJobPostingApplicantCount = onDocumentWritten(
  { document: "applications/{applicationId}", region: "asia-northeast3" },
  async (event) => {
    const db = admin.firestore();
    const applicationData = event.data?.after?.exists ? event.data.after.data() : null;
    const previousData = event.data?.before?.exists ? event.data.before.data() : null;
    const impactedJobPostingIds = collectImpactedJobPostingIds(previousData, applicationData);

    if (impactedJobPostingIds.length === 0) {
      return;
    }

    try {
      await Promise.all(
        impactedJobPostingIds.map((jobPostingId) => reconcilePostingStats(db, jobPostingId)),
      );
    } catch (error) {
      logger.error("Error updating posting stats", error);
      throw handleTriggerError(error, {
        operation: "updateJobPostingApplicantCount",
        context: { jobPostingIds: impactedJobPostingIds },
      });
    }
  },
);
