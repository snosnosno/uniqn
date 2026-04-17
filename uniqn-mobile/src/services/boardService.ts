import {
  BusinessError,
  ERROR_CODES,
  PermissionError,
  ValidationError,
  handleServiceError,
  isAppError,
} from '@/errors';
import { handleSilentError } from '@/errors/serviceErrorHandler';
import { useAuthStore } from '@/stores/authStore';
import {
  announcementRepository,
  applicationRepository,
  boardRepository,
  jobPostingRepository,
  userRepository,
  workLogRepository,
} from '@/repositories';
import { deleteMultipleBoardImages } from '@/services/auth/storageService';
import { requireAdminUser, requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import {
  type BoardAdminReportRecord,
  MAX_BOARD_COMMENT_IMAGES,
  MAX_BOARD_POST_IMAGES,
  BOARD_TYPE_LABELS,
  buildBoardCommentTree,
  mapAnnouncementToBoardPost,
  type BoardAuthorRole,
  type BoardComment,
  type BoardHomeData,
  type BoardImageAttachment,
  type BoardMentionCandidate,
  type BoardMembership,
  type BoardPost,
  type BoardReport,
  type BoardReportFilterStatus,
  type BoardReportResolutionStatus,
  type BoardVoteType,
  type CommentReactionType,
  type CreateBoardCommentInput,
  type CreateBoardPostInput,
  type CreateBoardReportInput,
  type FetchBoardPostsInput,
  type UpdateBoardCommentInput,
  type UpdateBoardPostInput,
  type BoardJobSummary,
} from '@/types/board';
import {
  buildScheduleBoardPostId,
  extractAnnouncementIdFromBoardPostId,
  isBoardNoticePostId,
} from '@/shared/board/boardIds';
import type { JobPosting, UserRole, WorkLog } from '@/types';
import { toDate } from '@/utils/date';
import { sanitizeInput, xssValidation } from '@/utils/security';
import { logger } from '@/utils/logger';

const COMPONENT = 'boardService';

const ACTIVE_POST_STATUSES = ['active', 'locked'] as const;
const ADMIN_VISIBLE_POST_STATUSES = ['active', 'locked', 'hidden', 'archived'] as const;
const MAX_BOARD_MENTIONS = 10;

interface BoardViewer {
  userId?: string;
  role?: UserRole | null;
  isAdmin?: boolean;
}

interface BoardPostDetail {
  post: BoardPost;
  comments: BoardComment[];
  commentTree: ReturnType<typeof buildBoardCommentTree>;
  membership: BoardMembership | null;
  myVote: BoardVoteType | null;
  myReactions: Record<string, CommentReactionType>;
}

interface MentionCandidateSource {
  userId: string;
  displayName?: string | null;
  role: BoardAuthorRole;
  isAuthor?: boolean;
}

function buildDisplayName(name?: string | null, nickname?: string | null, fallback = ''): string {
  const trimmedName = name?.trim();
  const trimmedNickname = nickname?.trim();

  if (trimmedName && trimmedNickname && trimmedName !== trimmedNickname) {
    return `${trimmedName}(${trimmedNickname})`;
  }

  return trimmedName || trimmedNickname || fallback;
}

function resolveMentionCandidates(candidates: MentionCandidateSource[]): BoardMentionCandidate[] {
  if (candidates.length === 0) {
    return [];
  }

  const candidateMap = new Map<string, BoardMentionCandidate>();

  candidates.forEach((candidate) => {
    const userId = candidate.userId?.trim();
    if (!userId) {
      return;
    }

    const displayName = candidate.displayName?.trim() || `사용자 ${userId.slice(-4)}`;
    const existing = candidateMap.get(userId);

    if (existing?.isAuthor) {
      return;
    }

    candidateMap.set(userId, {
      userId,
      displayName,
      role: candidate.role,
      isAuthor: candidate.isAuthor ?? false,
    });
  });

  return [...candidateMap.values()].sort((left, right) => {
    if (left.isAuthor !== right.isAuthor) {
      return left.isAuthor ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName, 'ko-KR');
  });
}

function getBoardImageIdentity(image: BoardImageAttachment): string {
  return image.storagePath || image.url || image.id;
}

function findRemovedBoardImages(
  previousImages: BoardImageAttachment[],
  nextImages?: BoardImageAttachment[]
): BoardImageAttachment[] {
  if (!nextImages) {
    return [];
  }

  const nextImageIds = new Set(nextImages.map(getBoardImageIdentity));
  return previousImages.filter((image) => !nextImageIds.has(getBoardImageIdentity(image)));
}

async function cleanupBoardImages(
  images: BoardImageAttachment[],
  context: Record<string, unknown>
): Promise<void> {
  if (images.length === 0) {
    return;
  }

  try {
    await deleteMultipleBoardImages(images);
  } catch (error) {
    logger.warn('Board image cleanup failed', {
      component: COMPONENT,
      imageCount: images.length,
      error: error instanceof Error ? error.message : String(error),
      ...context,
    });
  }
}

function normalizeMentionIds(mentionedUserIds?: string[]): string[] {
  const uniqueMentionIds = new Set<string>();

  (mentionedUserIds ?? []).forEach((mentionedUserId) => {
    const normalizedId = mentionedUserId.trim();
    if (normalizedId) {
      uniqueMentionIds.add(normalizedId);
    }
  });

  if (uniqueMentionIds.size > MAX_BOARD_MENTIONS) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `멘션은 최대 ${MAX_BOARD_MENTIONS}명까지 가능합니다.`,
    });
  }

  return [...uniqueMentionIds];
}

function mapMembershipRoleToAuthorRole(role: BoardMembership['role']): BoardAuthorRole {
  if (role === 'author') {
    return 'employer';
  }

  if (role === 'admin') {
    return 'admin';
  }

  return 'staff';
}

function assertSafeText(
  field: 'title' | 'body' | 'reason' | 'details',
  value: string,
  maxLength: number
) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      field,
      userMessage: `${field} 값이 필요합니다.`,
    });
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(ERROR_CODES.VALIDATION_MAX_LENGTH, {
      field,
      userMessage: `${field} 길이가 너무 깁니다.`,
    });
  }

  if (!xssValidation(trimmed)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      field,
      userMessage: '허용되지 않는 문자가 포함되어 있습니다.',
    });
  }
}

