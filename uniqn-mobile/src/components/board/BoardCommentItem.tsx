import React, { memo, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActionSheet, type ActionSheetOption, Badge, Card } from '@/components/ui';
import { ROLE_LABELS } from '@/constants';
import { EllipsisHorizontalIcon, PlusIcon } from '@/components/icons';
import {
  COMMENT_REACTION_LABELS,
  type BoardCommentNode,
  type CommentReactionType,
} from '@/types/board';
import { formatDateTime } from '@/utils/date';
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
    return 'info';
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
  const createdAtLabel = formatDateTime(comment.createdAt);
  const indentationOffset = depth * BOARD_COMMENT_INDENT_STEP;
  const hasDepthIndicator = depth > 0;

  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

  const visibleReactions = useMemo(
    () =>
      REACTION_TYPES.filter(
        (type) => (comment.reactionCounts[type] ?? 0) > 0 || activeReaction === type
      ),
    [activeReaction, comment.reactionCounts]
  );

  const reactionPickerOptions = useMemo<ActionSheetOption[]>(
    () =>
      REACTION_TYPES.map((type) => ({
        label: `${COMMENT_REACTION_LABELS[type]} ${comment.reactionCounts[type] ?? 0}`,
        value: type,
      })),
    [comment.reactionCounts]
  );

  const actionMenuOptions = useMemo<ActionSheetOption[]>(() => {
    const options: ActionSheetOption[] = [];

    if (isOwnComment && !contentDisabled && canInteract) {
      options.push({ label: '수정', value: 'edit' });
      options.push({ label: '삭제', value: 'delete', destructive: true });
    }
    if (canPin) {
      options.push({
        label: comment.isPinned ? '고정 해제' : '고정',
        value: 'pin',
      });
    }
    if (isAdmin && !contentDisabled) {
      options.push({ label: '숨김', value: 'hide', destructive: true });
    }
    if (!isOwnComment && !contentDisabled) {
      options.push({ label: '신고', value: 'report' });
    }

    return options;
  }, [canInteract, canPin, comment.isPinned, contentDisabled, isAdmin, isOwnComment]);

  const handleReactionPickerSelect = (value: string) => {
    onToggleReaction(comment, value as CommentReactionType);
  };

  const handleActionMenuSelect = (value: string) => {
    if (value === 'edit') {
      onEdit(comment);
    } else if (value === 'delete') {
      onDelete(comment);
    } else if (value === 'pin') {
      onTogglePin(comment);
    } else if (value === 'hide') {
      onHide(comment);
    } else if (value === 'report') {
      onReport(comment);
    }
  };

  return (
    <View style={{ marginLeft: indentationOffset }} className="mb-3">
      <View
        className={
          hasDepthIndicator
            ? 'border-l-2 border-secondary-200 pl-3 dark:border-surface-overlay'
            : ''
        }
      >
        <Card className="border border-secondary-100 bg-white dark:border-surface-overlay dark:bg-surface">
          {contentDisabled ? (
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm font-sans italic leading-6 text-content-placeholder dark:text-secondary-500">
                {comment.body}
              </Text>
              {createdAtLabel ? (
                <Text className="text-xs text-content-placeholder font-sans">{createdAtLabel}</Text>
              ) : null}
            </View>
          ) : (
            <>
              <View className="mb-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
                <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
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
                {createdAtLabel ? (
                  <Text className="ml-auto text-xs text-content-placeholder font-sans">
                    {createdAtLabel}
                  </Text>
                ) : null}
              </View>

              <Text className="text-sm font-sans leading-6 text-secondary-700 dark:text-secondary-300">
                {comment.body}
              </Text>
            </>
          )}

          {!contentDisabled ? (
            <BoardImageGrid
              images={comment.imageAttachments}
              onPressImage={onPressImage ? (index) => onPressImage(comment, index) : undefined}
            />
          ) : null}

          {!contentDisabled || actionMenuOptions.length > 0 ? (
            <View className="mt-4 flex-row items-center justify-between gap-2">
              <View className="flex-1 flex-row flex-wrap items-center gap-2">
                {!contentDisabled
                  ? visibleReactions.map((type) => {
                      const count = comment.reactionCounts[type] ?? 0;
                      const isActive = activeReaction === type;

                      return (
                        <Pressable
                          key={type}
                          onPress={() => onToggleReaction(comment, type)}
                          disabled={!canInteract}
                          hitSlop={8}
                          accessibilityRole="button"
                          className={`rounded-sm px-2.5 py-1 ${
                            isActive
                              ? 'bg-primary-100 dark:bg-primary-900/30'
                              : 'bg-secondary-100 dark:bg-surface-elevated'
                          } ${!canInteract ? 'opacity-50' : 'active:opacity-70'}`}
                        >
                          <Text
                            className={`text-xs font-sans-medium ${
                              isActive
                                ? 'text-primary-700 dark:text-primary-300'
                                : 'text-content-secondary dark:text-secondary-200'
                            }`}
                          >
                            {COMMENT_REACTION_LABELS[type]} {count}
                          </Text>
                        </Pressable>
                      );
                    })
                  : null}

                {!contentDisabled && canInteract ? (
                  <Pressable
                    onPress={() => setReactionPickerVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="반응 추가"
                    hitSlop={6}
                    className="flex-row items-center gap-1 rounded-sm bg-secondary-100 px-2.5 py-1 dark:bg-surface-elevated active:opacity-70"
                  >
                    <PlusIcon size={12} />
                    <Text className="text-xs font-sans-medium text-content-muted dark:text-secondary-300">
                      반응
                    </Text>
                  </Pressable>
                ) : null}

                {canInteract && !contentDisabled ? (
                  <Pressable
                    onPress={() => onReply(comment)}
                    hitSlop={10}
                    className="rounded-sm bg-primary-50 px-3 py-1 dark:bg-primary-900/20 active:opacity-70"
                  >
                    <Text className="text-xs font-sans-semibold text-primary-700 dark:text-primary-300">
                      답글
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {actionMenuOptions.length > 0 ? (
                <Pressable
                  onPress={() => setActionMenuVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="댓글 메뉴"
                  hitSlop={10}
                  className="rounded-sm p-1.5 active:opacity-70"
                >
                  <EllipsisHorizontalIcon size={18} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>
      </View>

      <ActionSheet
        visible={reactionPickerVisible}
        onClose={() => setReactionPickerVisible(false)}
        title="반응 추가"
        options={reactionPickerOptions}
        onSelect={handleReactionPickerSelect}
      />

      <ActionSheet
        visible={actionMenuVisible}
        onClose={() => setActionMenuVisible(false)}
        options={actionMenuOptions}
        onSelect={handleActionMenuSelect}
      />
    </View>
  );
});
