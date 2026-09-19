import type {
  BoardComment,
  BoardMembership,
  BoardPost,
  BoardPostStatus,
  BoardReport,
  CommentReactionType,
  CreateBoardCommentInput,
  CreateBoardReportInput,
  UpdateBoardCommentInput,
} from '@/types';

export type BoardRepositoryType = Exclude<BoardPost['boardType'], 'notice'>;

export interface FetchBoardRepositoryPostsOptions {
  boardTypes?: BoardRepositoryType[];
  authorId?: string;
  linkedJobPostingId?: string;
  statuses?: BoardPostStatus[];
  limitCount?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastActivityAt' | 'viewCount';
  sortDirection?: 'asc' | 'desc';
  onlyPinned?: boolean;
}

export interface FetchScheduleMembershipsOptions {
  canReadOnly?: boolean;
  limitCount?: number;
  sortBy?: 'workDate' | 'lastActivityAt';
  sortDirection?: 'asc' | 'desc';
}

export interface FetchBoardReportsOptions {
  status?: BoardReport['status'] | 'all';
  limitCount?: number;
}

export interface IBoardRepository {
  getPostById(postId: string): Promise<BoardPost | null>;
  getPosts(options?: FetchBoardRepositoryPostsOptions): Promise<BoardPost[]>;
  getPostsByIds(postIds: string[]): Promise<BoardPost[]>;
  setPostStatus(postId: string, status: BoardPostStatus): Promise<void>;
  setPostLock(postId: string, isLocked: boolean, actorId: string): Promise<void>;
  incrementViewCount(postId: string): Promise<void>;

  getComments(postId: string): Promise<BoardComment[]>;
  getCommentById(postId: string, commentId: string): Promise<BoardComment | null>;
  createComment(input: CreateBoardCommentInput): Promise<string>;
  updateComment(postId: string, commentId: string, input: UpdateBoardCommentInput): Promise<void>;
  setCommentStatus(
    postId: string,
    commentId: string,
    status: BoardComment['status']
  ): Promise<void>;
  setCommentPinned(
    postId: string,
    commentId: string,
    isPinned: boolean,
    actorId: string
  ): Promise<void>;

  toggleCommentReaction(
    postId: string,
    commentId: string,
    userId: string,
    type: CommentReactionType
  ): Promise<CommentReactionType | null>;
  getCommentReactionsByUser(
    postId: string,
    userId: string
  ): Promise<Record<string, CommentReactionType>>;

  getMembershipsByUser(
    userId: string,
    options?: FetchScheduleMembershipsOptions
  ): Promise<BoardMembership[]>;
  getMembershipsByPost(postId: string): Promise<BoardMembership[]>;
  getMembership(postId: string, userId: string): Promise<BoardMembership | null>;
  createReport(input: CreateBoardReportInput): Promise<string>;
  getReportById(reportId: string): Promise<BoardReport | null>;
  getReports(options?: FetchBoardReportsOptions): Promise<BoardReport[]>;
  getReportsByPostId(postId: string): Promise<BoardReport[]>;
  reviewReport(
    reportId: string,
    status: Extract<BoardReport['status'], 'resolved' | 'dismissed'>,
    resolvedBy: string
  ): Promise<void>;
}
