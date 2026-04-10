import { toDate } from '@/utils/date';
import {
  BOARD_NOTICE_PREFIX,
  SCHEDULE_BOARD_ID_PREFIX,
  buildBoardNoticePostId,
  buildScheduleBoardPostId,
  isBoardNoticePostId,
  extractAnnouncementIdFromBoardPostId,
} from '@/shared/board/boardIds';
import type { FirebaseDocument } from './common';
import type { Announcement, AnnouncementCategory, AnnouncementImage } from './announcement';
import type { UserRole } from './role';

export type BoardType = 'notice' | 'schedule' | 'free' | 'tda';
export type BoardSource = 'board' | 'announcement';
export type BoardVisibility = 'public' | 'participants_only';
export type BoardPostStatus = 'active' | 'locked' | 'hidden' | 'archived';
export type BoardCommentStatus = 'active' | 'hidden' | 'deleted';
export type BoardVoteType = 'like' | 'dislike';
export type BoardMemberRole = 'author' | 'confirmed' | 'admin';
export type BoardReportTargetType = 'post' | 'comment';
export type BoardReportStatus = 'pending' | 'resolved' | 'dismissed';
export type BoardAuthorRole = UserRole | 'system';

export type CommentReactionType = 'thumbs_up' | 'heart' | 'laugh' | 'surprised' | 'sad' | 'angry';

export type BoardImageAttachment = AnnouncementImage;

export interface BoardJobSummary {
  jobPostingId: string;
  title: string;
  workDate: string;
  workDates?: string[];
  locationName?: string;
  totalPositions?: number;
  filledPositions?: number;
  compensationLabel?: string;
  jobPostingStatus?: string;
}

export interface BoardPost extends FirebaseDocument {
  boardType: BoardType;
  source: BoardSource;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: BoardAuthorRole;
  visibility: BoardVisibility;
  status: BoardPostStatus;
  linkedJobPostingId?: string | null;
  isAutoCreated: boolean;
  isLocked: boolean;
  lockedBy?: string | null;
  lockedAt?: Date | null;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  viewCount: number;
  imageAttachments: BoardImageAttachment[];
  lastActivityAt?: Date | null;
  announcementCategory?: AnnouncementCategory;
  isPinned?: boolean;
  jobSummary?: BoardJobSummary;
}

export interface BoardComment extends FirebaseDocument {
  postId: string;
  parentCommentId?: string | null;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: BoardAuthorRole;
  mentionedUserIds: string[];
  reactionCounts: Partial<Record<CommentReactionType, number>>;
  isPinned: boolean;
  pinnedAt?: Date | null;
  pinnedBy?: string | null;
  status: BoardCommentStatus;
  imageAttachments: BoardImageAttachment[];
}

export interface BoardCommentNode extends BoardComment {
  children: BoardCommentNode[];
}

export interface BoardVote extends FirebaseDocument {
  postId: string;
  userId: string;
  type: BoardVoteType;
}

export interface BoardCommentReaction extends FirebaseDocument {
  commentId: string;
  userId: string;
  type: CommentReactionType;
}

export interface BoardMembership extends FirebaseDocument {
  boardType: 'schedule';
  userId: string;
  postId: string;
  jobPostingId: string;
  role: BoardMemberRole;
  displayName?: string;
  canRead: boolean;
  canComment: boolean;
  title: string;
  workDate: string;
  authorId: string;
  lastActivityAt?: Date | null;
}

export interface BoardReport extends FirebaseDocument {
  targetType: BoardReportTargetType;
  targetId: string;
  postId: string;
  reporterId: string;
  reason: string;
  details?: string;
  status: BoardReportStatus;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
}

export type BoardReportFilterStatus = BoardReportStatus | 'all';
export type BoardReportResolutionStatus = Extract<BoardReportStatus, 'resolved' | 'dismissed'>;

export interface BoardAdminReportRecord {
  report: BoardReport;
  post: BoardPost | null;
  targetComment: BoardComment | null;
  reporterName: string;
  reporterRole: BoardAuthorRole;
  targetAuthorId?: string;
  targetAuthorName?: string;
}

export interface BoardHomeData {
  pinnedNotices: BoardPost[];
  recentSchedulePosts: BoardPost[];
  popularCommunityPosts: BoardPost[];
}

export interface BoardMentionCandidate {
  userId: string;
  displayName: string;
  role: BoardAuthorRole;
  isAuthor: boolean;
}

