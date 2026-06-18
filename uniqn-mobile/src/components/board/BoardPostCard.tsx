import { Pressable, Text, View } from 'react-native';
import {
  ChatbubbleEllipsesOutlineIcon,
  CloseCircleOutlineIcon,
  EyeIcon,
  HeartIcon,
  LockIcon,
  PinIcon,
} from '@/components/icons';
import { BoardTypeBadge } from './BoardTypeBadge';
import { BOARD_TYPE_STRIPE_TONE } from './helpers/boardConfig';
import { CardStripe, NumericText } from '@/components/ui';
import { formatCompactCount } from '@/utils/formatCompactCount';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { BoardPost } from '@/types/board';

interface BoardPostCardProps {
  post: BoardPost;
  onPress: (post: BoardPost) => void;
}

function formatMetaDate(post: BoardPost): string {
  const value = post.lastActivityAt ?? post.createdAt ?? post.updatedAt;
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}.${mm}.${dd}`;
  }
  return `${mm}.${dd}`;
}

export function BoardPostCard({ post, onPress }: BoardPostCardProps) {
  return (
    <Pressable
      onPress={() => onPress(post)}
      accessibilityRole="button"
      accessibilityLabel={`${post.title} 게시글 상세 보기`}
      className="border-b border-divider dark:border-surface-overlay active:opacity-70"
    >
      <CardStripe tone={BOARD_TYPE_STRIPE_TONE[post.boardType]}>
        <View className="pl-3 pr-1 py-2.5">
          <View className="flex-row items-center gap-2 mb-1">
            <BoardTypeBadge boardType={post.boardType} />
            {post.isPinned ? <PinIcon size={14} color="#D4AF37" /> : null}
            {post.isLocked ? <LockIcon size={14} color="#DC2626" /> : null}
            <Text
              numberOfLines={1}
              style={{ letterSpacing: -0.32 }}
              className="flex-1 text-base font-sans-bold text-content-primary dark:text-secondary-100"
            >
              {post.title}
            </Text>
          </View>
          <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1">
            <Text className="text-xs font-sans text-secondary-600 dark:text-secondary-400">
              {post.authorName}
            </Text>
            <NumericText className="text-xs font-sans text-secondary-600 dark:text-secondary-400">
              {formatMetaDate(post)}
            </NumericText>
            <View className="flex-row items-center">
              <ChatbubbleEllipsesOutlineIcon size={12} color={SECONDARY_PALETTE[500]} />
              <NumericText className="ml-1 text-xs font-sans text-secondary-600 dark:text-secondary-400">
                {formatCompactCount(post.commentCount)}
              </NumericText>
            </View>
            <View className="flex-row items-center">
              <EyeIcon size={12} color={SECONDARY_PALETTE[500]} />
              <NumericText className="ml-1 text-xs font-sans text-secondary-600 dark:text-secondary-400">
                {formatCompactCount(post.viewCount)}
              </NumericText>
            </View>
            <View className="flex-row items-center">
              <HeartIcon size={12} color="#16A34A" />
              <NumericText className="ml-1 text-xs font-sans text-success-700 dark:text-success-500">
                {formatCompactCount(post.likeCount)}
              </NumericText>
            </View>
            <View className="flex-row items-center">
              <CloseCircleOutlineIcon size={12} color="#DC2626" />
              <NumericText className="ml-1 text-xs font-sans text-error-700 dark:text-error-500">
                {formatCompactCount(post.dislikeCount)}
              </NumericText>
            </View>
          </View>
        </View>
      </CardStripe>
    </Pressable>
  );
}

export default BoardPostCard;
