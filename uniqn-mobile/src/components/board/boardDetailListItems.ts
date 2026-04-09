import type { BoardCommentNode } from '@/types/board';

export type BoardComposerMode = 'create' | 'reply' | 'edit';

export const BOARD_COMMENT_INDENT_STEP = 8;
export const MAX_BOARD_COMMENT_VISUAL_DEPTH = 3;

export interface BoardDetailSectionItem {
  type: 'section';
  key: string;
  section: 'pinned' | 'comments';
  title: string;
  count?: number;
  isLocked?: boolean;
}

export interface BoardDetailCommentItem {
  type: 'comment';
  key: string;
  comment: BoardCommentNode;
  depth: number;
}

export interface BoardDetailComposerItem {
  type: 'composer';
  key: string;
  mode: BoardComposerMode;
  targetCommentId: string | null;
}

export interface BoardDetailEmptyItem {
  type: 'empty';
  key: string;
  title: string;
  description: string;
}

export type BoardDetailListItem =
  | BoardDetailSectionItem
  | BoardDetailCommentItem
  | BoardDetailComposerItem
  | BoardDetailEmptyItem;

interface BuildBoardDetailListItemsInput {
  pinnedComments: BoardCommentNode[];
  regularComments: BoardCommentNode[];
  commentsCount: number;
  isLocked: boolean;
  composerMode: BoardComposerMode;
  composerTargetCommentId?: string | null;
}

export function getBoardComposerItemKey(
  mode: BoardComposerMode,
  targetCommentId?: string | null
): string {
  if (mode === 'create' || !targetCommentId) {
    return 'composer:root';
  }

  return `composer:${mode}:${targetCommentId}`;
}

function flattenCommentTree(
  comments: BoardCommentNode[],
  depth = 0,
  items: BoardDetailCommentItem[] = []
): BoardDetailCommentItem[] {
  comments.forEach((comment) => {
    items.push({
      type: 'comment',
      key: `comment:${comment.id}`,
      comment,
      depth: Math.min(depth, MAX_BOARD_COMMENT_VISUAL_DEPTH),
    });

    if (comment.children.length > 0) {
      flattenCommentTree(comment.children, depth + 1, items);
    }
  });

  return items;
}

export function buildBoardDetailListItems({
  pinnedComments,
  regularComments,
  commentsCount,
  isLocked,
  composerMode,
  composerTargetCommentId = null,
}: BuildBoardDetailListItemsInput): BoardDetailListItem[] {
  const items: BoardDetailListItem[] = [];

  if (pinnedComments.length > 0) {
    items.push({
      type: 'section',
      key: 'section:pinned',
      section: 'pinned',
      title: '고정 댓글',
    });
    items.push(...flattenCommentTree(pinnedComments));
  }

  items.push({
    type: 'section',
    key: 'section:comments',
    section: 'comments',
    title: '댓글',
    count: commentsCount,
    isLocked,
  });

  if (regularComments.length > 0) {
    items.push(...flattenCommentTree(regularComments));
  } else {
    items.push({
      type: 'empty',
      key: 'comments:empty',
      title: '아직 댓글이 없어요',
      description: '첫 댓글을 남겨보세요.',
    });
  }

  const composerItem: BoardDetailComposerItem = {
    type: 'composer',
    key: getBoardComposerItemKey(composerMode, composerTargetCommentId),
    mode: composerMode,
    targetCommentId: composerTargetCommentId,
  };

  if (composerMode !== 'create' && composerTargetCommentId) {
    const targetIndex = items.findIndex(
      (item) => item.type === 'comment' && item.comment.id === composerTargetCommentId
    );

    if (targetIndex >= 0) {
      items.splice(targetIndex + 1, 0, composerItem);
      return items;
    }
  }

  items.push({
    ...composerItem,
    mode: 'create',
    key: getBoardComposerItemKey('create'),
    targetCommentId: null,
  });

  return items;
}
