import * as admin from "firebase-admin";
import { expect } from "chai";
import { buildJobPostingSearchIndex } from "../src/utils/jobPosting";

if (!admin.apps.length) {
  admin.initializeApp();
}

const { approveJobPosting, rejectJobPosting } =
  require("../src/api/jobPostings") as typeof import("../src/api/jobPostings");
const { updateJobPostingApplicantCount, validateJobPostingData } =
  require("../src/triggers/jobPostings") as typeof import("../src/triggers/jobPostings");

const DISALLOWED_NON_CANONICAL_TOP_LEVEL_FIELDS = [
  "detailedAddress",
  "preQuestions",
  "updatedBy",
  "usesPreQuestions",
];

function createCanonicalTournamentPosting(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const submittedAt = admin.firestore.Timestamp.fromDate(
    new Date("2026-04-01T09:00:00.000Z"),
  );

  return {
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
    updatedAt: submittedAt,
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
      defaultSalary: { type: "daily", amount: 150000 },
    },
    questions: {
      items: [],
    },
    tournamentConfig: {
      approvalStatus: "pending",
      submittedAt,
    },
    ...overrides,
  };
}

function expectNoNonCanonicalTopLevelFields(posting: Record<string, unknown>): void {
  DISALLOWED_NON_CANONICAL_TOP_LEVEL_FIELDS.forEach((field) => {
    expect(field in posting, `${field} should stay absent`).to.equal(false);
  });
}

