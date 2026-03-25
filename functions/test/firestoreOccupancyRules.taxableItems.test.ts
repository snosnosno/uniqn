import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "occupancy-rules-taxable-items-test";
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

function createWorkLog(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
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
    status: "checked_out",
    checkInTime: Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z")),
    checkOutTime: Timestamp.fromDate(new Date("2026-04-01T18:00:00.000Z")),
    workDuration: 9,
    payrollAmount: null,
    payrollStatus: "pending",
    isSettled: false,
    assignmentGroupId: null,
    checkMethod: "individual",
    createdAt: Timestamp.fromDate(new Date("2026-04-01T10:30:00.000Z")),
    updatedAt: Timestamp.fromDate(new Date("2026-04-01T10:30:00.000Z")),
    ...overrides,
  };
}

describe("Firestore occupancy rules taxableItems contract", () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
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
      await setDoc(doc(db, "workLogs", "wl-owner-custom-tax"), createWorkLog());
    });
  });

  it("rejects owner custom settlement updates with non-canonical taxableItems keys", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(
      updateDoc(doc(employerDb, "workLogs", "wl-owner-custom-tax"), {
        customTaxSettings: {
          type: "rate",
          value: 3.3,
          taxableItems: {
            basePay: true,
            unexpected: true,
          },
        },
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