function sanitizeBoardText(value: string): string {
  return sanitizeInput(value).trim();
}

function assertImageLimit(count: number, maxCount: number) {
  if (count > maxCount) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `이미지는 최대 ${maxCount}개까지 첨부할 수 있습니다.`,
    });
  }
}

function formatCompensationLabel(jobPosting: JobPosting): string {
  const amount = jobPosting.compensation.defaultSalary?.amount;
  const type = jobPosting.compensation.defaultSalary?.type;
  if (!amount || !type) {
    return '';
  }

  const typeLabelMap: Record<string, string> = {
    hourly: '시급',
    daily: '일급',
    monthly: '월급',
    other: '급여',
  };

  return `${typeLabelMap[type] ?? '급여'} ${amount.toLocaleString('ko-KR')}원`;
}

function buildScheduleBoardBody(jobPosting: JobPosting): string {
  const lines = [
    `공고명: ${jobPosting.title}`,
    `근무일: ${jobPosting.workDates?.length ? jobPosting.workDates.join(', ') : jobPosting.workDate}`,
    `장소: ${jobPosting.location?.name ?? '미정'}`,
  ];

  const compensationLabel = formatCompensationLabel(jobPosting);
  if (compensationLabel) {
    lines.push(`급여: ${compensationLabel}`);
  }

  lines.push(`모집 인원: ${jobPosting.filledPositions}/${jobPosting.totalPositions}`);

  if (jobPosting.description?.trim()) {
    lines.push('', sanitizeBoardText(jobPosting.description));
  }

  return lines.join('\n');
}

function buildScheduleSyncMembers(jobPosting: JobPosting, workLogs: WorkLog[]): BoardMembership[] {
  const memberMap = new Map<string, BoardMembership>();
  const baseDate = jobPosting.workDate || jobPosting.workDates?.[0] || '';
  const postId = buildScheduleBoardPostId(jobPosting.id);
  const lastActivityAt = toDate(jobPosting.updatedAt ?? jobPosting.createdAt ?? null);

  memberMap.set(jobPosting.ownerId, {
    id: `${postId}_${jobPosting.ownerId}`,
    boardType: 'schedule',
    userId: jobPosting.ownerId,
    postId,
    jobPostingId: jobPosting.id,
    role: 'author',
    displayName: buildDisplayName(
      jobPosting.ownerName,
      undefined,
      `구인자 ${jobPosting.ownerId.slice(-4)}`
    ),
    canRead: true,
    canComment: true,
    title: jobPosting.title,
    workDate: baseDate,
    authorId: jobPosting.ownerId,
    lastActivityAt,
    createdAt: undefined,
    updatedAt: undefined,
  });

  workLogs
    .filter((workLog) => workLog.status !== 'cancelled')
    .forEach((workLog) => {
      if (memberMap.has(workLog.staffId)) {
        return;
      }

      memberMap.set(workLog.staffId, {
        id: `${postId}_${workLog.staffId}`,
        boardType: 'schedule',
        userId: workLog.staffId,
        postId,
        jobPostingId: jobPosting.id,
        role: 'confirmed',
        displayName: buildDisplayName(
          workLog.staffName,
          workLog.staffNickname,
          `스태프 ${workLog.staffId.slice(-4)}`
        ),
        canRead: true,
        canComment: true,
        title: jobPosting.title,
        workDate: workLog.date || baseDate,
        authorId: jobPosting.ownerId,
        lastActivityAt: toDate(workLog.updatedAt ?? workLog.createdAt ?? lastActivityAt),
        createdAt: undefined,
        updatedAt: undefined,
      });
    });

  return [...memberMap.values()];
}

function sortSchedulePosts(posts: BoardPost[], memberships?: BoardMembership[]): BoardPost[] {
  const membershipMap = memberships
    ? new Map(memberships.map((membership) => [membership.postId, membership]))
    : null;

  return [...posts].sort((left, right) => {
    const leftActivity =
      toDate(left.lastActivityAt ?? left.updatedAt ?? left.createdAt)?.getTime() ?? 0;
    const rightActivity =
      toDate(right.lastActivityAt ?? right.updatedAt ?? right.createdAt)?.getTime() ?? 0;
    const activityComparison = rightActivity - leftActivity;

    if (activityComparison !== 0) {
      return activityComparison;
    }

    const leftDate = membershipMap?.get(left.id)?.workDate ?? left.jobSummary?.workDate ?? '';
    const rightDate = membershipMap?.get(right.id)?.workDate ?? right.jobSummary?.workDate ?? '';
    return leftDate.localeCompare(rightDate);
  });
}

function isActiveSchedulePostStatus(
  status: BoardPost['status']
): status is (typeof ACTIVE_POST_STATUSES)[number] {
  return ACTIVE_POST_STATUSES.includes(status as (typeof ACTIVE_POST_STATUSES)[number]);
}

function isSkippableScheduleMembershipPostError(error: unknown): boolean {
  if (isAppError(error)) {
    return (
      error.code === ERROR_CODES.INFRA_NOT_FOUND ||
      error.code === ERROR_CODES.INFRA_PERMISSION_DENIED ||
      error.code === ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS
    );
  }

  return false;
}

function isSkippableBoardHomeSectionError(error: unknown): boolean {
  if (isAppError(error)) {
    return (
      error.code === ERROR_CODES.INFRA_PERMISSION_DENIED ||
      error.code === ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS
    );
  }

  return false;
}

function handleBoardHomeSectionPermissionError(
  section: 'pinnedNotices' | 'recentSchedulePosts' | 'popularCommunityPosts',
  viewer: BoardViewer,
  error: unknown
) {
  const liveUserId = useAuthStore.getState().user?.uid ?? null;

  handleSilentError(error, {
    operation: '게시판 홈 섹션 스킵',
    component: COMPONENT,
    context: {
      section,
      viewerId: viewer.userId ?? null,
      viewerRole: viewer.role ?? null,
      isAdmin: viewer.isAdmin ?? false,
      liveUserId,
      liveUserMatchesViewer: !!viewer.userId && liveUserId === viewer.userId,
    },
  });
}

async function resolveBoardHomeSection<T>(
  section: 'pinnedNotices' | 'recentSchedulePosts' | 'popularCommunityPosts',
  viewer: BoardViewer,
  resolver: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await resolver();
  } catch (error) {
    if (isSkippableBoardHomeSectionError(error)) {
      handleBoardHomeSectionPermissionError(section, viewer, error);
      return fallback;
    }

    throw error;
  }
}

