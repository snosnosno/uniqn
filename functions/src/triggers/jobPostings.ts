import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { handleTriggerError } from "../errors";
import { buildJobPostingSearchIndex } from "../utils/jobPosting";

export { onFixedPostingExpired } from "./onFixedPostingExpired";
export { onJobPostingOGSync } from "./onJobPostingOGSync";
export { onTournamentApprovalChange } from "./onTournamentApprovalChange";
export { onWorkDateExpired } from "./onWorkDateExpired";

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

    const currentSearchIndex = Array.isArray(data.searchIndex)
      ? data.searchIndex.filter(
        (value: unknown): value is string => typeof value === "string",
      )
      : [];
    const nextSearchIndex = buildJobPostingSearchIndex({
      title: data.title,
      description: data.description,
      location: data.location,
      roleCatalog: data.roleCatalog,
    });

    if (JSON.stringify(currentSearchIndex) === JSON.stringify(nextSearchIndex)) {
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
    const applicationData = event.data?.after.exists
      ? event.data.after.data()
      : null;
    const previousData = event.data?.before.exists
      ? event.data.before.data()
      : null;
    const jobPostingId =
      applicationData?.jobPostingId || previousData?.jobPostingId;

    if (!jobPostingId) {
      logger.warn("No jobPostingId found in application document");
      return;
    }

    try {
      const applicationsSnapshot = await db
        .collection("applications")
        .where("jobPostingId", "==", jobPostingId)
        .get();

      await db.collection("jobPostings").doc(jobPostingId).update({
        applicationCount: applicationsSnapshot.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        `Updated applicationCount for job posting ${jobPostingId}: ${applicationsSnapshot.size}`,
      );
    } catch (error) {
      logger.error("Error updating applicant count", error);
      throw handleTriggerError(error, {
        operation: "updateJobPostingApplicantCount",
        context: { jobPostingId },
      });
    }
  },
);
