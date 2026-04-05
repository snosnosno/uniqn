import * as admin from "firebase-admin";
import { expect } from "chai";
import sinon from "sinon";

if (!admin.apps.length) {
  admin.initializeApp();
}

const { processScheduledDeletions } =
  require("../src/account/scheduledDeletion") as typeof import("../src/account/scheduledDeletion");

const PAST_DUE = admin.firestore.Timestamp.fromDate(
  new Date("2026-01-01T00:00:00.000Z"),
);
const FUTURE_DUE = admin.firestore.Timestamp.fromDate(
  new Date("2099-01-01T00:00:00.000Z"),
);

const TEST_USER_IDS = [
  "user-embed",
  "user-legacy",
  "user-active-legacy",
  "user-due-embedded",
  "user-future-embedded",
  "user-due-legacy",
  "user-future-legacy",
] as const;

function createDeletionRequest(
  userId: string,
  scheduledDeletionAt: admin.firestore.Timestamp,
): Record<string, unknown> {
  return {
    userId,
    reason: "other",
    requestedAt: admin.firestore.Timestamp.fromDate(
      new Date("2025-12-01T00:00:00.000Z"),
    ),
    scheduledDeletionAt,
    status: "pending",
  };
}

async function clearScheduledDeletionTestData(): Promise<void> {
  const db = admin.firestore();
  const batch = db.batch();

  batch.delete(db.collection("applications").doc("app-auth-fail"));

  TEST_USER_IDS.forEach((userId) => {
    batch.delete(
      db
        .collection("users")
        .doc(userId)
        .collection("deletionRequests")
        .doc("request-1"),
    );
    batch.delete(db.collection("users").doc(userId));
  });

  await batch.commit();
}

describe("scheduled account deletion", () => {
  beforeEach(async () => {
    await clearScheduledDeletionTestData();
  });

  afterEach(() => {
    sinon.restore();
  });

  after(async () => {
    await clearScheduledDeletionTestData();
  });

  it("preserves the embedded retry source when auth deletion fails", async () => {
    const db = admin.firestore();

    await db
      .collection("users")
      .doc("user-embed")
      .set({
        status: "deactivated",
        deletionRequest: createDeletionRequest("user-embed", PAST_DUE),
      });
    await db.collection("applications").doc("app-auth-fail").set({
      applicantId: "user-embed",
      applicantName: "Original Applicant",
      applicantPhone: "01012345678",
    });

    const deleteUserStub = sinon
      .stub(admin.auth(), "deleteUser")
      .rejects(new Error("auth unavailable"));

    await processScheduledDeletions.run({} as never);

    expect(deleteUserStub.calledOnce).to.equal(true);
    expect(deleteUserStub.firstCall.args[0]).to.equal("user-embed");

    const userDoc = await db.collection("users").doc("user-embed").get();
    expect(userDoc.exists).to.equal(true);
    expect(userDoc.get("deletionRequest.status")).to.equal("pending");

    const applicationDoc = await db
      .collection("applications")
      .doc("app-auth-fail")
      .get();
    expect(applicationDoc.get("applicantId")).to.equal("user-embed");
    expect(applicationDoc.get("applicantName")).to.equal("Original Applicant");
  });

  it("removes the legacy deletion request document together with the user document", async () => {
    const db = admin.firestore();

    await db.collection("users").doc("user-legacy").set({
      status: "deactivated",
      name: "Legacy User",
    });
    await db
      .collection("users")
      .doc("user-legacy")
      .collection("deletionRequests")
      .doc("request-1")
      .set(createDeletionRequest("user-legacy", PAST_DUE));

    const deleteUserStub = sinon.stub(admin.auth(), "deleteUser").resolves();

    await processScheduledDeletions.run({} as never);

    expect(deleteUserStub.calledOnce).to.equal(true);
    expect(deleteUserStub.firstCall.args[0]).to.equal("user-legacy");

    const userDoc = await db.collection("users").doc("user-legacy").get();
    const legacyRequestDoc = await db
      .collection("users")
      .doc("user-legacy")
      .collection("deletionRequests")
      .doc("request-1")
      .get();

    expect(userDoc.exists).to.equal(false);
    expect(legacyRequestDoc.exists).to.equal(false);
  });

  it("skips stale legacy deletion requests for active users", async () => {
    const db = admin.firestore();

    await db.collection("users").doc("user-active-legacy").set({
      status: "active",
      name: "Active User",
    });
    await db
      .collection("users")
      .doc("user-active-legacy")
      .collection("deletionRequests")
      .doc("request-1")
      .set(createDeletionRequest("user-active-legacy", PAST_DUE));

    const deleteUserStub = sinon.stub(admin.auth(), "deleteUser").resolves();

    await processScheduledDeletions.run({} as never);

    expect(deleteUserStub.called).to.equal(false);

    const userDoc = await db
      .collection("users")
      .doc("user-active-legacy")
      .get();
    const legacyRequestDoc = await db
      .collection("users")
      .doc("user-active-legacy")
      .collection("deletionRequests")
      .doc("request-1")
      .get();

    expect(userDoc.exists).to.equal(true);
    expect(userDoc.get("status")).to.equal("active");
    expect(legacyRequestDoc.exists).to.equal(true);
    expect(legacyRequestDoc.get("status")).to.equal("pending");
  });

  it("processes only due embedded and legacy deletion requests", async () => {
    const db = admin.firestore();

    await db
      .collection("users")
      .doc("user-due-embedded")
      .set({
        status: "deactivated",
        deletionRequest: createDeletionRequest("user-due-embedded", PAST_DUE),
      });
    await db
      .collection("users")
      .doc("user-future-embedded")
      .set({
        status: "deactivated",
        deletionRequest: createDeletionRequest(
          "user-future-embedded",
          FUTURE_DUE,
        ),
      });
    await db.collection("users").doc("user-due-legacy").set({
      status: "deactivated",
    });
    await db
      .collection("users")
      .doc("user-due-legacy")
      .collection("deletionRequests")
      .doc("request-1")
      .set(createDeletionRequest("user-due-legacy", PAST_DUE));
    await db.collection("users").doc("user-future-legacy").set({
      status: "deactivated",
    });
    await db
      .collection("users")
      .doc("user-future-legacy")
      .collection("deletionRequests")
      .doc("request-1")
      .set(createDeletionRequest("user-future-legacy", FUTURE_DUE));

    const deleteUserStub = sinon.stub(admin.auth(), "deleteUser").resolves();

    await processScheduledDeletions.run({} as never);

    expect(deleteUserStub.callCount).to.equal(2);
    expect(
      deleteUserStub
        .getCalls()
        .map((call) => call.args[0] as string)
        .sort(),
    ).to.deep.equal(["user-due-embedded", "user-due-legacy"]);

    const futureEmbeddedDoc = await db
      .collection("users")
      .doc("user-future-embedded")
      .get();
    const futureLegacyRequestDoc = await db
      .collection("users")
      .doc("user-future-legacy")
      .collection("deletionRequests")
      .doc("request-1")
      .get();

    expect(futureEmbeddedDoc.exists).to.equal(true);
    expect(futureLegacyRequestDoc.exists).to.equal(true);
  });
});
