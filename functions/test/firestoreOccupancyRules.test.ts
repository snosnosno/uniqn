import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
} from "firebase/firestore";

const PROJECT_ID = "occupancy-rules-test";
const RULES_PATH = resolve(__dirname, "..", "..", "firestore.rules");

function createCanonicalJobPosting(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z"));

  return {
    schemaVersion: 3,
    title: "Canonical posting",
    status: "active",
    ownerId: "employer-1",
    ownerName: "Owner",
    postingType: "regular",
    workDate: "2026-04-01",
    workDates: ["2026-04-01"],
    roleKeys: ["dealer"],
    totalPositions: 1,
    filledPositions: 0,
    viewCount: 0,
    stats: {
      totalApplicants: 1,
      activeApplicants: 1,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    createdAt,
    updatedAt: createdAt,
    location: {
      name: "Seoul",
      district: "Gangnam-gu",
    },
    schedule: {
      kind: "dated",
      primaryDate: "2026-04-01",
      allDates: ["2026-04-01"],
      requirements: [
        {
          date: "2026-04-01",
          timeSlots: [
            {
              startTime: "18:00",
              roles: [{ role: "dealer", count: 1, filled: 0 }],
            },
          ],
        },
      ],
    },
    roleCatalog: [
      {
        role: "dealer",
        salary: { type: "daily", amount: 150000 },
      },
    ],
    compensation: {
      mode: "shared",
      defaultSalary: { type: "daily", amount: 150000 },
      allowances: {},
    },
    questions: {
      items: [],
    },
    ...overrides,
  };
}

function createApplication(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z"));

  return {
    applicantId: "staff-1",
    applicantName: "Applicant",
    jobPostingId: "job-1",
    status: "applied",
    assignments: [
      {
        roleIds: ["dealer"],
        dates: ["2026-04-01"],
        timeSlot: "18:00",
        isGrouped: false,
        checkMethod: "individual",
      },
    ],
    confirmationHistory: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createCancellationPendingApplication(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z"));

  return {
    ...createApplication({
      status: "cancellation_pending",
      confirmationHistory: [
        {
          confirmedAt: createdAt,
          assignments: [
            {
              roleIds: ["dealer"],
              dates: ["2026-04-01"],
              timeSlot: "18:00",
              isGrouped: false,
              checkMethod: "individual",
            },
          ],
          confirmedBy: "employer-1",
        },
      ],
      cancellationRequest: {
        requestedAt: createdAt,
        reason: "Need to cancel due to schedule conflict",
        status: "pending",
      },
    }),
    ...overrides,
  };
}

describe("Firestore occupancy rules", () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
    setLogLevel("error");

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(RULES_PATH, "utf8"),
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, "users", "employer-1"), { role: "employer" });
      await setDoc(doc(db, "users", "staff-1"), { role: "staff" });
      await setDoc(doc(db, "jobPostings", "job-1"), createCanonicalJobPosting());
      await setDoc(doc(db, "applications", "job-1_staff-1"), createApplication());
    });
  });

  it("allows an employer confirmation-style transaction that updates occupancy and schedule", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();
    const confirmedAt = Timestamp.fromDate(new Date("2026-04-01T11:00:00.000Z"));

    await assertSucceeds(
      runTransaction(employerDb, async (transaction) => {
        const jobRef = doc(employerDb, "jobPostings", "job-1");
        const applicationRef = doc(employerDb, "applications", "job-1_staff-1");
        const workLogRef = doc(employerDb, "workLogs", "wl-dated-1");

        await transaction.get(jobRef);
        await transaction.get(applicationRef);

        transaction.set(workLogRef, {
          staffId: "staff-1",
          staffName: "Applicant",
          jobPostingId: "job-1",
          jobPostingName: "Canonical posting",
          ownerId: "employer-1",
          role: "dealer",
          customRole: null,
          date: "2026-04-01",
          timeSlot: "18:00",
          isTimeToBeAnnounced: false,
          tentativeDescription: null,
          status: "scheduled",
          checkInTime: null,
          checkOutTime: null,
          workDuration: null,
          payrollAmount: null,
          isSettled: false,
          assignmentGroupId: null,
          checkMethod: "individual",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(applicationRef, {
          status: "confirmed",
          assignments: [
            {
              roleIds: ["dealer"],
              dates: ["2026-04-01"],
              timeSlot: "18:00",
              isGrouped: false,
              checkMethod: "individual",
            },
          ],
          originalApplication: {
            assignments: [
              {
                roleIds: ["dealer"],
                dates: ["2026-04-01"],
                timeSlot: "18:00",
                isGrouped: false,
                checkMethod: "individual",
              },
            ],
            appliedAt: confirmedAt,
          },
          confirmationHistory: [
            {
              confirmedAt,
              confirmedBy: "employer-1",
              assignments: [
                {
                  roleIds: ["dealer"],
                  dates: ["2026-04-01"],
                  timeSlot: "18:00",
                  isGrouped: false,
                  checkMethod: "individual",
                },
              ],
            },
          ],
          confirmedAt,
          processedBy: "employer-1",
          processedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(jobRef, {
          filledPositions: 1,
          schedule: {
            kind: "dated",
            primaryDate: "2026-04-01",
            allDates: ["2026-04-01"],
            requirements: [
              {
                date: "2026-04-01",
                timeSlots: [
                  {
                    startTime: "18:00",
                    roles: [{ role: "dealer", count: 1, filled: 1 }],
                  },
                ],
              },
            ],
          },
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("allows an employer cancellation-review-style transaction that releases occupancy canonically", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(
        doc(db, "jobPostings", "job-1"),
        createCanonicalJobPosting({
          filledPositions: 1,
          stats: {
            totalApplicants: 1,
            activeApplicants: 1,
            confirmedApplicants: 0,
            cancellationPendingApplicants: 1,
            filledPositions: 1,
          },
          schedule: {
            kind: "dated",
            primaryDate: "2026-04-01",
            allDates: ["2026-04-01"],
            requirements: [
              {
                date: "2026-04-01",
                timeSlots: [
                  {
                    startTime: "18:00",
                    roles: [{ role: "dealer", count: 1, filled: 1 }],
                  },
                ],
              },
            ],
          },
        }),
      );
      await setDoc(
        doc(db, "applications", "job-1_staff-1"),
        createCancellationPendingApplication(),
      );
      await setDoc(doc(db, "workLogs", "wl-dated-1"), {
        staffId: "staff-1",
        staffName: "Applicant",
        jobPostingId: "job-1",
        jobPostingName: "Canonical posting",
        ownerId: "employer-1",
        role: "dealer",
        customRole: null,
        date: "2026-04-01",
        timeSlot: "18:00",
        isTimeToBeAnnounced: false,
        tentativeDescription: null,
        status: "scheduled",
        checkInTime: null,
        checkOutTime: null,
        workDuration: null,
        payrollAmount: null,
        isSettled: false,
        assignmentGroupId: null,
        checkMethod: "individual",
        createdAt: Timestamp.fromDate(new Date("2026-04-01T10:30:00.000Z")),
        updatedAt: Timestamp.fromDate(new Date("2026-04-01T10:30:00.000Z")),
      });
    });

    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertSucceeds(
      runTransaction(employerDb, async (transaction) => {
        const jobRef = doc(employerDb, "jobPostings", "job-1");
        const applicationRef = doc(employerDb, "applications", "job-1_staff-1");
        const workLogRef = doc(employerDb, "workLogs", "wl-dated-1");

        await transaction.get(jobRef);
        await transaction.get(applicationRef);
        await transaction.get(workLogRef);

        transaction.update(applicationRef, {
          status: "cancelled",
          assignments: [
            {
              roleIds: ["dealer"],
              dates: ["2026-04-01"],
              timeSlot: "18:00",
              isGrouped: false,
              checkMethod: "individual",
            },
          ],
          confirmationHistory: [
            {
              confirmedAt: Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z")),
              confirmedBy: "employer-1",
              assignments: [
                {
                  roleIds: ["dealer"],
                  dates: ["2026-04-01"],
                  timeSlot: "18:00",
                  isGrouped: false,
                  checkMethod: "individual",
                },
              ],
              cancelledAt: Timestamp.fromDate(new Date("2026-04-01T12:00:00.000Z")),
              cancelledBy: "employer-1",
              cancelReason: "Need to cancel due to schedule conflict",
            },
          ],
          cancellationRequest: {
            requestedAt: Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z")),
            reason: "Need to cancel due to schedule conflict",
            status: "approved",
            reviewedAt: serverTimestamp(),
            reviewedBy: "employer-1",
          },
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(workLogRef, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });

        transaction.update(jobRef, {
          filledPositions: 0,
          schedule: {
            kind: "dated",
            primaryDate: "2026-04-01",
            allDates: ["2026-04-01"],
            requirements: [
              {
                date: "2026-04-01",
                timeSlots: [
                  {
                    startTime: "18:00",
                    roles: [{ role: "dealer", count: 1, filled: 0 }],
                  },
                ],
              },
            ],
          },
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("rejects direct client-side applicationCount updates on job postings", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(
      runTransaction(employerDb, async (transaction) => {
        const jobRef = doc(employerDb, "jobPostings", "job-1");
        await transaction.get(jobRef);

        transaction.update(jobRef, {
          applicationCount: 0,
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("rejects fixed workLog creation because dated workLogs are the only public canonical flow", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(
      setDoc(doc(employerDb, "workLogs", "wl-fixed-1"), {
        staffId: "staff-1",
        staffName: "Applicant",
        jobPostingId: "job-1",
        jobPostingName: "Canonical posting",
        ownerId: "employer-1",
        role: "dealer",
        customRole: null,
        date: null,
        timeSlot: null,
        isFixedPosting: true,
        status: "scheduled",
        checkInTime: null,
        checkOutTime: null,
        workDuration: null,
        payrollAmount: null,
        isSettled: false,
        checkMethod: "individual",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
