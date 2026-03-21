import * as admin from "firebase-admin";
import { expect } from "chai";

if (!admin.apps.length) {
  admin.initializeApp();
}

const indexExports = require("../src/index") as typeof import("../src/index");

const EXPECTED_EXPORTS = [
  "approveJobPosting",
  "checkEmailExists",
  "checkNicknameExists",
  "checkPhoneExists",
  "cleanupExpiredTokensScheduled",
  "cleanupOrphanAccountsScheduled",
  "cleanupRateLimitsScheduled",
  "createUserAccount",
  "decrementUnreadCounter",
  "deleteUser",
  "expireByLastWorkDate",
  "expireFixedPostings",
  "forceDeleteAccount",
  "getDashboardStats",
  "initializeUnreadCounter",
  "logAction",
  "logActionHttp",
  "manualExpireFixedPostings",
  "onApplicationStatusChanged",
  "onApplicationSubmitted",
  "onCheckInOut",
  "onFixedPostingExpired",
  "onInquiryCreated",
  "onJobPostingCancelled",
  "onJobPostingClosed",
  "onJobPostingOGSync",
  "onJobPostingUpdated",
  "onNegativeSettlement",
  "onNoShow",
  "onNotificationDeleted",
  "onNotificationRead",
  "onReportCreated",
  "onReviewCreated",
  "onScheduleCancelled",
  "onScheduleCreated",
  "onSettlementCompleted",
  "onTournamentApprovalChange",
  "onTournamentPostingCreated",
  "onUserRoleChange",
  "onWorkDateExpired",
  "onWorkTimeChanged",
  "processRegistration",
  "processScheduledDeletions",
  "recordLoginFailure",
  "rejectJobPosting",
  "requestRegistration",
  "resubmitJobPosting",
  "resetUnreadCounter",
  "retryFailedCounterOpsScheduled",
  "revokeAppleToken",
  "sendJobPostingAnnouncement",
  "sendLoginNotification",
  "sendReviewRemindersScheduled",
  "sendSystemAnnouncement",
  "updateEventParticipantCount",
  "updateJobPostingApplicantCount",
  "updateUser",
  "validateJobPostingData",
  "verifyAndSaveProfile",
];

describe("root function exports", () => {
  it("exposes the full public Firebase function surface through domain barrels", () => {
    const exportKeys = Object.keys(indexExports)
      .filter((key) => key !== "__esModule")
      .sort();

    expect(exportKeys).to.deep.equal(EXPECTED_EXPORTS.slice().sort());
  });
});
