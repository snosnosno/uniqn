import * as admin from "firebase-admin";
import { expect } from "chai";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (!admin.apps.length) {
  admin.initializeApp();
}

const distIndexPath = resolve(__dirname, "../lib/index.js");
const sourceIndexPath = resolve(__dirname, "../src/index");
const sourceExports = require(sourceIndexPath) as typeof import("../src/index");
const indexExports = require(
  existsSync(distIndexPath) ? distIndexPath : sourceIndexPath,
) as typeof import("../src/index");

const EXPECTED_EXPORTS = [
  "approveJobPosting",
  "buildPostingStats",
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
  "onBoardCommentCreated",
  "onBoardPostLocked",
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
  "syncApplicationCompletionFromWorkLogs",
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

  it("keeps the built entrypoint in sync with the source barrel when lib exists", () => {
    if (!existsSync(distIndexPath)) {
      return;
    }

    const distExportKeys = Object.keys(indexExports)
      .filter((key) => key !== "__esModule")
      .sort();
    const sourceExportKeys = Object.keys(sourceExports)
      .filter((key) => key !== "__esModule")
      .sort();

    expect(distExportKeys).to.deep.equal(sourceExportKeys);
  });
});
