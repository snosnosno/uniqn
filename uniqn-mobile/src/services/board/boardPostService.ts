import { BusinessError, ERROR_CODES, handleServiceError } from '@/errors';
import { handleSilentError } from '@/errors/serviceErrorHandler';
import { announcementRepository, boardRepository } from '@/repositories';
import { requireAdminUser, requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import {
  MAX_BOARD_POST_IMAGES,
  BOARD_TYPE_LABELS,
  buildBoardCommentTree,
  mapAnnouncementToBoardPost,
  type BoardAuthorRole,
  type BoardHomeData,
  type BoardPost,
  type CommentReactionType,
  type CreateBoardPostInput,
  type FetchBoardPostsInput,
  type UpdateBoardPostInput,
} from '@/types/board';
import { isBoardNoticePostId, extractAnnouncementIdFromBoardPostId } from '@/shared/board/boardIds';
import { logger } from '@/utils/logger';
import {
  ACTIVE_POST_STATUSES,
  ADMIN_VISIBLE_POST_STATUSES,
  COMPONENT,
  type BoardPostDetail,
  type BoardViewer,
  assertCanManagePost,
  assertCanViewPost,
  assertCanCreatePost,
  assertImageLimit,
  assertSafeText,
  cleanupBoardImages,
  findRemovedBoardImages,
  getBoardPostOrThrow,
  resolveBoardHomeSection,
  sanitizeBoardText,
} from './boardServiceShared';
import { getSchedulePostsForMemberships, sortSchedulePosts } from './boardScheduleService';

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
            .slice(0, 5);
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
    const post = await getBoardPostOrThrow(postId);

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

    const resolveOptionalLookup = <TValue, TFallback>(
      result: PromiseSettledResult<TValue>,
      warnMessage: string,
      transform: (value: TValue) => TFallback,
      fallback: TFallback
    ): TFallback => {
      if (result.status === 'fulfilled') {
        return transform(result.value);
      }

      logger.warn(warnMessage, {
        component: COMPONENT,
        postId,
        viewerId: viewer.userId ?? null,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      return fallback;
    };

    const comments = commentsResult.value;
    const myVote = resolveOptionalLookup(
      myVoteResult,
      'Optional board detail vote lookup failed',
      (vote) => vote?.type ?? null,
      null
    );
    const myReactions = resolveOptionalLookup(
      myReactionsResult,
      'Optional board detail reaction lookup failed',
      (reactions) => reactions,
      {} as Record<string, CommentReactionType>
    );

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

export async function incrementBoardPostViewCount(postId: string): Promise<void> {
  try {
    if (isBoardNoticePostId(postId)) {
      await announcementRepository.incrementViewCount(extractAnnouncementIdFromBoardPostId(postId));
      return;
    }

    await boardRepository.incrementViewCount(postId);
  } catch (error) {
    // 조회수 증가 실패는 비핵심 — 조용히 삼킨다(handleSilentError 는 void 반환이라 throw 금지).
    handleSilentError(error, {
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
    const post = await getBoardPostOrThrow(postId);

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
    const post = await getBoardPostOrThrow(postId);

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
    const post = await getBoardPostOrThrow(postId);

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