async function getReadableSchedulePostsByMemberships(
  memberships: BoardMembership[]
): Promise<BoardPost[]> {
  if (memberships.length === 0) {
    return [];
  }

  const posts = await Promise.all(
    memberships.map(async (membership) => {
      try {
        const post = await boardRepository.getPostById(membership.postId);

        if (!post || !isActiveSchedulePostStatus(post.status)) {
          return null;
        }

        return post;
      } catch (error) {
        if (isSkippableScheduleMembershipPostError(error)) {
          return null;
        }

        throw error;
      }
    })
  );

  return posts.filter((post): post is BoardPost => post !== null);
}

async function getSchedulePostsForMemberships(
  memberships: BoardMembership[],
  limitCount?: number
): Promise<BoardPost[]> {
  if (memberships.length === 0) {
    return [];
  }

  const posts = await getReadableSchedulePostsByMemberships(memberships);
  const sortedPosts = sortSchedulePosts(posts, memberships);
  return limitCount ? sortedPosts.slice(0, limitCount) : sortedPosts;
}

async function getBoardPostInternal(postId: string): Promise<BoardPost | null> {
  if (isBoardNoticePostId(postId)) {
    const announcement = await announcementRepository.getById(
      extractAnnouncementIdFromBoardPostId(postId)
    );
    return announcement ? mapAnnouncementToBoardPost(announcement) : null;
  }

  return boardRepository.getPostById(postId);
}

async function getScheduleMembership(
  postId: string,
  viewerId?: string
): Promise<BoardMembership | null> {
  if (!viewerId) {
    return null;
  }

  return boardRepository.getMembership(postId, viewerId);
}

async function setScheduleBoardStatusIfExists(
  jobPostingId: string,
  status: Extract<BoardPost['status'], 'archived' | 'hidden'>
): Promise<boolean> {
  const postId = buildScheduleBoardPostId(jobPostingId);
  const existingPost = await boardRepository.getPostById(postId);

  if (!existingPost) {
    return false;
  }

  await boardRepository.setPostStatus(postId, status);
  return true;
}

async function getRecentSchedulePosts(
  viewer: BoardViewer,
  limitCount: number
): Promise<BoardPost[]> {
  if (!viewer.userId) {
    return [];
  }

  if (viewer.isAdmin) {
    const posts = await boardRepository.getPosts({
      boardTypes: ['schedule'],
      statuses: [...ADMIN_VISIBLE_POST_STATUSES],
      sortBy: 'lastActivityAt',
      sortDirection: 'desc',
    });

    return sortSchedulePosts(posts).slice(0, limitCount);
  }

  if (viewer.role === 'employer') {
    const memberships = await boardRepository.getMembershipsByUser(viewer.userId, {
      canReadOnly: true,
      sortBy: 'lastActivityAt',
      sortDirection: 'desc',
    });
    const authoredMemberships = memberships.filter((membership) => membership.role === 'author');
    return getSchedulePostsForMemberships(authoredMemberships, limitCount);
  }

  const memberships = await boardRepository.getMembershipsByUser(viewer.userId, {
    canReadOnly: true,
    sortBy: 'workDate',
    sortDirection: 'asc',
  });
  return getSchedulePostsForMemberships(memberships, limitCount);
}

async function resolveBoardReporterInfo(
  reporterId: string
): Promise<Pick<BoardAdminReportRecord, 'reporterName' | 'reporterRole'>> {
  try {
    const reporter = await userRepository.getById(reporterId);

    return {
      reporterName: buildDisplayName(
        reporter?.name,
        reporter?.nickname,
        `사용자 ${reporterId.slice(-4)}`
      ),
      reporterRole: reporter?.role ?? 'staff',
    };
  } catch {
    return {
      reporterName: `사용자 ${reporterId.slice(-4)}`,
      reporterRole: 'staff',
    };
  }
}

async function buildBoardAdminReportRecord(report: BoardReport): Promise<BoardAdminReportRecord> {
  const [post, reporterInfo, targetComment] = await Promise.all([
    getBoardPostInternal(report.postId),
    resolveBoardReporterInfo(report.reporterId),
    report.targetType === 'comment'
      ? boardRepository.getCommentById(report.postId, report.targetId)
      : Promise.resolve(null),
  ]);

  const targetAuthorId =
    report.targetType === 'post' ? post?.authorId : (targetComment?.authorId ?? undefined);
  const targetAuthorName =
    report.targetType === 'post' ? post?.authorName : (targetComment?.authorName ?? undefined);

  return {
    report,
    post,
    targetComment,
    reporterName: reporterInfo.reporterName,
    reporterRole: reporterInfo.reporterRole,
    targetAuthorId,
    targetAuthorName,
  };
}

async function assertCanViewPost(
  post: BoardPost,
  viewer: BoardViewer
): Promise<BoardMembership | null> {
  if (post.boardType === 'notice' || post.boardType === 'free' || post.boardType === 'tda') {
    return null;
  }

  if (!viewer.userId) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '일정게시판 접근 권한이 없습니다.',
    });
  }

  if (viewer.isAdmin || post.authorId === viewer.userId) {
    return null;
  }

  const membership = await getScheduleMembership(post.id, viewer.userId);
  if (!membership?.canRead) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '일정게시판 접근 권한이 없습니다.',
    });
  }

  return membership;
}

async function assertCanInteractPost(
  post: BoardPost,
  viewer: BoardViewer
): Promise<BoardMembership | null> {
  if (!viewer.userId) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '로그인이 필요합니다.',
    });
  }

  if (post.boardType === 'notice') {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공지사항은 상호작용할 수 없습니다.',
    });
  }

  if (post.isLocked) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '잠긴 게시글입니다.',
    });
  }

  if (post.boardType !== 'schedule') {
    return null;
  }

  if (viewer.isAdmin || post.authorId === viewer.userId) {
    return null;
  }

  const membership = await getScheduleMembership(post.id, viewer.userId);
  if (!membership?.canComment) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '댓글 권한이 없습니다.',
    });
  }

  return membership;
}

