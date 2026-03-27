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
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "user-draft-rules-test";
const RULES_PATH = resolve(__dirname, "..", "..", "firestore.rules");

function createUserProfile(
  userId: string,
  role: "staff" | "employer" | "admin" = "staff",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z"));

  return {
    uid: userId,
    email: `${userId}@example.com`,
    name: `${userId}-name`,
    role,
    phoneVerified: true,
    emailVerified: false,
    marketingAgreed: false,
    profileCompleted: false,
    isActive: true,
    bubbleScore: {
      score: 10,
      totalReviewCount: 1,
      positiveCount: 1,
      neutralCount: 0,
      negativeCount: 0,
      lastUpdatedAt: createdAt,
    },
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const lastSavedAt = Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z"));

  return {
    ownerId: "employer-1",
    step: 2,
    lastSavedAt,
    draft: {
      title: "Draft posting",
      postingType: "regular",
    },
    ...overrides,
  };
}

describe("Firestore user and jobPostingDraft rules", () => {
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

      await setDoc(doc(db, "users", "staff-1"), createUserProfile("staff-1"));
      await setDoc(doc(db, "users", "employer-1"), createUserProfile("employer-1", "employer"));
      await setDoc(doc(db, "jobPostingDrafts", "draft-1"), createDraft());
    });
  });

  it("allows self-service profile updates for allowlisted fields", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      updateDoc(doc(staffDb, "users", "staff-1"), {
        nickname: "테스터",
        marketingAgreed: true,
        profileCompleted: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("rejects self-service updates for trusted user fields", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertFails(
      updateDoc(doc(staffDb, "users", "staff-1"), {
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(staffDb, "users", "staff-1"), {
        phoneVerified: false,
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(staffDb, "users", "staff-1"), {
        emailVerified: true,
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(staffDb, "users", "staff-1"), {
        role: "employer",
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(staffDb, "users", "staff-1"), {
        bubbleScore: {
          score: 999,
          totalReviewCount: 999,
          positiveCount: 999,
          neutralCount: 0,
          negativeCount: 0,
          lastUpdatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows the consent-backed staff to employer registration transition", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      runTransaction(staffDb, async (transaction) => {
        const userRef = doc(staffDb, "users", "staff-1");
        const consentRef = doc(
          staffDb,
          "users",
          "staff-1",
          "consents",
          "employer_registration",
        );

        await transaction.get(userRef);

        transaction.update(userRef, {
          role: "employer",
          employerAgreements: {
            termsAgreedAt: serverTimestamp(),
            termsVersion: "2026-03",
            liabilityWaiverAgreedAt: serverTimestamp(),
            liabilityWaiverVersion: "2026-03",
          },
          employerRegisteredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.set(consentRef, {
          kind: "employer_registration",
          userId: "staff-1",
          agreedAt: serverTimestamp(),
          terms: {
            agreed: true,
            version: "2026-03",
            agreedAt: serverTimestamp(),
          },
          liabilityWaiver: {
            agreed: true,
            version: "2026-03",
            agreedAt: serverTimestamp(),
          },
        });
      }),
    );
  });

  it("allows employers to create and update canonical drafts", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertSucceeds(
      setDoc(doc(employerDb, "jobPostingDrafts", "draft-create-success"), {
        ownerId: "employer-1",
        step: 1,
        lastSavedAt: serverTimestamp(),
        draft: {
          title: "Fresh draft",
        },
      }),
    );

    await assertSucceeds(
      updateDoc(doc(employerDb, "jobPostingDrafts", "draft-1"), {
        step: 3,
        lastSavedAt: serverTimestamp(),
        draft: {
          title: "Updated draft",
        },
      }),
    );
  });

  it("rejects staff or malformed jobPostingDraft writes", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(
      setDoc(doc(staffDb, "jobPostingDrafts", "draft-staff"), {
        ownerId: "staff-1",
        step: 1,
        lastSavedAt: serverTimestamp(),
        draft: {
          title: "Staff draft",
        },
      }),
    );

    await assertFails(
      setDoc(doc(employerDb, "jobPostingDrafts", "draft-bad-shape"), {
        ownerId: "employer-1",
        step: "2",
        lastSavedAt: serverTimestamp(),
        draft: {
          title: "Bad draft",
        },
      }),
    );

    await assertFails(
      updateDoc(doc(employerDb, "jobPostingDrafts", "draft-1"), {
        ownerId: "other-owner",
        step: 4,
        lastSavedAt: serverTimestamp(),
        draft: {
          title: "Owner mismatch",
        },
      }),
    );
  });
});
