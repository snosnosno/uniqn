import React, { memo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Badge, Card } from '@/components/ui';
import { ROLE_LABELS } from '@/constants';
import {
  COMMENT_REACTION_LABELS,
  type BoardCommentNode,
  type CommentReactionType,
} from '@/types/board';
import { BoardImageGrid } from './BoardImageGrid';
import { BOARD_COMMENT_INDENT_STEP } from './boardDetailListItems';

interface BoardCommentItemProps {
  comment: BoardCommentNode;
  depth: number;
  currentUserId?: string;
  myReactions: Record<string, CommentReactionType>;
  canInteract: boolean;
  canManagePost: boolean;
  isAdmin: boolean;
  onPressImage?: (comment: BoardCommentNode, index: number) => void;
  onReply: (comment: BoardCommentNode) => void;
  onEdit: (comment: BoardCommentNode) => void;
  onDelete: (comment: BoardCommentNode) => void;
  onHide: (comment: BoardCommentNode) => void;
  onTogglePin: (comment: BoardCommentNode) => void;
  onToggleReaction: (comment: BoardCommentNode, type: CommentReactionType) => void;
  onReport: (comment: BoardCommentNode) => void;
}

const REACTION_TYPES = Object.keys(COMMENT_REACTION_LABELS) as CommentReactionType[];

function getRoleBadgeVariant(role: BoardCommentNode['authorRole']) {
  if (role === 'admin') {
    return 'error';
  }

  if (role === 'employer') {
    return 'primary';
  }

  return 'secondary';
}

function getAuthorRoleLabel(role: BoardCommentNode['authorRole']) {
  if (role === 'system') {
    return '시스템';
  }

  return ROLE_LABELS[role] ?? role;
}

export const BoardCommentItem = memo(function BoardCommentItem({
  comment,
  depth,
  currentUserId,
  myReactions,
  canInteract,
  canManagePost,
  isAdmin,
  onPressImage,
  onReply,
  onEdit,
  onDelete,
  onHide,
  onTogglePin,
  onToggleReaction,
  onReport,
}: BoardCommentItemProps) {
  const isOwnComment = comment.authorId === currentUserId;
  const activeReaction = myReactions[comment.id];
  const canPin = !comment.parentCommentId && canManagePost && comment.status === 'active';
  const contentDisabled = comment.status !== 'active';

  return (
    <View style={{ marginLeft: depth * BOARD_COMMENT_INDENT_STEP }} className="mb-3">
      <Card className="bg-white dark:bg-surface">
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {comment.authorName}
          </Text>
          <Badge variant={getRoleBadgeVariant(comment.authorRole)} size="sm">
            {getAuthorRoleLabel(comment.authorRole)}
          </Badge>
          {comment.isPinned ? (
            <Badge variant="warning" size="sm">
              고정
            </Badge>
          ) : null}
        </View>

        <Text className="text-sm leading-6 text-gray-700 dark:text-gray-300">{comment.body}</Text>

        {!contentDisabled ? (
          <BoardImageGrid
            images={comment.imageAttachments}
            onPressImage={onPressImage ? (index) => onPressImage(comment, index) : undefined}
          />
        ) : null}

        {!contentDisabled ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            {REACTION_TYPES.map((reactionType, index) => {
              const count = comment.reactionCounts[reactionType] ?? 0;
              const isActive = activeReaction === reactionType;

              return (
                <Pressable
                  key={reactionType}
                  onPress={() => onToggleReaction(comment, reactionType)}
                  disabled={!canInteract}
                  style={{ marginRight: index === REACTION_TYPES.length - 1 ? 0 : 8 }}
                  className={`rounded-full px-2.5 py-1 ${
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/30'
                      : 'bg-gray-100 dark:bg-surface-elevated'
                  } ${!canInteract ? 'opacity-50' : 'active:opacity-70'}`}
                >
                  <Text className="text-xs text-gray-700 dark:text-gray-200">
                    {COMMENT_REACTION_LABELS[reactionType]} {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View className="mt-3 flex-row flex-wrap items-center gap-3">
          {canInteract && !contentDisabled ? (
            <Pressable onPress={() => onReply(comment)} className="active:opacity-70">
              <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
                답글
              </Text>
            </Pressable>
          ) : null}

          {isOwnComment && !contentDisabled ? (
            <>
              {canInteract ? (
                <Pressable onPress={() => onEdit(comment)} className="active:opacity-70">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">수정</Text>
                </Pressable>
              ) : null}
              {canInteract ? (
                <Pressable onPress={() => onDelete(comment)} className="active:opacity-70">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">삭제</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {canPin ? (
            <Pressable onPress={() => onTogglePin(comment)} className="active:opacity-70">
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {comment.isPinned ? '고정 해제' : '고정'}
              </Text>
            </Pressable>
          ) : null}

          {isAdmin && !contentDisabled ? (
            <Pressable onPress={() => onHide(comment)} className="active:opacity-70">
              <Text className="text-xs text-error-600 dark:text-error-400">숨김</Text>
            </Pressable>
          ) : null}

          {!isOwnComment && !contentDisabled ? (
            <Pressable onPress={() => onReport(comment)} className="active:opacity-70">
              <Text className="text-xs text-gray-500 dark:text-gray-400">신고</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>
    </View>
  );
});

export default BoardCommentItem;
