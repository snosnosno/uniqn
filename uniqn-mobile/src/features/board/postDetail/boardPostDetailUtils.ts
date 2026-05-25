import { ROLE_LABELS } from '@/constants';
import { type BoardCommentNode } from '@/types/board';

export function getAuthorBadgeVariant(authorRole: string) {
  if (authorRole === 'admin') {
    return 'error';
  }

  if (authorRole === 'employer') {
    return 'primary';
  }

  return 'secondary';
}

export function getAuthorRoleLabel(authorRole: string) {
  if (authorRole === 'system') {
    return '시스템';
  }

  return ROLE_LABELS[authorRole] ?? authorRole;
}

export function getComposerPlaceholder(canInteract: boolean, isLocked: boolean) {
  if (isLocked) {
    return '잠긴 게시글입니다.';
  }

  if (!canInteract) {
    return '댓글을 남길 수 없어요.';
  }

  return '댓글을 입력해 주세요.';
}

export function getPostFallbackHref(boardType?: string | null) {
  return boardType ? `/(app)/(tabs)/board/${boardType}` : '/(app)/(tabs)/board';
}

export function hasCommentWithId(comments: BoardCommentNode[], targetCommentId: string): boolean {
  const stack = [...comments];

  while (stack.length > 0) {
    const comment = stack.pop();

    if (!comment) {
      continue;
    }

    if (comment.id === targetCommentId) {
      return true;
    }

    if (comment.children.length > 0) {
      stack.push(...comment.children);
    }
  }

  return false;
}