export interface FetchBoardPostsInput {
  boardType: BoardType;
  viewerId?: string;
  viewerRole?: UserRole | null;
  isAdmin?: boolean;
  limitCount?: number;
}

export interface CreateBoardPostInput {
  boardType: Extract<BoardType, 'free' | 'tda'>;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: BoardAuthorRole;
  imageAttachments?: BoardImageAttachment[];
}

export interface UpdateBoardPostInput {
  title?: string;
  body?: string;
  imageAttachments?: BoardImageAttachment[];
}

export interface CreateBoardCommentInput {
  postId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: BoardAuthorRole;
  parentCommentId?: string | null;
  mentionedUserIds?: string[];
  imageAttachments?: BoardImageAttachment[];
}

export interface UpdateBoardCommentInput {
  body?: string;
  imageAttachments?: BoardImageAttachment[];
}

export interface CreateBoardReportInput {
  targetType: BoardReportTargetType;
  targetId: string;
  postId: string;
  reporterId: string;
  reason: string;
  details?: string;
}

export interface ScheduleBoardSyncInput {
  jobPostingId: string;
  title: string;
  body: string;
  ownerId: string;
  ownerName: string;
  ownerRole: BoardAuthorRole;
  workDate: string;
  workDates?: string[];
  locationName?: string;
  totalPositions?: number;
  filledPositions?: number;
  compensationLabel?: string;
  jobPostingStatus?: string;
}

export interface ScheduleMembershipSyncItem {
  userId: string;
  role: BoardMemberRole;
  displayName?: string;
  canRead: boolean;
  canComment: boolean;
  title: string;
  workDate: string;
  authorId: string;
  lastActivityAt?: Date | null;
}

export const MAX_BOARD_POST_IMAGES = 10;
export const MAX_BOARD_COMMENT_IMAGES = 3;

export const BOARD_TYPE_LABELS: Record<BoardType, string> = {
  notice: '공지사항',
  schedule: '일정게시판',
  free: '자유게시판',
  tda: 'TDA 토론',
};

export const COMMENT_REACTION_LABELS: Record<CommentReactionType, string> = {
  thumbs_up: '👍',
  heart: '❤️',
  laugh: '😂',
  surprised: '😮',
  sad: '😢',
  angry: '😡',
};

export {
  BOARD_NOTICE_PREFIX,
  SCHEDULE_BOARD_ID_PREFIX,
  buildBoardNoticePostId,
  buildScheduleBoardPostId,
  isBoardNoticePostId,
  extractAnnouncementIdFromBoardPostId,
};

export function mapAnnouncementToBoardPost(announcement: Announcement): BoardPost {
  return {
    id: buildBoardNoticePostId(announcement.id),
    boardType: 'notice',
    source: 'announcement',
    title: announcement.title,
    body: announcement.content,
    authorId: announcement.authorId,
    authorName: announcement.authorName,
    authorRole: 'admin',
    visibility: 'public',
    status: announcement.status === 'archived' ? 'archived' : 'active',
    linkedJobPostingId: null,
    isAutoCreated: false,
    isLocked: true,
    lockedBy: null,
    lockedAt: null,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    viewCount: announcement.viewCount ?? 0,
    imageAttachments: announcement.images?.length
      ? announcement.images
      : announcement.imageUrl
        ? [
            {
              id: 'legacy-0',
              url: announcement.imageUrl,
              storagePath: announcement.imageStoragePath ?? '',
              order: 0,
            },
          ]
        : [],
    announcementCategory: announcement.category,
    isPinned: announcement.isPinned,
    lastActivityAt: announcement.publishedAt ?? announcement.updatedAt ?? announcement.createdAt,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  };
}

export function buildBoardCommentTree(comments: BoardComment[]): BoardCommentNode[] {
  const nodeMap = new Map<string, BoardCommentNode>();
  const roots: BoardCommentNode[] = [];

  comments.forEach((comment) => {
    nodeMap.set(comment.id, { ...comment, children: [] });
  });

  nodeMap.forEach((comment) => {
    if (comment.parentCommentId) {
      const parent = nodeMap.get(comment.parentCommentId);
      if (parent) {
        parent.children.push(comment);
        return;
      }
    }

    roots.push(comment);
  });

  const sortNodes = (nodes: BoardCommentNode[]) => {
    nodes.sort((left, right) => {
      const leftTime = toDate(left.createdAt ?? null)?.getTime() ?? 0;
      const rightTime = toDate(right.createdAt ?? null)?.getTime() ?? 0;
      return leftTime - rightTime;
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}
