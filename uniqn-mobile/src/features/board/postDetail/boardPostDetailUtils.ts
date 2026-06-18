import { createContext, type RefObject } from 'react';
import { type TextInput } from 'react-native';
import { ROLE_LABELS } from '@/constants';
import {
  type BoardCommentNode,
  type BoardImageAttachment,
  type BoardMentionCandidate,
} from '@/types/board';

export interface BoardDetailComposerContextValue {
  draftBody: string;
  draftImages: BoardImageAttachment[];
  inputRef: RefObject<TextInput | null>;
  replyTargetName?: string;
  canInteract: boolean;
  mentionCandidates: BoardMentionCandidate[];
  selectedMentionIds: string[];
  isCommentSubmitting: boolean;
  isUploadingCommentImages: boolean;
  composerPlaceholder: string;
  onChangeText: (value: string) => void;
  onToggleMention: (userId: string) => void;
  onRemoveImage: (imageId: string) => void;
  onPickImages: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onFocusItem: (itemKey: string) => void;
}

export const BoardDetailComposerContext = createContext<BoardDetailComposerContextValue | null>(
  null
);

export function getAuthorBadgeVariant(authorRole: string) {
  if (authorRole === 'admin') {
    return 'error';
  }

  if (authorRole === 'employer') {
    return 'info';
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