function assertCanManagePost(post: BoardPost, viewer: BoardViewer) {
  if (!viewer.userId) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '로그인이 필요합니다.',
    });
  }

  if (post.boardType === 'notice') {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공지사항은 이 작업을 지원하지 않습니다.',
    });
  }

  if (!viewer.isAdmin && post.authorId !== viewer.userId) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '게시글 관리 권한이 없습니다.',
    });
  }
}

function assertCanCreatePost(input: CreateBoardPostInput) {
  if (input.boardType !== 'free' && input.boardType !== 'tda' && input.boardType !== 'substitute') {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: '직접 작성할 수 없는 게시판입니다.',
    });
  }
}

export async function fetchBoardPosts(input: FetchBoardPostsInput): Promise<BoardPost[]> {
  try {
    const { boardType, viewerId, viewerRole, isAdmin, limitCount } = input;

    if (boardType === 'notice') {
      const result = await announcementRepository.getPublished(viewerRole ?? null, {
        pageSize: limitCount ?? 20,
      });
      return result.announcements.map(mapAnnouncementToBoardPost);
    }

    if (boardType === 'schedule') {
      if (!viewerId) {
        return [];
      }

      if (isAdmin) {
        const posts = await boardRepository.getPosts({
          boardTypes: ['schedule'],
          statuses: [...ADMIN_VISIBLE_POST_STATUSES],
          limitCount,
          sortBy: 'lastActivityAt',
          sortDirection: 'desc',
        });
        return sortSchedulePosts(posts);
      }

      if (viewerRole === 'employer') {
        const memberships = await boardRepository.getMembershipsByUser(viewerId, {
          canReadOnly: true,
          sortBy: 'lastActivityAt',
          sortDirection: 'desc',
        });
        const authoredMemberships = memberships.filter(
          (membership) => membership.role === 'author'
        );
        return getSchedulePostsForMemberships(authoredMemberships, limitCount);
      }

      const memberships = await boardRepository.getMembershipsByUser(viewerId, {
        canReadOnly: true,
        limitCount,
        sortBy: 'workDate',
        sortDirection: 'asc',
      });
      return getSchedulePostsForMemberships(memberships, limitCount);
    }

    return boardRepository.getPosts({
      boardTypes: [boardType],
      statuses: [...ACTIVE_POST_STATUSES],
      limitCount,
      sortBy: 'lastActivityAt',
      sortDirection: 'desc',
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: `${BOARD_TYPE_LABELS[input.boardType]} 목록 조회`,
      component: COMPONENT,
      context: { boardType: input.boardType, viewerId: input.viewerId },
    });
  }
}

export async function getBoardHomeData(viewer: BoardViewer): Promise<BoardHomeData> {
  try {
    const [pinnedNotices, recentSchedulePosts, popularCommunityPosts] = await Promise.all([
      resolveBoardHomeSection(
        'pinnedNotices',
        viewer,
        async () => {
          const pinnedNoticesResult = await announcementRepository.getPublished(
            viewer.role ?? null,
            {
              pageSize: 10,
            }
          );

          return pinnedNoticesResult.announcements
            .filter((announcement) => announcement.isPinned)
            .slice(0, 3)
            .map(mapAnnouncementToBoardPost);
        },
        []
      ),
      resolveBoardHomeSection(
        'recentSchedulePosts',
        viewer,
        () => getRecentSchedulePosts(viewer, 5),
        []
      ),
      resolveBoardHomeSection(
        'popularCommunityPosts',
        viewer,
        async () => {
          const popularCommunityCandidates = await boardRepository.getPosts({
            boardTypes: ['free', 'tda'],
            statuses: [...ACTIVE_POST_STATUSES],
            limitCount: 20,
            sortBy: 'lastActivityAt',
            sortDirection: 'desc',
          });

          return [...popularCommunityCandidates]
            .sort(
              (left, right) =>
                right.likeCount +
                right.commentCount +
                right.viewCount -
                (left.likeCount + left.commentCount + left.viewCount)
            )
            .slice(0, 10);
        },
        []
      ),
    ]);

    return {
      pinnedNotices,
      recentSchedulePosts,
      popularCommunityPosts,
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 홈 조회',
      component: COMPONENT,
      context: { viewerId: viewer.userId },
    });
  }
}

export async function getBoardPostDetail(
  postId: string,
  viewer: BoardViewer
): Promise<BoardPostDetail> {
  try {
    const post = await getBoardPostInternal(postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시글을 찾을 수 없습니다.',
      });
    }

    const membership = await assertCanViewPost(post, viewer);

    if (post.boardType === 'notice') {
      return {
        post,
        comments: [],
        commentTree: [],
        membership,
        myVote: null,
        myReactions: {},
      };
    }

    const [commentsResult, myVoteResult, myReactionsResult] = await Promise.allSettled([
      boardRepository.getComments(post.id),
      viewer.userId ? boardRepository.getPostVote(post.id, viewer.userId) : Promise.resolve(null),
      viewer.userId
        ? boardRepository.getCommentReactionsByUser(post.id, viewer.userId)
        : Promise.resolve({} as Record<string, CommentReactionType>),
    ] as const);

    if (commentsResult.status === 'rejected') {
      throw commentsResult.reason;
    }

    const comments = commentsResult.value;
    const myVote =
      myVoteResult.status === 'fulfilled'
        ? (myVoteResult.value?.type ?? null)
        : (() => {
            logger.warn('Optional board detail vote lookup failed', {
              component: COMPONENT,
              postId,
              viewerId: viewer.userId ?? null,
              error:
                myVoteResult.reason instanceof Error
                  ? myVoteResult.reason.message
                  : String(myVoteResult.reason),
            });
            return null;
          })();
    const myReactions =
      myReactionsResult.status === 'fulfilled'
        ? myReactionsResult.value
        : (() => {
            logger.warn('Optional board detail reaction lookup failed', {
              component: COMPONENT,
              postId,
              viewerId: viewer.userId ?? null,
              error:
                myReactionsResult.reason instanceof Error
                  ? myReactionsResult.reason.message
                  : String(myReactionsResult.reason),
            });
            return {};
          })();

    return {
      post,
      comments,
      commentTree: buildBoardCommentTree(comments),
      membership,
      myVote,
      myReactions,
    };
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시글 상세 조회',
      component: COMPONENT,
      context: { postId, viewerId: viewer.userId },
    });
  }
}

