import * as admin from "firebase-admin";
import { expect } from "chai";
import sinon from "sinon";

if (!admin.apps.length) {
  admin.initializeApp();
}

const { STATUS } =
  require("../src/constants/status") as typeof import("../src/constants/status");
const notificationHelper =
  require("../src/notifications/jobPostingNotificationHelper") as typeof import("../src/notifications/jobPostingNotificationHelper");
const { onJobPostingClosed } =
  require("../src/notifications/onJobPostingClosed") as typeof import("../src/notifications/onJobPostingClosed");
const { onJobPostingCancelled } =
  require("../src/notifications/onJobPostingCancelled") as typeof import("../src/notifications/onJobPostingCancelled");
const { onJobPostingUpdated } =
  require("../src/notifications/onJobPostingUpdated") as typeof import("../src/notifications/onJobPostingUpdated");

function createUpdatedEvent(
  jobPostingId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
) {
  return {
    params: { jobPostingId },
    data: {
      before: { data: () => before },
      after: { data: () => after },
    },
  };
}

const DEFAULT_DISPATCH_RESULT: import("../src/notifications/jobPostingNotificationHelper").JobPostingNotificationDispatchResult =
  {
    applicantIds: [],
    totalApplicants: 0,
    totalSuccess: 0,
    totalFailure: 0,
    skipped: false,
  };

describe("job posting notification entry triggers", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("skips closed notifications when status did not change to closed", async () => {
    const notifyStub = sinon
      .stub(notificationHelper, "notifyApplicantsForJobPostingChange")
      .resolves(DEFAULT_DISPATCH_RESULT);

    await onJobPostingClosed.run(
      createUpdatedEvent(
        "job-1",
        { status: STATUS.JOB_POSTING.ACTIVE },
        { status: STATUS.JOB_POSTING.ACTIVE, title: "봄 공고" },
      ) as never,
    );

    expect(notifyStub.called).to.equal(false);
  });

  it("dispatches closed notifications with the fixed payload title", async () => {
    const notifyStub = sinon
      .stub(notificationHelper, "notifyApplicantsForJobPostingChange")
      .resolves(DEFAULT_DISPATCH_RESULT);

    await onJobPostingClosed.run(
      createUpdatedEvent(
        "job-1",
        { status: STATUS.JOB_POSTING.ACTIVE },
        { status: STATUS.JOB_POSTING.CLOSED, title: "봄 공고" },
      ) as never,
    );

    expect(notifyStub.calledOnce).to.equal(true);
    const [jobPostingId, spec, logLabel] = notifyStub.firstCall.args;

    expect(jobPostingId).to.equal("job-1");
    expect(spec.type).to.equal("job_closed");
    expect(spec.title).to.equal("📋 공고 마감 안내");
    expect(spec.options?.link).to.equal("/jobs/job-1");
    expect(spec.options?.data?.jobPostingId).to.equal("job-1");
    expect(spec.options?.data?.jobPostingTitle).to.equal("봄 공고");
    expect(logLabel).to.equal("공고 마감");
  });

  it("dispatches cancelled notifications with the fixed payload title", async () => {
    const notifyStub = sinon
      .stub(notificationHelper, "notifyApplicantsForJobPostingChange")
      .resolves(DEFAULT_DISPATCH_RESULT);

    await onJobPostingCancelled.run(
      createUpdatedEvent(
        "job-2",
        { status: STATUS.JOB_POSTING.ACTIVE },
        { status: STATUS.JOB_POSTING.CANCELLED, title: "취소 공고" },
      ) as never,
    );

    expect(notifyStub.calledOnce).to.equal(true);
    const [jobPostingId, spec, logLabel] = notifyStub.firstCall.args;

    expect(jobPostingId).to.equal("job-2");
    expect(spec.type).to.equal("job_cancelled");
    expect(spec.title).to.equal("🚫 공고 취소");
    expect(spec.options?.link).to.equal("/schedule");
    expect(spec.options?.priority).to.equal("high");
    expect(spec.options?.data?.jobPostingTitle).to.equal("취소 공고");
    expect(logLabel).to.equal("공고 취소");
  });

  it("skips updated notifications when only unrelated fields changed", async () => {
    const notifyStub = sinon
      .stub(notificationHelper, "notifyApplicantsForJobPostingChange")
      .resolves(DEFAULT_DISPATCH_RESULT);

    await onJobPostingUpdated.run(
      createUpdatedEvent(
        "job-3",
        { title: "원본", updatedAt: "before" },
        { title: "원본", updatedAt: "after" },
      ) as never,
    );

    expect(notifyStub.called).to.equal(false);
  });

  it("dispatches updated notifications with changed field metadata", async () => {
    const notifyStub = sinon
      .stub(notificationHelper, "notifyApplicantsForJobPostingChange")
      .resolves(DEFAULT_DISPATCH_RESULT);

    await onJobPostingUpdated.run(
      createUpdatedEvent(
        "job-4",
        { title: "원본 공고", location: "서울" },
        { title: "수정 공고", location: "서울" },
      ) as never,
    );

    expect(notifyStub.calledOnce).to.equal(true);
    const [jobPostingId, spec, logLabel] = notifyStub.firstCall.args;

    expect(jobPostingId).to.equal("job-4");
    expect(spec.type).to.equal("job_updated");
    expect(spec.title).to.equal("📝 공고 수정 안내");
    expect(spec.options?.link).to.equal("/jobs/job-4");
    expect(spec.options?.data?.jobPostingId).to.equal("job-4");
    expect(spec.options?.data?.jobPostingTitle).to.equal("수정 공고");
    expect(spec.options?.data?.changedFields).to.equal("title");
    expect(logLabel).to.equal("공고 수정");
  });
});
