import { Pressable, Text, View } from 'react-native';
import { Badge, Card } from '@/components/ui';
import { ROLE_LABELS } from '@/constants';
import {
  COMMENT_REACTION_LABELS,
  type BoardCommentNode,
  type CommentReactionType,
} from '@/types/board';
import { BoardImageGrid } from './BoardImageGrid';

interface BoardCommentThreadProps {
  comments: BoardCommentNode[];
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

interface CommentNodeViewProps extends Omit<BoardCommentThreadProps, 'comments'> {
  comment: BoardCommentNode;
  depth: number;
}

function CommentNodeView({
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
}: CommentNodeViewProps) {
  const isOwnComment = comment.authorId === currentUserId;
  const activeReaction = myReactions[comment.id];
  const canPin = !comment.parentCommentId && canManagePost && comment.status === 'active';
  const contentDisabled = comment.status !== 'active';
  const indentationDepth = Math.min(depth, 6);

  return (
    <View style={{ marginLeft: indentationDepth * 12 }} className="mb-3">
      <Card className="bg-white dark:bg-surface">
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-sans-semibold text-secondary-900 dark:text-secondary-100">
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

        <Text className="text-sm leading-6 text-secondary-700 dark:text-secondary-300 font-sans">
          {comment.body}
        </Text>

        {!contentDisabled ? (
          <BoardImageGrid
            images={comment.imageAttachments}
            onPressImage={onPressImage ? (index) => onPressImage(comment, index) : undefined}
          />
        ) : null}

        {!contentDisabled ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {REACTION_TYPES.map((reactionType) => {
              const count = comment.reactionCounts[reactionType] ?? 0;
              const isActive = activeReaction === reactionType;

              return (
                <Pressable
                  key={reactionType}
                  onPress={() => onToggleReaction(comment, reactionType)}
                  disabled={!canInteract}
                  className={`rounded-sm px-2 py-1 ${
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/30'
                      : 'bg-secondary-100 dark:bg-surface-elevated'
                  } ${!canInteract ? 'opacity-50' : 'active:opacity-70'}`}
                >
                  <Text className="text-xs text-secondary-700 dark:text-secondary-200 font-sans">
                    {COMMENT_REACTION_LABELS[reactionType]} {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View className="mt-3 flex-row flex-wrap items-center gap-3">
          {canInteract && !contentDisabled ? (
            <Pressable onPress={() => onReply(comment)} className="active:opacity-70">
              <Text className="text-xs font-sans-medium text-primary-600 dark:text-primary-400">
                답글
              </Text>
            </Pressable>
          ) : null}

          {isOwnComment && !contentDisabled ? (
            <>
              {canInteract ? (
                <Pressable onPress={() => onEdit(comment)} className="active:opacity-70">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    수정
                  </Text>
                </Pressable>
              ) : null}
              {canInteract ? (
                <Pressable onPress={() => onDelete(comment)} className="active:opacity-70">
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    삭제
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {canPin ? (
            <Pressable onPress={() => onTogglePin(comment)} className="active:opacity-70">
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                {comment.isPinned ? '고정 해제' : '고정'}
              </Text>
            </Pressable>
          ) : null}

          {isAdmin && !contentDisabled ? (
            <Pressable onPress={() => onHide(comment)} className="active:opacity-70">
              <Text className="text-xs text-error-600 dark:text-error-400 font-sans">숨김</Text>
            </Pressable>
          ) : null}

          {!isOwnComment && !contentDisabled ? (
            <Pressable onPress={() => onReport(comment)} className="active:opacity-70">
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                신고
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      {comment.children.length > 0 ? (
        <View className="mt-3">
          {comment.children.map((child) => (
            <CommentNodeView
              key={child.id}
              comment={child}
              depth={depth + 1}
              currentUserId={currentUserId}
              myReactions={myReactions}
              canInteract={canInteract}
              canManagePost={canManagePost}
              isAdmin={isAdmin}
              onPressImage={onPressImage}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onHide={onHide}
              onTogglePin={onTogglePin}
              onToggleReaction={onToggleReaction}
              onReport={onReport}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function BoardCommentThread({ comments, ...props }: BoardCommentThreadProps) {
  return (
    <View>
      {comments.map((comment) => (
        <CommentNodeView key={comment.id} comment={comment} depth={0} {...props} />
      ))}
    </View>
  );
}

export default BoardCommentThread;