export async function getBoardMentionCandidates(
  postId: string,
  viewer: BoardViewer
): Promise<BoardMentionCandidate[]> {
  try {
    const post = await getBoardPostInternal(postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시글을 찾을 수 없습니다.',
      });
    }

    await assertCanViewPost(post, viewer);

    if (post.boardType === 'schedule') {
      const memberships = (await boardRepository.getMembershipsByPost(post.id)).filter(
        (membership) => membership.canRead
      );
      return resolveMentionCandidates([
        {
          userId: post.authorId,
          displayName: post.authorName,
          role: post.authorRole,
          isAuthor: true,
        },
        ...memberships.map((membership) => ({
          userId: membership.userId,
          displayName: membership.displayName,
          role: mapMembershipRoleToAuthorRole(membership.role),
          isAuthor: membership.role === 'author',
        })),
      ]);
    }

    if (post.boardType === 'notice') {
      return resolveMentionCandidates([
        {
          userId: post.authorId,
          displayName: post.authorName,
          role: post.authorRole,
          isAuthor: true,
        },
      ]);
    }

    const comments = (await boardRepository.getComments(post.id)).filter(
      (comment) => comment.status === 'active'
    );
    return resolveMentionCandidates([
      {
        userId: post.authorId,
        displayName: post.authorName,
        role: post.authorRole,
        isAuthor: true,
      },
      ...comments.map((comment) => ({
        userId: comment.authorId,
        displayName: comment.authorName,
        role: comment.authorRole,
        isAuthor: comment.authorId === post.authorId,
      })),
    ]);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '멘션 후보 조회',
      component: COMPONENT,
      context: { postId, viewerId: viewer.userId },
    });
  }
}

export async function incrementBoardPostViewCount(postId: string): Promise<void> {
  try {
    if (isBoardNoticePostId(postId)) {
      await announcementRepository.incrementViewCount(extractAnnouncementIdFromBoardPostId(postId));
      return;
    }

    await boardRepository.incrementViewCount(postId);
  } catch (error) {
    throw handleSilentError(error, {
      operation: '게시글 조회수 증가',
      component: COMPONENT,
      context: { postId },
    });
  }
}

export async function createBoardPost(
  userId: string,
  authorName: string,
  authorRole: BoardAuthorRole,
  input: CreateBoardPostInput
): Promise<string> {
  await requireMatchingCurrentUser(userId);
  assertCanCreatePost(input);
  assertSafeText('title', input.title, 120);
  assertSafeText('body', input.body, 5000);
  assertImageLimit(input.imageAttachments?.length ?? 0, MAX_BOARD_POST_IMAGES);

  try {
    return await boardRepository.createPost({
      ...input,
      title: sanitizeBoardText(input.title),
      body: sanitizeBoardText(input.body),
      authorId: userId,
      authorName,
      authorRole,
      imageAttachments: input.imageAttachments ?? [],
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시글 작성',
      component: COMPONENT,
      context: { userId, boardType: input.boardType },
    });
  }
}

export async function updateBoardPost(
  postId: string,
  viewer: BoardViewer,
  input: UpdateBoardPostInput
): Promise<void> {
  if (viewer.userId) {
    await requireMatchingCurrentUser(viewer.userId);
  }

  if (input.title !== undefined) {
    assertSafeText('title', input.title, 120);
  }
  if (input.body !== undefined) {
    assertSafeText('body', input.body, 5000);
  }
  assertImageLimit(input.imageAttachments?.length ?? 0, MAX_BOARD_POST_IMAGES);

  try {
    const post = await getBoardPostInternal(postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시글을 찾을 수 없습니다.',
      });
    }

    assertCanManagePost(post, viewer);

    if (post.isLocked) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '잠긴 게시글은 잠금 해제 후 수정할 수 있습니다.',
      });
    }

    const removedImages = findRemovedBoardImages(post.imageAttachments, input.imageAttachments);

    await boardRepository.updatePost(postId, {
      ...(input.title !== undefined ? { title: sanitizeBoardText(input.title) } : {}),
      ...(input.body !== undefined ? { body: sanitizeBoardText(input.body) } : {}),
      ...(input.imageAttachments !== undefined ? { imageAttachments: input.imageAttachments } : {}),
    });

    await cleanupBoardImages(removedImages, {
      operation: 'updateBoardPost',
      postId,
      viewerId: viewer.userId,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시글 수정',
      component: COMPONENT,
      context: { postId, viewerId: viewer.userId },
    });
  }
}

export async function setBoardPostLock(
  postId: string,
  viewer: BoardViewer,
  isLocked: boolean
): Promise<void> {
  if (viewer.userId) {
    await requireMatchingCurrentUser(viewer.userId);
  }

  try {
    const post = await getBoardPostInternal(postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시글을 찾을 수 없습니다.',
      });
    }

    assertCanManagePost(post, viewer);
    await boardRepository.setPostLock(postId, isLocked, viewer.userId!);
  } catch (error) {
    throw handleServiceError(error, {
      operation: isLocked ? '게시글 잠금' : '게시글 잠금 해제',
      component: COMPONENT,
      context: { postId, viewerId: viewer.userId },
    });
  }
}

export async function hideBoardPost(postId: string, adminUserId: string): Promise<void> {
  await requireAdminUser(adminUserId);
  try {
    const post = await getBoardPostInternal(postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시글을 찾을 수 없습니다.',
      });
    }

    if (post.boardType === 'notice') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '공지사항은 여기에서 숨길 수 없습니다.',
      });
    }

    await boardRepository.setPostStatus(postId, 'hidden');
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시글 숨김',
      component: COMPONENT,
      context: { postId, adminUserId },
    });
  }
}

