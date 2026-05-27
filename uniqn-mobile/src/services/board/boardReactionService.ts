import { BusinessError, ERROR_CODES, handleServiceError } from '@/errors';
import { boardRepository } from '@/repositories';
import { requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import { type CommentReactionType, type BoardVoteType } from '@/types/board';
import {
  COMPONENT,
  type BoardViewer,
  assertCanInteractPost,
  getBoardPostOrThrow,
} from './boardServiceShared';

export async function toggleBoardPostVote(
  postId: string,
  viewer: Required<Pick<BoardViewer, 'userId'>> & Pick<BoardViewer, 'isAdmin'>,
  type: BoardVoteType
): Promise<BoardVoteType | null> {
  await requireMatchingCurrentUser(viewer.userId);
  try {
    const post = await getBoardPostOrThrow(postId);

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
    const post = await getBoardPostOrThrow(postId);

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
