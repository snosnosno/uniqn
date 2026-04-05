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
  updateDoc,
  Timestamp,
} from "firebase/firestore";

const PROJECT_ID = "application-rules-test";
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
      totalApplicants: 0,
      activeApplicants: 0,
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

function createCanonicalFixedJobPosting(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z"));

  return {
    schemaVersion: 3,
    title: "Canonical fixed posting",
    status: "active",
    ownerId: "employer-1",
    ownerName: "Owner",
    postingType: "fixed",
    workDate: "",
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
    createdAt,
    updatedAt: createdAt,
    location: {
      name: "Seoul",
      district: "Gangnam-gu",
    },
    schedule: {
      kind: "fixed",
      daysPerWeek: 5,
      startTime: "18:00",
      isStartTimeNegotiable: false,
      roleRequirements: [{ role: "dealer", count: 1, filled: 0 }],
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
    recruitmentType: "event",
    assignments: [
      {
        roleIds: ["dealer"],
        dates: ["2026-04-01"],
        timeSlot: "18:00",
        isGrouped: false,
        checkMethod: "individual",
      },
    ],
    isRead: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createFixedApplication(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z"));

  return {
    applicantId: "staff-1",
    applicantName: "Applicant",
    jobPostingId: "job-fixed",
    status: "applied",
    recruitmentType: "fixed",
    assignments: [
      {
        roleIds: ["dealer"],
        dates: ["FIXED_SCHEDULE"],
        timeSlot: "18:00",
        isGrouped: false,
        checkMethod: "individual",
      },
    ],
    isRead: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("Firestore application rules", () => {
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
    });
  });

  it("allows an applicant transaction to read their missing application slot and create the application", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      runTransaction(staffDb, async (transaction) => {
        const jobRef = doc(staffDb, "jobPostings", "job-1");
        const applicationRef = doc(staffDb, "applications", "job-1_staff-1");

        await transaction.get(jobRef);
        await transaction.get(applicationRef);

        transaction.set(applicationRef, {
          ...createApplication(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("allows an applicant to cancel their own applied application", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "applications", "job-1_staff-1"), createApplication());
    });

    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      runTransaction(staffDb, async (transaction) => {
        const applicationRef = doc(staffDb, "applications", "job-1_staff-1");
        await transaction.get(applicationRef);
        transaction.update(applicationRef, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("allows an applicant to request cancellation for a confirmed application", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(
        doc(db, "applications", "job-1_staff-1"),
        createApplication({ status: "confirmed" }),
      );
    });

    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      runTransaction(staffDb, async (transaction) => {
        const applicationRef = doc(staffDb, "applications", "job-1_staff-1");
        await transaction.get(applicationRef);
        transaction.update(applicationRef, {
          status: "cancellation_pending",
          cancellationRequest: {
            requestedAt: serverTimestamp(),
            reason: "Need to cancel due to schedule conflict",
            status: "pending",
          },
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("allows an applicant transaction to create a fixed application", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "jobPostings", "job-fixed"), createCanonicalFixedJobPosting());
    });

    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      runTransaction(staffDb, async (transaction) => {
        const jobRef = doc(staffDb, "jobPostings", "job-fixed");
        const applicationRef = doc(staffDb, "applications", "job-fixed_staff-1");

        await transaction.get(jobRef);
        await transaction.get(applicationRef);

        transaction.set(applicationRef, {
          ...createFixedApplication(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("rejects cancellation requests for confirmed fixed applications", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "jobPostings", "job-fixed"), createCanonicalFixedJobPosting());
      await setDoc(
        doc(db, "applications", "job-fixed_staff-1"),
        createFixedApplication({ status: "confirmed" }),
      );
    });

    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertFails(
      runTransaction(staffDb, async (transaction) => {
        const applicationRef = doc(staffDb, "applications", "job-fixed_staff-1");
        await transaction.get(applicationRef);
        transaction.update(applicationRef, {
          status: "cancellation_pending",
          cancellationRequest: {
            requestedAt: serverTimestamp(),
            reason: "Need to cancel due to schedule conflict",
            status: "pending",
          },
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("allows an applicant to reapply after a cancelled application", async () => {
    const originalCreatedAt = Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z"));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(
        doc(db, "applications", "job-1_staff-1"),
        createApplication({ status: "cancelled", createdAt: originalCreatedAt, updatedAt: originalCreatedAt }),
      );
    });

    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      runTransaction(staffDb, async (transaction) => {
        const applicationRef = doc(staffDb, "applications", "job-1_staff-1");
        await transaction.get(applicationRef);
        transaction.set(applicationRef, {
          ...createApplication({
            applicantName: "Applicant Retry",
            message: "Retrying after a cancellation",
            createdAt: originalCreatedAt,
            updatedAt: originalCreatedAt,
          }),
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it("rejects arbitrary applicant status tampering", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "applications", "job-1_staff-1"), createApplication());
    });

    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertFails(
      updateDoc(doc(staffDb, "applications", "job-1_staff-1"), {
        status: "rejected",
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