export async function createBoardComment(
  viewer: Required<Pick<BoardViewer, 'userId'>> & Pick<BoardViewer, 'isAdmin'>,
  authorName: string,
  authorRole: BoardAuthorRole,
  input: CreateBoardCommentInput
): Promise<string> {
  await requireMatchingCurrentUser(viewer.userId);
  assertSafeText('body', input.body, 3000);
  assertImageLimit(input.imageAttachments?.length ?? 0, MAX_BOARD_COMMENT_IMAGES);

  try {
    const post = await getBoardPostInternal(input.postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시글을 찾을 수 없습니다.',
      });
    }

    const mentionedUserIds = normalizeMentionIds(input.mentionedUserIds);

    if (input.parentCommentId) {
      const parentComment = await boardRepository.getCommentById(post.id, input.parentCommentId);
      if (!parentComment || parentComment.status !== 'active') {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '답글을 작성할 댓글을 찾을 수 없습니다.',
        });
      }
    }

    if (mentionedUserIds.length > 0) {
      const allowedIds =
        post.boardType === 'schedule'
          ? new Set(
              (await boardRepository.getMembershipsByPost(post.id))
                .map((membership) => membership.userId)
                .concat(post.authorId)
            )
          : new Set(
              [post.authorId].concat(
                (await boardRepository.getComments(post.id))
                  .filter((comment) => comment.status === 'active')
                  .map((comment) => comment.authorId)
              )
            );
      const hasInvalidMention = mentionedUserIds.some(
        (mentionedUserId) => !allowedIds.has(mentionedUserId)
      );
      if (hasInvalidMention) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage:
            post.boardType === 'schedule'
              ? '일정게시판에서는 참여자만 멘션할 수 있습니다.'
              : '이 글의 작성자와 활성 댓글 참여자만 멘션할 수 있습니다.',
        });
      }
    }

    await assertCanInteractPost(post, { ...viewer });

    return boardRepository.createComment({
      ...input,
      body: sanitizeBoardText(input.body),
      authorId: viewer.userId,
      authorName,
      authorRole,
      mentionedUserIds,
      imageAttachments: input.imageAttachments ?? [],
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '댓글 작성',
      component: COMPONENT,
      context: { postId: input.postId, viewerId: viewer.userId },
    });
  }
}

export async function updateBoardComment(
  postId: string,
  commentId: string,
  viewer: Required<Pick<BoardViewer, 'userId'>> & Pick<BoardViewer, 'isAdmin'>,
  input: UpdateBoardCommentInput
): Promise<void> {
  await requireMatchingCurrentUser(viewer.userId);
  if (input.body !== undefined) {
    assertSafeText('body', input.body, 3000);
  }
  assertImageLimit(input.imageAttachments?.length ?? 0, MAX_BOARD_COMMENT_IMAGES);

  try {
    const detail = await getBoardPostDetail(postId, viewer);
    if (detail.post.isLocked) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '잠긴 게시글의 댓글은 수정할 수 없습니다.',
      });
    }

    const targetComment = detail.comments.find((comment) => comment.id === commentId);
    if (!targetComment) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '댓글을 찾을 수 없습니다.',
      });
    }

    if (targetComment.status !== 'active') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '비활성화된 댓글은 수정할 수 없습니다.',
      });
    }

    if (!viewer.isAdmin) {
      await assertCanInteractPost(detail.post, viewer);
    }

    if (!viewer.isAdmin && targetComment.authorId !== viewer.userId) {
      throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
        userMessage: '댓글 수정 권한이 없습니다.',
      });
    }

    const removedImages = findRemovedBoardImages(
      targetComment.imageAttachments,
      input.imageAttachments
    );

    await boardRepository.updateComment(postId, commentId, {
      ...(input.body !== undefined ? { body: sanitizeBoardText(input.body) } : {}),
      ...(input.imageAttachments !== undefined ? { imageAttachments: input.imageAttachments } : {}),
    });

    await cleanupBoardImages(removedImages, {
      operation: 'updateBoardComment',
      postId,
      commentId,
      viewerId: viewer.userId,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '댓글 수정',
      component: COMPONENT,
      context: { postId, commentId, viewerId: viewer.userId },
    });
  }
}

export async function setBoardCommentStatus(
  postId: string,
  commentId: string,
  viewer: Required<Pick<BoardViewer, 'userId'>> & Pick<BoardViewer, 'isAdmin'>,
  status: 'hidden' | 'deleted'
): Promise<void> {
  await requireMatchingCurrentUser(viewer.userId);
  try {
    const detail = await getBoardPostDetail(postId, viewer);
    const targetComment = detail.comments.find((comment) => comment.id === commentId);
    if (!targetComment) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '댓글을 찾을 수 없습니다.',
      });
    }

    if (targetComment.status !== 'active') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '비활성화된 댓글은 처리 상태를 바꿀 수 없습니다.',
      });
    }

    if (status === 'hidden') {
      if (!viewer.isAdmin) {
        throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '관리자만 댓글을 숨길 수 있습니다.',
        });
      }
    } else {
      if (!viewer.isAdmin) {
        await assertCanInteractPost(detail.post, viewer);
      }

      if (!viewer.isAdmin && targetComment.authorId !== viewer.userId) {
        throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
          userMessage: '댓글 삭제 권한이 없습니다.',
        });
      }
    }

    if (status === 'deleted' && detail.post.isLocked && !viewer.isAdmin) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '잠긴 게시글의 댓글은 삭제할 수 없습니다.',
      });
    }

    const imagesToCleanup = [...targetComment.imageAttachments];

    await boardRepository.setCommentStatus(postId, commentId, status);

    await cleanupBoardImages(imagesToCleanup, {
      operation: 'setBoardCommentStatus',
      postId,
      commentId,
      viewerId: viewer.userId,
      status,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: status === 'hidden' ? '댓글 숨김' : '댓글 삭제',
      component: COMPONENT,
      context: { postId, commentId, viewerId: viewer.userId },
    });
  }
}

export async function setBoardCommentPinned(
  postId: string,
  commentId: string,
  viewer: Required<Pick<BoardViewer, 'userId'>> & Pick<BoardViewer, 'isAdmin'>
): Promise<void> {
  await requireMatchingCurrentUser(viewer.userId);
  try {
    const detail = await getBoardPostDetail(postId, viewer);
    const targetComment = detail.comments.find((comment) => comment.id === commentId);
    if (!targetComment) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '댓글을 찾을 수 없습니다.',
      });
    }

    if (targetComment.parentCommentId) {
      throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage: '루트 댓글만 고정할 수 있습니다.',
      });
    }

    if (targetComment.status !== 'active') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '비활성화된 댓글은 고정할 수 없습니다.',
      });
    }

    if (!viewer.isAdmin && detail.post.authorId !== viewer.userId) {
      throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
        userMessage: '댓글 고정 권한이 없습니다.',
      });
    }

    await boardRepository.setCommentPinned(
      postId,
      commentId,
      !targetComment.isPinned,
      viewer.userId
    );
  } catch (error) {
    throw handleServiceError(error, {
      operation: '댓글 고정',
      component: COMPONENT,
      context: { postId, commentId, viewerId: viewer.userId },
    });
  }
}

