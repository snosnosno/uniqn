import {
  BusinessError,
  ERROR_CODES,
  PermissionError,
  ValidationError,
  handleServiceError,
} from '@/errors';
import { boardRepository } from '@/repositories';
import { requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import {
  MAX_BOARD_COMMENT_IMAGES,
  type BoardAuthorRole,
  type BoardMentionCandidate,
  type CreateBoardCommentInput,
  type UpdateBoardCommentInput,
} from '@/types/board';
import {
  COMPONENT,
  type BoardViewer,
  type MentionCandidateSource,
  assertCanInteractPost,
  assertCanViewPost,
  assertImageLimit,
  assertSafeText,
  cleanupBoardImages,
  findRemovedBoardImages,
  getBoardPostOrThrow,
  mapMembershipRoleToAuthorRole,
  normalizeMentionIds,
  resolveMentionCandidates,
  sanitizeBoardText,
} from './boardServiceShared';
import { getBoardPostDetail } from './boardPostService';

export async function getBoardMentionCandidates(
  postId: string,
  viewer: BoardViewer
): Promise<BoardMentionCandidate[]> {
  try {
    const post = await getBoardPostOrThrow(postId);

    await assertCanViewPost(post, viewer);

    const authorCandidate: MentionCandidateSource = {
      userId: post.authorId,
      displayName: post.authorName,
      role: post.authorRole,
      isAuthor: true,
    };

    if (post.boardType === 'schedule') {
      const memberships = (await boardRepository.getMembershipsByPost(post.id)).filter(
        (membership) => membership.canRead
      );
      return resolveMentionCandidates([
        authorCandidate,
        ...memberships.map((membership) => ({
          userId: membership.userId,
          displayName: membership.displayName,
          role: mapMembershipRoleToAuthorRole(membership.role),
          isAuthor: membership.role === 'author',
        })),
      ]);
    }

    if (post.boardType === 'notice') {
      return resolveMentionCandidates([authorCandidate]);
    }

    const comments = (await boardRepository.getComments(post.id)).filter(
      (comment) => comment.status === 'active'
    );
    return resolveMentionCandidates([
      authorCandidate,
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
    const post = await getBoardPostOrThrow(input.postId);

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