describe("job posting function canonical contracts", () => {
  beforeEach(async () => {
    const db = admin.firestore();
    const batch = db.batch();

    const postingsSnap = await db.collection("jobPostings").get();
    postingsSnap.docs.forEach((doc) => batch.delete(doc.ref));

    const applicationsSnap = await db.collection("applications").get();
    applicationsSnap.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
  });

  it("approveJobPosting only persists canonical approval fields", async () => {
    const db = admin.firestore();

    await db
      .collection("jobPostings")
      .doc("job-approve")
      .set(createCanonicalTournamentPosting());

    const result = await approveJobPosting.run({
      data: { postingId: "job-approve" },
      auth: { uid: "admin-1", token: { role: "admin" } },
    } as never);

    expect(result.success).to.equal(true);

    const snapshot = await db.collection("jobPostings").doc("job-approve").get();
    const posting = snapshot.data() as Record<string, unknown>;
    const tournamentConfig = posting.tournamentConfig as Record<string, unknown>;

    expectNoNonCanonicalTopLevelFields(posting);
    expect(Object.keys(tournamentConfig).sort()).to.deep.equal([
      "approvalStatus",
      "approvedAt",
      "approvedBy",
      "submittedAt",
    ]);
    expect(tournamentConfig.approvalStatus).to.equal("approved");
    expect(tournamentConfig.approvedBy).to.equal("admin-1");
  });

  it("rejectJobPosting only persists canonical rejection fields", async () => {
    const db = admin.firestore();

    await db
      .collection("jobPostings")
      .doc("job-reject")
      .set(createCanonicalTournamentPosting());

    const result = await rejectJobPosting.run({
      data: {
        postingId: "job-reject",
        reason: "Need more tournament configuration details",
      },
      auth: { uid: "admin-2", token: { role: "admin" } },
    } as never);

    expect(result.success).to.equal(true);

    const snapshot = await db.collection("jobPostings").doc("job-reject").get();
    const posting = snapshot.data() as Record<string, unknown>;
    const tournamentConfig = posting.tournamentConfig as Record<string, unknown>;

    expectNoNonCanonicalTopLevelFields(posting);
    expect(Object.keys(tournamentConfig).sort()).to.deep.equal([
      "approvalStatus",
      "rejectedAt",
      "rejectedBy",
      "rejectionReason",
      "submittedAt",
    ]);
    expect(tournamentConfig.approvalStatus).to.equal("rejected");
    expect(tournamentConfig.rejectedBy).to.equal("admin-2");
    expect(tournamentConfig.rejectionReason).to.equal(
      "Need more tournament configuration details",
    );
  });

  it("validateJobPostingData only syncs the derived canonical searchIndex", async () => {
    const db = admin.firestore();

    await db.collection("jobPostings").doc("job-search").set({
      ...createCanonicalTournamentPosting({
        title: "VIP Dealer Wanted",
        description: "Main event floor",
      }),
      searchIndex: ["stale"],
    });

    const afterSnapshot = await db.collection("jobPostings").doc("job-search").get();

    await validateJobPostingData.run({
      params: { postId: "job-search" },
      data: { after: afterSnapshot },
    } as never);

    const updatedSnapshot = await db.collection("jobPostings").doc("job-search").get();
    const posting = updatedSnapshot.data() as Record<string, unknown>;

    expectNoNonCanonicalTopLevelFields(posting);
    expect(posting.searchIndex).to.deep.equal(
      buildJobPostingSearchIndex({
        title: posting.title as string,
        description: posting.description as string,
        location: posting.location as never,
        roleCatalog: posting.roleCatalog as never,
      }),
    );
  });

  it("updateJobPostingApplicantCount only updates canonical stats", async () => {
    const db = admin.firestore();

    await db
      .collection("jobPostings")
      .doc("job-count")
      .set(createCanonicalTournamentPosting());

    await db.collection("applications").doc("app-1").set({
      jobPostingId: "job-count",
      applicantId: "staff-1",
      status: "applied",
    });

    const afterSnapshot = await db.collection("applications").doc("app-1").get();

    await updateJobPostingApplicantCount.run({
      params: { applicationId: "app-1" },
      data: {
        before: { exists: false },
        after: afterSnapshot,
      },
    } as never);

    const postingSnapshot = await db.collection("jobPostings").doc("job-count").get();
    const posting = postingSnapshot.data() as Record<string, unknown>;

    expectNoNonCanonicalTopLevelFields(posting);
    expect(posting.stats).to.deep.equal({
      totalApplicants: 1,
      activeApplicants: 1,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    });
    expect(posting.updatedAt).to.exist;
  });

  it("updateJobPostingApplicantCount skips no-op creates when canonical stats are already current", async () => {
    const db = admin.firestore();
    const stableUpdatedAt = admin.firestore.Timestamp.fromDate(
      new Date("2026-04-01T10:00:00.000Z"),
    );

    await db
      .collection("jobPostings")
      .doc("job-count-stable")
      .set(createCanonicalTournamentPosting({
        stats: {
          totalApplicants: 1,
          activeApplicants: 1,
          confirmedApplicants: 0,
          cancellationPendingApplicants: 0,
          filledPositions: 0,
        },
        updatedAt: stableUpdatedAt,
      }));

    await db.collection("applications").doc("app-stable").set({
      jobPostingId: "job-count-stable",
      applicantId: "staff-1",
      status: "applied",
    });

    const afterSnapshot = await db.collection("applications").doc("app-stable").get();

    await updateJobPostingApplicantCount.run({
      params: { applicationId: "app-stable" },
      data: {
        before: { exists: false },
        after: afterSnapshot,
      },
    } as never);

    const postingSnapshot = await db.collection("jobPostings").doc("job-count-stable").get();
    const posting = postingSnapshot.data() as Record<string, unknown>;

    expect(posting.stats).to.deep.equal({
      totalApplicants: 1,
      activeApplicants: 1,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    });
    expect((posting.updatedAt as admin.firestore.Timestamp).isEqual(stableUpdatedAt)).to.equal(true);
  });

  it("updateJobPostingApplicantCount mirrors top-level filledPositions when legacy stats are stale", async () => {
    const db = admin.firestore();
    const stableUpdatedAt = admin.firestore.Timestamp.fromDate(
      new Date("2026-04-01T10:30:00.000Z"),
    );

    await db
      .collection("jobPostings")
      .doc("job-count-filled-mirror")
      .set(
        createCanonicalTournamentPosting({
          filledPositions: 2,
          stats: {
            totalApplicants: 1,
            activeApplicants: 1,
            confirmedApplicants: 0,
            cancellationPendingApplicants: 0,
            filledPositions: 0,
          },
          updatedAt: stableUpdatedAt,
        }),
      );

    await db.collection("applications").doc("app-filled-mirror").set({
      jobPostingId: "job-count-filled-mirror",
      applicantId: "staff-1",
      status: "applied",
    });

    const afterSnapshot = await db.collection("applications").doc("app-filled-mirror").get();

    await updateJobPostingApplicantCount.run({
      params: { applicationId: "app-filled-mirror" },
      data: {
        before: { exists: false },
        after: afterSnapshot,
      },
    } as never);

    const postingSnapshot = await db.collection("jobPostings").doc("job-count-filled-mirror").get();
    const posting = postingSnapshot.data() as Record<string, unknown>;

    expect((posting.stats as Record<string, unknown>).filledPositions).to.equal(2);
    expect((posting.updatedAt as admin.firestore.Timestamp).isEqual(stableUpdatedAt)).to.equal(false);
  });

  it("updateJobPostingApplicantCount recalculates canonical breakdown when status changes", async () => {
    const db = admin.firestore();
    const stableUpdatedAt = admin.firestore.Timestamp.fromDate(
      new Date("2026-04-01T11:00:00.000Z"),
    );

    await db
      .collection("jobPostings")
      .doc("job-count-status")
      .set(createCanonicalTournamentPosting({
        stats: {
          totalApplicants: 1,
          activeApplicants: 1,
          confirmedApplicants: 0,
          cancellationPendingApplicants: 0,
          filledPositions: 0,
        },
        updatedAt: stableUpdatedAt,
      }));

    await db.collection("applications").doc("app-status").set({
      jobPostingId: "job-count-status",
      applicantId: "staff-1",
      status: "applied",
    });

    const beforeSnapshot = await db.collection("applications").doc("app-status").get();

    await db.collection("applications").doc("app-status").set({
      jobPostingId: "job-count-status",
      applicantId: "staff-1",
      status: "confirmed",
    });

    const afterSnapshot = await db.collection("applications").doc("app-status").get();

    await updateJobPostingApplicantCount.run({
      params: { applicationId: "app-status" },
      data: {
        before: beforeSnapshot,
        after: afterSnapshot,
      },
    } as never);

    const postingSnapshot = await db.collection("jobPostings").doc("job-count-status").get();
    const posting = postingSnapshot.data() as Record<string, unknown>;

    expect(posting.stats).to.deep.equal({
      totalApplicants: 1,
      activeApplicants: 1,
      confirmedApplicants: 1,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    });
    expect((posting.updatedAt as admin.firestore.Timestamp).isEqual(stableUpdatedAt)).to.equal(false);
  });
});
