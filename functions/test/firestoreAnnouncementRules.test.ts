import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

const PROJECT_ID = "announcement-rules-test";
const RULES_PATH = resolve(__dirname, "..", "..", "firestore.rules");

function createUserProfile(
  userId: string,
  role: "staff" | "employer" | "admin" = "staff",
): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z"));

  return {
    uid: userId,
    email: `${userId}@example.com`,
    name: `${userId}-name`,
    role,
    phoneVerified: true,
    emailVerified: true,
    marketingAgreed: false,
    profileCompleted: true,
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
  };
}

function createAnnouncement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z"));

  return {
    jobPostingId: "job-1",
    title: "Important notice",
    message: "Bring your ID card.",
    createdBy: "employer-1",
    createdByName: "employer-1-name",
    targetStaffIds: ["staff-1"],
    sentCount: 1,
    failedCount: 0,
    status: "sent",
    createdAt,
    sentAt: createdAt,
    metadata: {
      jobPostingTitle: "Tournament Shift",
      location: "Seoul",
    },
    ...overrides,
  };
}

describe("Firestore announcement rules", () => {
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

      await setDoc(doc(db, "users", "staff-1"), createUserProfile("staff-1"));
      await setDoc(doc(db, "users", "staff-2"), createUserProfile("staff-2"));
      await setDoc(doc(db, "users", "employer-1"), createUserProfile("employer-1", "employer"));
      await setDoc(doc(db, "users", "admin-1"), createUserProfile("admin-1", "admin"));
      await setDoc(doc(db, "jobPostingAnnouncements", "announcement-1"), createAnnouncement());
    });
  });

  it("allows targeted staff to read their announcement", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(getDoc(doc(staffDb, "jobPostingAnnouncements", "announcement-1")));
  });

  it("rejects reads from untargeted staff", async () => {
    const staffDb = testEnv.authenticatedContext("staff-2").firestore();

    await assertFails(getDoc(doc(staffDb, "jobPostingAnnouncements", "announcement-1")));
  });

  it("allows privileged users to read announcements", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();
    const adminDb = testEnv.authenticatedContext("admin-1").firestore();

    await assertSucceeds(getDoc(doc(employerDb, "jobPostingAnnouncements", "announcement-1")));
    await assertSucceeds(getDoc(doc(adminDb, "jobPostingAnnouncements", "announcement-1")));
  });

  it("rejects staff collection queries while allowing privileged list access", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(getDocs(collection(staffDb, "jobPostingAnnouncements")));
    await assertSucceeds(getDocs(collection(employerDb, "jobPostingAnnouncements")));
  });

  it("rejects client-side create, update, and delete even for privileged users", async () => {
    const employerDb = testEnv.authenticatedContext("employer-1").firestore();

    await assertFails(
      setDoc(doc(employerDb, "jobPostingAnnouncements", "announcement-create"), {
        ...createAnnouncement(),
        createdAt: serverTimestamp(),
        sentAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(employerDb, "jobPostingAnnouncements", "announcement-1"), {
        status: "failed",
      }),
    );

    await assertFails(deleteDoc(doc(employerDb, "jobPostingAnnouncements", "announcement-1")));
  });
});
