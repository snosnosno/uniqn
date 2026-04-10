export const BOARD_NOTICE_PREFIX = 'notice_';
export const SCHEDULE_BOARD_ID_PREFIX = 'schedule_';

export function buildBoardNoticePostId(announcementId: string): string {
  return `${BOARD_NOTICE_PREFIX}${announcementId}`;
}

export function buildScheduleBoardPostId(jobPostingId: string): string {
  return `${SCHEDULE_BOARD_ID_PREFIX}${jobPostingId}`;
}

export function isBoardNoticePostId(postId: string): boolean {
  return postId.startsWith(BOARD_NOTICE_PREFIX);
}

export function extractAnnouncementIdFromBoardPostId(postId: string): string {
  return postId.replace(BOARD_NOTICE_PREFIX, '');
}
