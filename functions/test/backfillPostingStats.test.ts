import * as admin from "firebase-admin";
import { expect } from "chai";

if (!admin.apps.length) {
  admin.initializeApp();
}

const { backfillPostingStats } = require("../src/scripts/backfillPostingStats") as typeof import(
  "../src/scripts/backfillPostingStats"
);

describe("backfillPostingStats", () => {
  beforeEach(async () => {
    const db = admin.firestore();
    const batch = db.batch();

    const postingsSnap = await db.collection("jobPostings").get();
    postingsSnap.docs.forEach((doc) => batch.delete(doc.ref));

    const applicationsSnap = await db.collection("applications").get();
    applicationsSnap.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
  });

  it("reconciles stale applicant counters and mirrors top-level filledPositions", async () => {
    const db = admin.firestore();

    await db.collection("jobPostings").doc("job-backfill").set({
      schemaVersion: 3,
      title: "Backfill Posting",
      status: "active",
      ownerId: "employer-1",
      workDate: "2026-04-10",
      totalPositions: 2,
      filledPositions: 2,
      stats: {
        totalApplicants: 0,
        activeApplicants: 0,
        confirmedApplicants: 0,
        cancellationPendingApplicants: 0,
        filledPositions: 0,
      },
    });

    await db.collection("applications").doc("app-backfill-1").set({
      jobPostingId: "job-backfill",
      status: "applied",
    });
    await db.collection("applications").doc("app-backfill-2").set({
      jobPostingId: "job-backfill",
      status: "cancellation_pending",
    });

    const result = await backfillPostingStats();
    const posting = (await db.collection("jobPostings").doc("job-backfill").get()).data();

    expect(result.updated).to.equal(1);
    expect(posting?.stats).to.deep.equal({
      totalApplicants: 2,
      activeApplicants: 2,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 1,
      filledPositions: 2,
    });
  });

  it("skips postings that are already current", async () => {
    const db = admin.firestore();

    await db.collection("jobPostings").doc("job-backfill-stable").set({
      schemaVersion: 3,
      title: "Stable Posting",
      status: "active",
      ownerId: "employer-1",
      workDate: "2026-04-10",
      totalPositions: 1,
      filledPositions: 1,
      stats: {
        totalApplicants: 1,
        activeApplicants: 1,
        confirmedApplicants: 1,
        cancellationPendingApplicants: 0,
        filledPositions: 1,
      },
    });

    await db.collection("applications").doc("app-backfill-stable").set({
      jobPostingId: "job-backfill-stable",
      status: "confirmed",
    });

    const result = await backfillPostingStats();

    expect(result.updated).to.equal(0);
    expect(result.skipped).to.equal(1);
  });

  it("derives filledPositions from schedule when top-level data is missing", async () => {
    const db = admin.firestore();
    const posting = {
      schemaVersion: 3,
      title: "Schedule Derived Posting",
      status: "active",
      ownerId: "employer-1",
      totalPositions: 2,
      schedule: {
        kind: "dated",
        requirements: [
          {
            date: "2026-04-10",
            timeSlots: [
              {
                startTime: "18:00",
                roles: [{role: "dealer", count: 2, filled: 2}],
              },
            ],
          },
        ],
      },
      stats: {
        totalApplicants: 0,
        activeApplicants: 0,
        confirmedApplicants: 0,
        cancellationPendingApplicants: 0,
        filledPositions: 0,
      },
    } as Record<string, unknown>;
    delete posting.filledPositions;

    await db.collection("jobPostings").doc("job-backfill-schedule").set(posting);

    const result = await backfillPostingStats();
    const updatedPosting = (
      await db.collection("jobPostings").doc("job-backfill-schedule").get()
    ).data();

    expect(result.updated).to.equal(1);
    expect(updatedPosting?.stats?.filledPositions).to.equal(2);
  });
});
