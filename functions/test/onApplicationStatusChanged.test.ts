import * as admin from "firebase-admin";
import { expect } from "chai";
import sinon from "sinon";

if (!admin.apps.length) {
  admin.initializeApp();
}

const notificationUtils =
  require("../src/utils/notificationUtils") as typeof import("../src/utils/notificationUtils");
const { onApplicationStatusChanged } =
  require("../src/notifications/onApplicationStatusChanged") as typeof import("../src/notifications/onApplicationStatusChanged");

function createUpdatedEvent(
  applicationId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
) {
  return {
    params: { applicationId },
    data: {
      before: { data: () => before },
      after: { data: () => after },
    },
  };
}

async function seedJobPosting(jobPostingId: string) {
  await admin.firestore().collection("jobPostings").doc(jobPostingId).set({
    title: "Spring Poker Event",
    location: {
      name: "Seoul",
      district: "Gangnam-gu",
    },
    ownerId: "owner-1",
  });
}

describe("onApplicationStatusChanged", () => {
  beforeEach(async () => {
    await seedJobPosting("job-1");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("sends only the cancellation approved notification with the schedule deeplink", async () => {
    const sendStub = sinon
      .stub(notificationUtils, "createAndSendNotification")
      .resolves({ notificationId: "notif-approved" } as never);

    await onApplicationStatusChanged.run(
      createUpdatedEvent(
        "app-1",
        {
          applicantId: "staff-1",
          jobPostingId: "job-1",
          status: "cancellation_pending",
          cancellationRequest: {
            status: "pending",
            reason: "Emergency",
          },
        },
        {
          applicantId: "staff-1",
          jobPostingId: "job-1",
          status: "cancelled",
          cancellationRequest: {
            status: "approved",
            reason: "Emergency",
          },
        },
      ) as never,
    );

    expect(sendStub.calledOnce).to.equal(true);
    const recipientId = sendStub.firstCall.args[0];
    const type = sendStub.firstCall.args[1];
    const options = sendStub.firstCall.args[4]!;

    expect(recipientId).to.equal("staff-1");
    expect(type).to.equal("cancellation_approved");
    expect(options.link).to.equal("/schedule");
    expect(options.relatedId).to.equal("app-1");
    expect(options.data?.applicationId).to.equal("app-1");
    expect(options.data?.jobPostingId).to.equal("job-1");
  });

  it("sends only the cancellation rejected notification with rejection details", async () => {
    const sendStub = sinon
      .stub(notificationUtils, "createAndSendNotification")
      .resolves({ notificationId: "notif-rejected" } as never);

    await onApplicationStatusChanged.run(
      createUpdatedEvent(
        "app-2",
        {
          applicantId: "staff-2",
          jobPostingId: "job-1",
          status: "cancellation_pending",
          cancellationRequest: {
            status: "pending",
            reason: "Schedule conflict",
          },
        },
        {
          applicantId: "staff-2",
          jobPostingId: "job-1",
          status: "confirmed",
          cancellationRequest: {
            status: "rejected",
            reason: "Schedule conflict",
            rejectionReason: "Replacement unavailable",
          },
        },
      ) as never,
    );

    expect(sendStub.calledOnce).to.equal(true);
    const recipientId = sendStub.firstCall.args[0];
    const type = sendStub.firstCall.args[1];
    const options = sendStub.firstCall.args[4]!;

    expect(recipientId).to.equal("staff-2");
    expect(type).to.equal("cancellation_rejected");
    expect(options.link).to.equal("/schedule");
    expect(options.priority).to.equal("high");
    expect(options.data?.rejectionReason).to.equal("Replacement unavailable");
  });
});
