import { Text, View } from 'react-native';
import { Badge, Card } from '@/components/ui';
import {
  ChatbubbleEllipsesOutlineIcon,
  CloseCircleOutlineIcon,
  EyeIcon,
  HeartIcon,
  LockIcon,
  PinIcon,
} from '@/components/icons';
import { BOARD_TYPE_LABELS, type BoardPost } from '@/types/board';

interface BoardPostCardProps {
  post: BoardPost;
  onPress: (post: BoardPost) => void;
}

function formatMetaDate(post: BoardPost): string {
  const value = post.lastActivityAt ?? post.createdAt ?? post.updatedAt;
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function BoardPostCard({ post, onPress }: BoardPostCardProps) {
  const showEngagementMetrics = post.boardType !== 'notice';

  return (
    <Card onPress={() => onPress(post)} className="mb-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <View className="mb-2 flex-row flex-wrap items-center gap-2">
            <Badge variant={post.boardType === 'schedule' ? 'primary' : 'secondary'} size="sm">
              {BOARD_TYPE_LABELS[post.boardType]}
            </Badge>
            {post.isPinned ? <PinIcon size={16} color="#F59E0B" /> : null}
            {post.isLocked ? <LockIcon size={16} color="#DC2626" /> : null}
          </View>

          <Text className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
            {post.title}
          </Text>
          <Text className="mb-3 text-sm text-gray-600 dark:text-gray-400" numberOfLines={2}>
            {post.body}
          </Text>

          <View className="flex-row flex-wrap items-center gap-3">
            <Text className="text-xs text-gray-500 dark:text-gray-400">{post.authorName}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">{formatMetaDate(post)}</Text>
            {showEngagementMetrics ? (
              <View className="flex-row items-center">
                <ChatbubbleEllipsesOutlineIcon size={14} color="#6B7280" />
                <Text className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  {post.commentCount}
                </Text>
              </View>
            ) : null}
            {showEngagementMetrics ? (
              <View className="flex-row items-center">
                <HeartIcon size={14} color="#16A34A" />
                <Text className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  {post.likeCount}
                </Text>
              </View>
            ) : null}
            {showEngagementMetrics ? (
              <View className="flex-row items-center">
                <CloseCircleOutlineIcon size={14} color="#DC2626" />
                <Text className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  {post.dislikeCount}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center">
              <EyeIcon size={14} color="#6B7280" />
              <Text className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                {post.viewCount}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

export default BoardPostCard;
