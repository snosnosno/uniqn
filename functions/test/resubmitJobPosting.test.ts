import * as admin from "firebase-admin";
import { expect } from "chai";

if (!admin.apps.length) {
  admin.initializeApp();
}

const { resubmitJobPosting } =
  require("../src/api/jobPostings") as typeof import("../src/api/jobPostings");

describe("resubmitJobPosting canonical contract", () => {
  beforeEach(async () => {
    const db = admin.firestore();
    const batch = db.batch();

    const postingsSnap = await db.collection("jobPostings").get();
    postingsSnap.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
  });

  it("keeps tournamentConfig within the canonical V3 shape on resubmit", async () => {
    const db = admin.firestore();
    const submittedAt = admin.firestore.Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z"));
    const rejectedAt = admin.firestore.Timestamp.fromDate(new Date("2026-04-02T09:00:00.000Z"));

    await db.collection("jobPostings").doc("job-1").set({
      schemaVersion: 3,
      title: "Tournament Posting",
      status: "active",
      ownerId: "employer-1",
      ownerName: "Owner",
      postingType: "tournament",
      workDate: "2026-04-10",
      workDates: ["2026-04-10"],
      roleKeys: ["dealer"],
      totalPositions: 1,
      filledPositions: 0,
      viewCount: 0,
      stats: {
        totalApplicants: 0,
        activeApplicants: 0,
        confirmedApplicants: 0,
        cancellationPendingApplicants: 0,
        filledPositions: 0,
      },
      createdAt: submittedAt,
      updatedAt: rejectedAt,
      location: {
        name: "Seoul",
        district: "Gangnam-gu",
      },
      schedule: {
        kind: "dated",
        primaryDate: "2026-04-10",
        allDates: ["2026-04-10"],
        requirements: [
          {
            date: "2026-04-10",
            timeSlots: [
              {
                startTime: "18:00",
                roles: [{ role: "dealer", count: 1, filled: 0 }],
              },
            ],
          },
        ],
      },
      roleCatalog: [{ role: "dealer" }],
      compensation: {
        mode: "shared",
      },
      questions: {
        items: [],
      },
      tournamentConfig: {
        approvalStatus: "rejected",
        submittedAt,
        rejectedBy: "admin-1",
        rejectedAt,
        rejectionReason: "Need more details",
      },
    });

    const result = await resubmitJobPosting.run({
      data: { postingId: "job-1" },
      auth: { uid: "employer-1", token: { role: "employer" } },
    } as never);

    expect(result.success).to.equal(true);
    expect(result.postingId).to.equal("job-1");
    expect(result.resubmittedBy).to.equal("employer-1");

    const snapshot = await db.collection("jobPostings").doc("job-1").get();
    const posting = snapshot.data();
    const tournamentConfig = posting?.tournamentConfig as Record<string, unknown>;

    expect(tournamentConfig.approvalStatus).to.equal("pending");
    expect(tournamentConfig.submittedAt).to.deep.equal(submittedAt);
    expect(tournamentConfig.resubmittedAt).to.exist;
    expect(Object.keys(tournamentConfig).sort()).to.deep.equal([
      "approvalStatus",
      "resubmittedAt",
      "submittedAt",
    ]);
    expect("rejectedBy" in tournamentConfig).to.equal(false);
    expect("rejectedAt" in tournamentConfig).to.equal(false);
    expect("rejectionReason" in tournamentConfig).to.equal(false);
    expect("resubmittedBy" in tournamentConfig).to.equal(false);
    expect("previousRejection" in tournamentConfig).to.equal(false);
  });
});
