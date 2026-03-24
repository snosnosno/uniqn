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

const PROJECT_ID = "application-lifecycle-rules-test";
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

describe("application lifecycle rules", () => {
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

  it("allows owner confirmation transactions for canonical application updates", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();
    const confirmedAt = Timestamp.fromDate(new Date("2026-04-01T11:00:00.000Z"));

    await assertSucceeds(
      runTransaction(employerDb, async (transaction) => {
        const applicationRef = doc(employerDb, "applications", "job-1_staff-1");

        await transaction.get(applicationRef);

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
      }),
    );
  });

  it("rejects owner confirmation transactions that also tamper with applicant fields", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();
    const confirmedAt = Timestamp.fromDate(new Date("2026-04-01T11:00:00.000Z"));

    await assertFails(
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
          applicantName: "Tampered applicant",
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
});
