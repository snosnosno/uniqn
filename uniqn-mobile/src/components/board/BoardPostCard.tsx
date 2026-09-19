import { Pressable, Text, View } from 'react-native';
import { ChatbubbleEllipsesOutlineIcon, LockIcon, PinIcon } from '@/components/icons';
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
  const scheduleMeta =
    post.boardType === 'schedule'
      ? [
          post.jobSummary?.workDates?.join(', ') || post.jobSummary?.workDate,
          post.jobSummary?.locationName,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <Pressable
      onPress={() => onPress(post)}
      accessibilityRole="button"
      accessibilityLabel={`${post.title} ${post.boardType === 'schedule' ? '일정 소통' : '공지'} 상세 보기`}
      className="border-b border-divider dark:border-surface-overlay active:opacity-70"
    >
      <CardStripe tone={BOARD_TYPE_STRIPE_TONE[post.boardType]}>
        <View className="pl-3 pr-1 py-2.5">
          <View className="flex-row items-center gap-2 mb-1">
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
          {scheduleMeta ? (
            <Text
              numberOfLines={1}
              className="mb-1 text-sm font-sans text-content-secondary dark:text-secondary-300"
            >
              {scheduleMeta}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1">
            <Text className="text-xs font-sans text-secondary-600 dark:text-secondary-400">
              {post.authorName}
            </Text>
            <NumericText className="text-xs font-sans text-secondary-600 dark:text-secondary-400">
              {formatMetaDate(post)}
            </NumericText>
            {post.boardType === 'schedule' ? (
              <View className="flex-row items-center">
                <ChatbubbleEllipsesOutlineIcon size={12} color={SECONDARY_PALETTE[500]} />
                <NumericText className="ml-1 text-xs font-sans text-secondary-600 dark:text-secondary-400">
                  {formatCompactCount(post.commentCount)}
                </NumericText>
              </View>
            ) : null}
          </View>
        </View>
      </CardStripe>
    </Pressable>
  );
}
