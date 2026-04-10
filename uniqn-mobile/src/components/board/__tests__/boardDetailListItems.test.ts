import { buildBoardDetailListItems, MAX_BOARD_COMMENT_VISUAL_DEPTH } from '../boardDetailListItems';
import type { BoardCommentNode } from '@/types/board';

function createCommentNode(
  id: string,
  overrides: Partial<BoardCommentNode> = {},
  children: BoardCommentNode[] = []
): BoardCommentNode {
  return {
    id,
    postId: 'post-1',
    body: `comment-${id}`,
    authorId: `author-${id}`,
    authorName: `Author ${id}`,
    authorRole: 'staff',
    mentionedUserIds: [],
    reactionCounts: {},
    isPinned: false,
    status: 'active',
    imageAttachments: [],
    children,
    createdAt: new Date(
      `2026-01-0${Math.min(Number(id.replace(/\D/g, '') || '1'), 9)}T00:00:00.000Z`
    ),
    updatedAt: new Date(
      `2026-01-0${Math.min(Number(id.replace(/\D/g, '') || '1'), 9)}T00:00:00.000Z`
    ),
    ...overrides,
  };
}

describe('buildBoardDetailListItems', () => {
  it('places the inline composer directly after the target comment and caps visual depth', () => {
    const deepTree = createCommentNode('c1', {}, [
      createCommentNode('c2', {}, [
        createCommentNode('c3', {}, [createCommentNode('c4', {}, [createCommentNode('c5')])]),
      ]),
    ]);
    const pinnedComment = createCommentNode('p1', { isPinned: true });

    const items = buildBoardDetailListItems({
      pinnedComments: [pinnedComment],
      regularComments: [deepTree],
      commentsCount: 6,
      isLocked: false,
      canInteract: true,
      composerMode: 'reply',
      composerTargetCommentId: 'c2',
    });

    const commentItems = items.filter((item) => item.type === 'comment');
    const composerIndex = items.findIndex((item) => item.type === 'composer');
    const targetCommentIndex = items.findIndex(
      (item) => item.type === 'comment' && item.comment.id === 'c2'
    );

    expect(composerIndex).toBe(targetCommentIndex + 1);
    expect(commentItems.map((item) => item.depth)).toEqual([
      0,
      0,
      1,
      2,
      MAX_BOARD_COMMENT_VISUAL_DEPTH,
      MAX_BOARD_COMMENT_VISUAL_DEPTH,
    ]);
  });

  it('adds an empty row and root composer when there are no regular comments', () => {
    const items = buildBoardDetailListItems({
      pinnedComments: [],
      regularComments: [],
      commentsCount: 0,
      isLocked: true,
      canInteract: false,
      composerMode: 'create',
      composerTargetCommentId: null,
    });

    expect(items.map((item) => item.type)).toEqual(['section', 'empty', 'composer']);
    expect(items[0]).toMatchObject({ type: 'section', section: 'comments', isLocked: true });
    expect(items[1]).toMatchObject({
      type: 'empty',
      title: '댓글이 잠겨 있어요',
      description: '잠금이 해제되면 새 댓글을 남길 수 있어요.',
    });
    expect(items[2]).toMatchObject({ type: 'composer', mode: 'create', targetCommentId: null });
  });
});
