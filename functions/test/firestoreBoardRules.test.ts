import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
} from "firebase/firestore";

const PROJECT_ID = "board-rules-test";
const RULES_PATH = resolve(__dirname, "..", "..", "firestore.rules");

function createUser(
  userId: string,
  role: "staff" | "employer" | "admin",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const createdAt = Timestamp.fromDate(new Date("2026-04-01T09:00:00.000Z"));

  return {
    uid: userId,
    email: `${userId}@example.com`,
    name: `${userId} name`,
    nickname: `${userId} nick`,
    role,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createExistingCommunityPost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const timestamp = Timestamp.fromDate(new Date("2026-04-01T10:00:00.000Z"));

  return {
    boardType: "free",
    source: "board",
    title: "Free board post",
    body: "Community post body",
    authorId: "employer-1",
    authorName: "employer one",
    authorRole: "employer",
    visibility: "public",
    status: "active",
    linkedJobPostingId: null,
    isAutoCreated: false,
    isLocked: false,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    viewCount: 0,
    imageAttachments: [],
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createExistingSchedulePost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const timestamp = Timestamp.fromDate(new Date("2026-04-02T10:00:00.000Z"));

  return {
    boardType: "schedule",
    source: "board",
    title: "Schedule board post",
    body: "Schedule board body",
    authorId: "employer-1",
    authorName: "employer one",
    authorRole: "employer",
    visibility: "participants_only",
    status: "active",
    linkedJobPostingId: "job-1",
    isAutoCreated: true,
    isLocked: false,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 1,
    viewCount: 0,
    imageAttachments: [],
    jobSummary: {
      jobPostingId: "job-1",
      title: "Schedule board post",
      workDate: "2026-04-10",
    },
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createExistingComment(
  postId: string,
  authorId: string,
  authorName: string,
  authorRole: "staff" | "employer" | "admin",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const timestamp = Timestamp.fromDate(new Date("2026-04-02T10:30:00.000Z"));

  return {
    postId,
    parentCommentId: null,
    body: "Existing comment body",
    authorId,
    authorName,
    authorRole,
    mentionedUserIds: [],
    reactionCounts: {},
    isPinned: false,
    pinnedAt: null,
    pinnedBy: null,
    status: "active",
    imageAttachments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createMembership(
  postId: string,
  userId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const timestamp = Timestamp.fromDate(new Date("2026-04-02T09:30:00.000Z"));

  return {
    boardType: "schedule",
    userId,
    postId,
    jobPostingId: "job-1",
    role: "confirmed",
    displayName: `${userId} name`,
    canRead: true,
    canComment: true,
    title: "Schedule board post",
    workDate: "2026-04-10",
    authorId: "employer-1",
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("Firestore board rules", () => {
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
      const schedulePostId = "schedule_job-1";

      await setDoc(
        doc(db, "users", "staff-1"),
        createUser("staff-1", "staff", {
          name: "staff one",
          nickname: "staffnick",
        }),
      );
      await setDoc(
        doc(db, "users", "employer-1"),
        createUser("employer-1", "employer", {
          name: "employer one",
          nickname: "ownernick",
        }),
      );
      await setDoc(
        doc(db, "users", "admin-1"),
        createUser("admin-1", "admin", {
          name: "admin one",
          nickname: "adminnick",
        }),
      );
      await setDoc(doc(db, "boardPosts", "free-post-1"), createExistingCommunityPost());
      await setDoc(doc(db, "boardPosts", schedulePostId), createExistingSchedulePost());
      await setDoc(
        doc(db, "boardPosts", schedulePostId, "comments", "comment-1"),
        createExistingComment(schedulePostId, "staff-1", "staff one", "staff"),
      );
      await setDoc(
        doc(db, "boardMemberships", `${schedulePostId}_staff-1`),
        createMembership(schedulePostId, "staff-1"),
      );
    });
  });

  it("board-read-direct", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(getDoc(doc(staffDb, "boardPosts", "free-post-1")));
  });

  it("board-list-query-shape", async () => {
    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertSucceeds(
      getDocs(
        query(
          collection(staffDb, "boardPosts"),
          where("boardType", "==", "free"),
          where("status", "in", ["active", "locked"]),
          orderBy("lastActivityAt", "desc"),
          limit(50),
        ),
      ),
    );
  });

  it("blocks schedule members without comment rights from editing their own comment", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(
        doc(db, "boardMemberships", "schedule_job-1_staff-1"),
        createMembership("schedule_job-1", "staff-1", {
          canComment: false,
          updatedAt: Timestamp.fromDate(new Date("2026-04-02T11:00:00.000Z")),
        }),
      );
    });

    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertFails(
      updateDoc(doc(staffDb, "boardPosts", "schedule_job-1", "comments", "comment-1"), {
        body: "Edited comment body",
        imageAttachments: [],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("blocks schedule members without comment rights from deleting their own comment", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(
        doc(db, "boardMemberships", "schedule_job-1_staff-1"),
        createMembership("schedule_job-1", "staff-1", {
          canComment: false,
          updatedAt: Timestamp.fromDate(new Date("2026-04-02T11:00:00.000Z")),
        }),
      );
    });

    const staffDb = testEnv.authenticatedContext("staff-1").firestore();

    await assertFails(
      updateDoc(doc(staffDb, "boardPosts", "schedule_job-1", "comments", "comment-1"), {
        status: "deleted",
        body: "Deleted comment",
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
        imageAttachments: [],
        mentionedUserIds: [],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("still allows admins to hide a locked schedule comment", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(
        doc(db, "boardPosts", "schedule_job-1"),
        createExistingSchedulePost({
          isLocked: true,
          updatedAt: Timestamp.fromDate(new Date("2026-04-02T11:30:00.000Z")),
        }),
      );
    });

    const adminDb = testEnv.authenticatedContext("admin-1").firestore();

    await assertSucceeds(
      runTransaction(adminDb, async (transaction) => {
        transaction.update(doc(adminDb, "boardPosts", "schedule_job-1", "comments", "comment-1"), {
          status: "hidden",
          body: "Hidden by admin",
          isPinned: false,
          pinnedAt: null,
          pinnedBy: null,
          imageAttachments: [],
          mentionedUserIds: [],
          updatedAt: serverTimestamp(),
        });
        transaction.update(doc(adminDb, "boardPosts", "schedule_job-1"), {
          commentCount: 0,
          lastActivityAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });
});