export async function toggleBoardPostVote(
  postId: string,
  viewer: Required<Pick<BoardViewer, 'userId'>> & Pick<BoardViewer, 'isAdmin'>,
  type: BoardVoteType
): Promise<BoardVoteType | null> {
  await requireMatchingCurrentUser(viewer.userId);
  try {
    const post = await getBoardPostInternal(postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시글을 찾을 수 없습니다.',
      });
    }

    await assertCanInteractPost(post, viewer);
    return boardRepository.togglePostVote(postId, viewer.userId, type);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시글 반응',
      component: COMPONENT,
      context: { postId, viewerId: viewer.userId, type },
    });
  }
}

export async function toggleBoardCommentReaction(
  postId: string,
  commentId: string,
  viewer: Required<Pick<BoardViewer, 'userId'>> & Pick<BoardViewer, 'isAdmin'>,
  type: CommentReactionType
): Promise<CommentReactionType | null> {
  await requireMatchingCurrentUser(viewer.userId);
  try {
    const post = await getBoardPostInternal(postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시글을 찾을 수 없습니다.',
      });
    }

    await assertCanInteractPost(post, viewer);

    const targetComment = await boardRepository.getCommentById(postId, commentId);
    if (!targetComment || targetComment.status !== 'active') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '활성 상태인 댓글만 감정표현할 수 있습니다.',
      });
    }

    return boardRepository.toggleCommentReaction(postId, commentId, viewer.userId, type);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '댓글 감정표현',
      component: COMPONENT,
      context: { postId, commentId, viewerId: viewer.userId, type },
    });
  }
}

export async function createBoardReport(input: CreateBoardReportInput): Promise<string> {
  await requireMatchingCurrentUser(input.reporterId);
  assertSafeText('reason', input.reason, 80);
  if (input.details?.trim()) {
    assertSafeText('details', input.details, 1000);
  }

  try {
    const post = await getBoardPostInternal(input.postId);
    if (!post) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '신고 대상을 찾을 수 없습니다.',
      });
    }

    if (input.targetType === 'post') {
      if (post.boardType === 'notice') {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '공지사항은 신고할 수 없습니다.',
        });
      }

      if (post.authorId === input.reporterId) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '본인 게시글은 신고할 수 없습니다.',
        });
      }
    } else {
      if (post.boardType === 'notice') {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '공지사항 댓글은 신고할 수 없습니다.',
        });
      }

      const targetComment = await boardRepository.getCommentById(input.postId, input.targetId);
      if (!targetComment) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '신고할 댓글을 찾을 수 없습니다.',
        });
      }

      if (targetComment.status !== 'active') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '비활성화된 댓글은 신고할 수 없습니다.',
        });
      }

      if (targetComment.authorId === input.reporterId) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '본인 댓글은 신고할 수 없습니다.',
        });
      }
    }

    return await boardRepository.createReport({
      ...input,
      reason: sanitizeBoardText(input.reason),
      details: input.details ? sanitizeBoardText(input.details) : undefined,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 신고',
      component: COMPONENT,
      context: { postId: input.postId, reporterId: input.reporterId },
    });
  }
}

export async function getBoardReportsForAdmin(
  adminUserId: string,
  options: { status?: BoardReportFilterStatus; limitCount?: number } = {}
): Promise<BoardAdminReportRecord[]> {
  await requireAdminUser(adminUserId);

  try {
    const reports = await boardRepository.getReports({
      status: options.status ?? 'all',
      limitCount: options.limitCount,
    });

    return Promise.all(reports.map((report) => buildBoardAdminReportRecord(report)));
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 신고 목록 조회',
      component: COMPONENT,
      context: { adminUserId, status: options.status ?? 'all' },
    });
  }
}

export async function getBoardReportDetailForAdmin(
  reportId: string,
  adminUserId: string
): Promise<BoardAdminReportRecord> {
  await requireAdminUser(adminUserId);

  try {
    const report = await boardRepository.getReportById(reportId);
    if (!report) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시판 신고를 찾을 수 없습니다.',
      });
    }

    return buildBoardAdminReportRecord(report);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 신고 상세 조회',
      component: COMPONENT,
      context: { reportId, adminUserId },
    });
  }
}

export async function reviewBoardReport(
  reportId: string,
  adminUserId: string,
  status: BoardReportResolutionStatus
): Promise<void> {
  await requireAdminUser(adminUserId);

  try {
    const report = await boardRepository.getReportById(reportId);
    if (!report) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시판 신고를 찾을 수 없습니다.',
      });
    }

    if (report.status !== 'pending') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '이미 처리된 게시판 신고입니다.',
      });
    }

    await boardRepository.reviewReport(reportId, status, adminUserId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 신고 처리',
      component: COMPONENT,
      context: { reportId, adminUserId, status },
    });
  }
}

/**
 * @deprecated T-B12 — 직접 호출 금지. 대신 `enqueueScheduleBoardSync`를
 * 사용하여 outbox 패턴(`schedule_board_sync_outbox` 테이블 + Edge Function)을
 * 거칠 것. 본 함수는 outbox Edge Function 내부 또는 데이터 마이그레이션 스크립트
 * 에서만 사용해야 하며, 다음 마이너 릴리스에서 export 제거 예정.
 *
 * 마이그레이션 가이드:
 * ```typescript
 * // BEFORE
 * await syncScheduleBoardForJobPosting(jobPosting);
 *
 * // AFTER
 * import { enqueueScheduleBoardSync } from '@/services/jobs/jobManagementService';
 * await enqueueScheduleBoardSync(jobPosting.id, 'update', { jobPostingId: jobPosting.id });
 * ```
 */
