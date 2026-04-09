export const BOARD_FIXTURE_IDS = {
  freePost: 'seed-board-free-001',
  employerTdaPost: 'seed-board-tda-002',
  lockedFreePost: 'seed-board-free-locked-003',
  freeComment: 'seed-board-comment-001',
  freeReply: 'seed-board-reply-002',
  pendingCommentReport: 'seed-board-report-pending-001',
  resolvedPostReport: 'seed-board-report-resolved-002',
} as const;

export const BOARD_FIXTURE_CONTENT = {
  freeTitle: '[seed] Free board post',
  freeBody: 'Seeded free board content for Playwright coverage.',
  employerTdaTitle: '[seed] Employer TDA topic',
  employerTdaBody: 'Employer-authored TDA discussion seed for edit permission checks.',
  lockedFreeTitle: '[seed] Locked free post',
  lockedFreeBody: 'Locked seed post owned by the staff account.',
  commentBody: 'Seeded employer comment for report detail verification.',
  replyBody: 'Seeded staff reply for threaded comment coverage.',
  pendingReportReason: 'Pending board report reason',
  pendingReportDetails: 'Pending board report details for the seeded employer comment.',
  resolvedReportReason: 'Resolved board report reason',
  resolvedReportDetails: 'Resolved board report details for the seeded employer post.',
} as const;
