import { BusinessError, ERROR_CODES, handleServiceError } from '@/errors';
import { handleSilentError } from '@/errors/serviceErrorHandler';
import { announcementRepository, boardRepository } from '@/repositories';
import { requireAdminUser, requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import {
  BOARD_TYPE_LABELS,
  buildBoardCommentTree,
  mapAnnouncementToBoardPost,
  type BoardPost,
  type CommentReactionType,
  type FetchBoardPostsInput,
} from '@/types/board';
import { isBoardNoticePostId, extractAnnouncementIdFromBoardPostId } from '@/shared/board/boardIds';
import { logger } from '@/utils/logger';
import {
  ADMIN_VISIBLE_POST_STATUSES,
  COMPONENT,
  type BoardPostDetail,
  type BoardViewer,
  assertCanManagePost,
  assertCanViewPost,
  getBoardPostOrThrow,
} from './boardServiceShared';
import { getSchedulePostsForMemberships, sortSchedulePosts } from './boardScheduleService';

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

    return [];
  } catch (error) {
    throw handleServiceError(error, {
      operation: `${BOARD_TYPE_LABELS[input.boardType]} 목록 조회`,
      component: COMPONENT,
      context: { boardType: input.boardType, viewerId: input.viewerId },
    });
  }
}

export async function getBoardPostDetail(
  postId: string,
  viewer: BoardViewer
): Promise<BoardPostDetail> {
  try {
    const post = await getBoardPostOrThrow(postId);

    if (post.boardType !== 'notice' && post.boardType !== 'schedule') {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '더 이상 제공하지 않는 소통 유형입니다.',
      });
    }

    const membership = await assertCanViewPost(post, viewer);

    if (post.boardType === 'notice') {
      return {
        post,
        comments: [],
        commentTree: [],
        membership,
        myReactions: {},
      };
    }

    const [commentsResult, myReactionsResult] = await Promise.allSettled([
      boardRepository.getComments(post.id),
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