export async function syncScheduleBoardForJobPosting(jobPosting: JobPosting): Promise<string> {
  try {
    const postId = await boardRepository.upsertSchedulePost({
      jobPostingId: jobPosting.id,
      title: jobPosting.title,
      body: buildScheduleBoardBody(jobPosting),
      ownerId: jobPosting.ownerId,
      ownerName: jobPosting.ownerName ?? '구인자',
      ownerRole: 'employer',
      workDate: jobPosting.workDate,
      workDates: jobPosting.workDates ?? [],
      locationName: jobPosting.location?.name ?? '',
      totalPositions: jobPosting.totalPositions,
      filledPositions: jobPosting.filledPositions,
      compensationLabel: formatCompensationLabel(jobPosting),
      jobPostingStatus: jobPosting.status,
    });

    const workLogs = await workLogRepository.getByJobPostingId(jobPosting.id);
    const memberships = buildScheduleSyncMembers(jobPosting, workLogs);
    await boardRepository.replaceScheduleMemberships(
      postId,
      jobPosting.id,
      memberships.map((membership) => ({
        userId: membership.userId,
        role: membership.role,
        displayName: membership.displayName,
        canRead: membership.canRead,
        canComment: membership.canComment,
        title: membership.title,
        workDate: membership.workDate,
        authorId: membership.authorId,
        lastActivityAt: membership.lastActivityAt,
      }))
    );

    return postId;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '일정게시판 동기화',
      component: COMPONENT,
      context: { jobPostingId: jobPosting.id },
    });
  }
}

/**
 * @deprecated T-B12 — 직접 호출 금지. `enqueueScheduleBoardSync(jobPostingId, 'update', ...)`
 * 사용. 본 함수는 outbox Edge Function 내부에서만 호출되어야 함.
 */
export async function syncScheduleBoardByJobPostingId(
  jobPostingId: string
): Promise<string | null> {
  try {
    const jobPosting = await jobPostingRepository.getById(jobPostingId);
    if (!jobPosting) {
      await setScheduleBoardStatusIfExists(jobPostingId, 'archived');
      return null;
    }

    return await syncScheduleBoardForJobPosting(jobPosting);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '일정게시판 공고 동기화',
      component: COMPONENT,
      context: { jobPostingId },
    });
  }
}

/**
 * @deprecated T-B12 — 직접 호출 금지. application의 jobPostingId를 조회한 뒤
 * `enqueueScheduleBoardSync(jobPostingId, 'update', ...)`를 사용. 본 함수는
 * outbox Edge Function 내부에서만 호출되어야 함.
 */
export async function syncScheduleBoardByApplicationId(
  applicationId: string
): Promise<string | null> {
  try {
    const application = await applicationRepository.getById(applicationId);
    if (!application?.jobPostingId) {
      return null;
    }

    return await syncScheduleBoardByJobPostingId(application.jobPostingId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '일정게시판 지원자 동기화',
      component: COMPONENT,
      context: { applicationId },
    });
  }
}

export async function archiveScheduleBoard(jobPostingId: string): Promise<void> {
  try {
    await setScheduleBoardStatusIfExists(jobPostingId, 'archived');
  } catch (error) {
    throw handleServiceError(error, {
      operation: '일정게시판 보관',
      component: COMPONENT,
      context: { jobPostingId },
    });
  }
}

export interface CreateSubstitutePostInput {
  authorId: string;
  authorName: string;
  authorRole: BoardAuthorRole;
  applicationId: string;
  jobSummary: BoardJobSummary;
  reason: string;
}

export async function createSubstitutePost(input: CreateSubstitutePostInput): Promise<string> {
  await requireMatchingCurrentUser(input.authorId);

  // 대타 글은 원 공고 연결이 필수 (아카이브 필터링 + 지원자 네비게이션에 사용).
  // 타입상 BoardJobSummary.jobPostingId는 string이지만 런타임 undefined/empty
  // 유입 방지를 위한 이중 가드.
  if (!input.jobSummary?.jobPostingId) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      field: 'jobSummary.jobPostingId',
      userMessage: '대타 구인 글 작성 시 원 공고 연결이 필수입니다.',
    });
  }

  const title = `대타 구해요 · ${input.jobSummary.title}`;
  const dateInfo = input.jobSummary.workDate || '';
  const locationInfo = input.jobSummary.locationName || '';
  const compensationInfo = input.jobSummary.compensationLabel || '';

  const body = [
    input.reason,
    '',
    dateInfo ? `📅 ${dateInfo}` : '',
    locationInfo ? `📍 ${locationInfo}` : '',
    compensationInfo ? `💰 ${compensationInfo}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  assertSafeText('title', title, 120);
  assertSafeText('body', body, 5000);

  try {
    return await boardRepository.createPost({
      boardType: 'substitute',
      title: sanitizeBoardText(title),
      body: sanitizeBoardText(body),
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      imageAttachments: [],
      linkedJobPostingId: input.jobSummary.jobPostingId,
      jobSummary: input.jobSummary,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '대타 구인 글 작성',
      component: COMPONENT,
      context: { authorId: input.authorId, applicationId: input.applicationId },
    });
  }
}

export async function archiveSubstitutePostByLinkedPosting(
  linkedJobPostingId: string,
  authorId: string
): Promise<void> {
  try {
    const posts = await boardRepository.getPosts({
      boardTypes: ['substitute'],
      statuses: ['active'],
      linkedJobPostingId,
      authorId,
      limitCount: 10,
    });

    for (const post of posts) {
      await boardRepository.setPostStatus(post.id, 'archived');
    }

    if (posts.length > 0) {
      logger.info('Substitute posts archived on cancellation rejection', {
        count: posts.length,
        linkedJobPostingId,
        authorId,
      });
    }
  } catch (error) {
    logger.warn('Failed to archive substitute posts (non-blocking)', {
      linkedJobPostingId,
      authorId,
      error,
    });
  }
}

export const boardService = {
  fetchBoardPosts,
  getBoardHomeData,
  getBoardPostDetail,
  getBoardMentionCandidates,
  incrementBoardPostViewCount,
  createBoardPost,
  createSubstitutePost,
  archiveSubstitutePostByLinkedPosting,
  updateBoardPost,
  setBoardPostLock,
  hideBoardPost,
  createBoardComment,
  updateBoardComment,
  setBoardCommentStatus,
  setBoardCommentPinned,
  toggleBoardPostVote,
  toggleBoardCommentReaction,
  createBoardReport,
  getBoardReportsForAdmin,
  getBoardReportDetailForAdmin,
  reviewBoardReport,
  syncScheduleBoardForJobPosting,
  syncScheduleBoardByJobPostingId,
  syncScheduleBoardByApplicationId,
  archiveScheduleBoard,
};

export default boardService;
