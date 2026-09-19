import { Pressable, Text, View } from 'react-native';
import { BoardImageGrid } from '@/components/board/BoardImageGrid';
import { Badge, Card } from '@/components/ui';
import { EllipsisHorizontalIcon } from '@/components/icons';
import { BOARD_TYPE_LABELS, type BoardImageAttachment, type BoardPost } from '@/types/board';
import { getAuthorBadgeVariant, getAuthorRoleLabel } from './boardPostDetailUtils';

interface PostHeaderProps {
  post: BoardPost;
  canManagePost: boolean;
  isAdmin: boolean;
  canReportPost: boolean;
  postCreatedAtLabel: string;
  postLastActivityLabel: string;
  onPressMenu: () => void;
  onPressImage: (images: BoardImageAttachment[], index: number) => void;
}

export function PostHeader({
  post,
  canManagePost,
  isAdmin,
  canReportPost,
  postCreatedAtLabel,
  postLastActivityLabel,
  onPressMenu,
  onPressImage,
}: PostHeaderProps) {
  const showActionBar = canManagePost || (isAdmin && post.boardType !== 'notice') || canReportPost;

  return (
    <View className="pb-2">
      <View className="mb-3 flex-row flex-wrap items-center gap-2">
        <Badge variant="secondary" size="sm">
          {BOARD_TYPE_LABELS[post.boardType]}
        </Badge>
        <Badge variant={getAuthorBadgeVariant(post.authorRole)} size="sm">
          {getAuthorRoleLabel(post.authorRole)}
        </Badge>
        {post.isPinned ? (
          <Badge variant="warning" size="sm">
            공지
          </Badge>
        ) : null}
        {post.isLocked ? (
          <Badge variant="error" size="sm">
            잠금
          </Badge>
        ) : null}
      </View>

      <Card className="mb-4 border border-secondary-100 dark:border-surface-overlay">
        <View className="flex-row items-start gap-3">
          <Text className="flex-1 text-2xl font-display leading-9 text-content-primary dark:text-secondary-100">
            {post.title}
          </Text>
          {showActionBar ? (
            <Pressable
              testID={`board-post-menu-${post.id}`}
              accessibilityRole="button"
              accessibilityLabel="게시글 메뉴"
              onPress={onPressMenu}
              hitSlop={10}
              className="-mr-1 -mt-1 rounded-sm p-2 active:opacity-70"
            >
              <EllipsisHorizontalIcon size={20} />
            </Pressable>
          ) : null}
        </View>

        <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text className="text-sm font-sans-medium text-content-secondary dark:text-secondary-200">
            {post.authorName}
          </Text>
          {postCreatedAtLabel ? (
            <>
              <View className="h-1 w-1 rounded-sm bg-secondary-300 dark:bg-secondary-600" />
              <Text className="text-xs text-content-secondary font-sans">{postCreatedAtLabel}</Text>
            </>
          ) : null}
        </View>

        <Text className="mt-5 text-base leading-8 text-content-secondary font-sans">
          {post.body}
        </Text>

        <BoardImageGrid
          images={post.imageAttachments}
          onPressImage={(index) => onPressImage(post.imageAttachments, index)}
        />

        {post.boardType !== 'notice' ? (
          <View className="mt-5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-xs text-content-secondary font-sans">
              댓글 {post.commentCount}
            </Text>
            {postLastActivityLabel ? (
              <>
                <View className="h-1 w-1 rounded-sm bg-secondary-300 dark:bg-secondary-600" />
                <Text className="text-xs text-content-secondary font-sans">
                  {postLastActivityLabel} 활동
                </Text>
              </>
            ) : null}
          </View>
        ) : null}
      </Card>
    </View>
  );
}
