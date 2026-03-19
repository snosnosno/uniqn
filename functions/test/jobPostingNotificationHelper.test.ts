import { expect } from "chai";
import {
  collectApplicantIds,
  notifyApplicantsForJobPostingChange,
  summarizeNotificationResults,
} from "../src/notifications/jobPostingNotificationHelper";
import type { NotificationResult } from "../src/utils/notificationUtils";

describe("jobPostingNotificationHelper", () => {
  it("deduplicates applicant ids", () => {
    const applicantIds = collectApplicantIds([
      { applicantId: "user-1" },
      { applicantId: "user-2" },
      { applicantId: "user-1" },
      {},
    ]);

    expect(applicantIds).to.deep.equal(["user-1", "user-2"]);
  });

  it("returns skipped when there are no applicants and does not call broadcast", async () => {
    let broadcastCalled = false;

    const result = await notifyApplicantsForJobPostingChange(
      "job-1",
      {
        type: "job_updated",
        title: "title",
        body: "body",
      },
      "공고 수정",
      {
        fetchApplications: async () => [],
        broadcast: async () => {
          broadcastCalled = true;
          return new Map();
        },
      },
    );

    expect(result.skipped).to.equal(true);
    expect(result.totalApplicants).to.equal(0);
    expect(broadcastCalled).to.equal(false);
  });

  it("aggregates success and failure counts from broadcast results", async () => {
    const resultMap = new Map<string, NotificationResult>([
      [
        "user-1",
        {
          notificationId: "n1",
          fcmSent: true,
          successCount: 1,
          failureCount: 0,
        },
      ],
      [
        "user-2",
        {
          notificationId: "n2",
          fcmSent: false,
          successCount: 0,
          failureCount: 2,
        },
      ],
    ]);

    const summary = summarizeNotificationResults(resultMap);

    expect(summary.totalSuccess).to.equal(1);
    expect(summary.totalFailure).to.equal(2);
  });

  it("passes deduped recipients and spec through to broadcast", async () => {
    let receivedRecipientIds: string[] = [];
    let receivedType = "";
    let receivedTitle = "";
    let receivedBody = "";

    const result = await notifyApplicantsForJobPostingChange(
      "job-2",
      {
        type: "job_closed",
        title: "마감",
        body: "본문",
        options: {
          link: "/jobs/job-2",
        },
      },
      "공고 마감",
      {
        fetchApplications: async () => [
          { applicantId: "user-1" },
          { applicantId: "user-2" },
          { applicantId: "user-1" },
        ],
        broadcast: async (recipientIds, type, title, body) => {
          receivedRecipientIds = recipientIds;
          receivedType = type;
          receivedTitle = title;
          receivedBody = body;

          return new Map(
            recipientIds.map((recipientId) => [
              recipientId,
              {
                notificationId: `notification-${recipientId}`,
                fcmSent: true,
                successCount: 1,
                failureCount: 0,
              },
            ]),
          );
        },
      },
    );

    expect(receivedRecipientIds).to.deep.equal(["user-1", "user-2"]);
    expect(receivedType).to.equal("job_closed");
    expect(receivedTitle).to.equal("마감");
    expect(receivedBody).to.equal("본문");
    expect(result.totalApplicants).to.equal(2);
    expect(result.totalSuccess).to.equal(2);
    expect(result.totalFailure).to.equal(0);
    expect(result.skipped).to.equal(false);
  });
});
