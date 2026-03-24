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
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "job-posting-rules-test";
const RULES_PATH = resolve(__dirname, "..", "..", "firestore.rules");

function createCanonicalJobPosting(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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
    createdAt: Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z")),
    updatedAt: Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z")),
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
    fixedConfig: {
      durationDays: 7,
      createdAt,
      expiresAt: Timestamp.fromDate(new Date("2026-04-08T09:00:00.000Z")),
    },
    ...overrides,
  };
}

describe("Firestore jobPosting canonical rules", () => {
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

      await setDoc(doc(db, "users", "employer-1"), {
        role: "employer",
      });

      await setDoc(doc(db, "users", "staff-1"), {
        role: "staff",
      });

      await setDoc(
        doc(db, "jobPostings", "job-1"),
        createCanonicalJobPosting({
          searchIndex: ["canonical", "posting"],
        }),
      );
    });
  });

  it("allows canonical V3 creates with only contract fields", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertSucceeds(
      setDoc(
        doc(employerDb, "jobPostings", "job-create-success"),
        createCanonicalJobPosting(),
      ),
    );
  });

  it("rejects client writes that add non-canonical top-level fields or derived searchIndex", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(
      setDoc(
        doc(employerDb, "jobPostings", "job-create-legacy"),
        createCanonicalJobPosting({
          unexpectedField: "not-allowed",
          searchIndex: ["canonical", "posting"],
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(employerDb, "jobPostings", "job-create-closed"),
        createCanonicalJobPosting({
          status: "closed",
        }),
      ),
    );
  });

  it("rejects malformed nested canonical schedule shapes", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(
      setDoc(
        doc(employerDb, "jobPostings", "job-create-bad-schedule"),
        createCanonicalJobPosting({
          schedule: {
            kind: "dated",
            primaryDate: "2026-04-01",
            requirements: [],
          },
        }),
      ),
    );
  });

  it("rejects postingType/schedule mismatches, invalid fixed durations, and non-canonical location keys", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(
      setDoc(
        doc(employerDb, "jobPostings", "job-create-mismatch"),
        createCanonicalJobPosting({
          postingType: "fixed",
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(employerDb, "jobPostings", "job-create-fixed-duration"),
        createCanonicalFixedJobPosting({
          fixedConfig: {
            durationDays: 30,
            createdAt: Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z")),
            expiresAt: Timestamp.fromDate(new Date("2026-05-01T09:00:00.000Z")),
          },
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(employerDb, "jobPostings", "job-create-location-shape"),
        createCanonicalJobPosting({
          location: {
            name: "Seoul",
            district: "Gangnam-gu",
            address: "Gangnam-daero",
          },
        }),
      ),
    );
  });

  it("allows safe owner updates on docs with derived searchIndex, rejects immutable rewrites, and allows signed-in viewCount increments", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      updateDoc(doc(employerDb, "jobPostings", "job-1"), {
        status: "closed",
      }),
    );

    await assertFails(
      updateDoc(doc(employerDb, "jobPostings", "job-1"), {
        createdAt: Timestamp.fromDate(new Date("2026-05-01T09:00:00.000Z")),
      }),
    );

    await assertFails(
      updateDoc(doc(employerDb, "jobPostings", "job-1"), {
        schedule: {
          kind: "fixed",
          daysPerWeek: 5,
          roleRequirements: [{ role: "dealer", count: 1, filled: 0 }],
        },
      }),
    );

    await assertFails(
      updateDoc(doc(employerDb, "jobPostings", "job-1"), {
        searchIndex: ["tampered"],
      }),
    );

    await assertSucceeds(
      updateDoc(doc(staffDb, "jobPostings", "job-1"), {
        viewCount: 1,
      }),
    );
  });
});
