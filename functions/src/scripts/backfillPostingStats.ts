import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { buildPostingStats } from "../triggers/jobPostings";

interface BackfillResult {
  scanned: number;
  updated: number;
  skipped: number;
}

export async function backfillPostingStats(): Promise<BackfillResult> {
  const db = admin.firestore();
  const postingsSnapshot = await db.collection("jobPostings").get();

  const result: BackfillResult = {
    scanned: 0,
    updated: 0,
    skipped: 0,
  };

  for (const postingDoc of postingsSnapshot.docs) {
    result.scanned += 1;

    const applicationsSnapshot = await db
      .collection("applications")
      .where("jobPostingId", "==", postingDoc.id)
      .select("status")
      .get();

    const nextStats = buildPostingStats(
      postingDoc.data(),
      applicationsSnapshot.docs.map((snapshot) => snapshot.get("status")),
    );
    const currentStats = postingDoc.data().stats;

    const isAlreadyCurrent =
      currentStats?.totalApplicants === nextStats.totalApplicants &&
      currentStats?.activeApplicants === nextStats.activeApplicants &&
      currentStats?.confirmedApplicants === nextStats.confirmedApplicants &&
      currentStats?.cancellationPendingApplicants === nextStats.cancellationPendingApplicants &&
      currentStats?.filledPositions === nextStats.filledPositions;

    if (isAlreadyCurrent) {
      result.skipped += 1;
      continue;
    }

    await postingDoc.ref.update({
      stats: nextStats,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    result.updated += 1;
  }

  logger.info("Posting stats backfill completed", result);
  return result;
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  await backfillPostingStats();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error("Posting stats backfill failed", error);
    process.exitCode = 1;
  });
}
