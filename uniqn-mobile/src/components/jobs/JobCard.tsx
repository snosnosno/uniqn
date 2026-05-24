import React, { memo, useCallback } from 'react';
import { Platform, Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import { STATUS_COLORS } from '@/constants/colors';
import { HIT_SLOP } from '@/constants';
import { SCHEDULE_STATUS } from '@/constants/statusConfig';
import { HeartFilledIcon, HeartOutlineIcon } from '@/components/icons';
import { Badge, type CardStripeTone } from '@/components/ui';
import { useBookmarks } from '@/hooks/useBookmarks';
import { extractPostingFilledSubmap } from '@/hooks/usePostingFilledCounts';
import type { JobPostingCard } from '@/types';
import { PostingCardSurface } from './shared/PostingCardSurface';

export type ApplicationStatusType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

const STRIPE_TONE_BY_STATUS: Record<ApplicationStatusType, CardStripeTone> = {
  applied: 'info',
  confirmed: 'info',
  cancelled: 'muted',
  completed: 'muted',
};

interface JobCardProps {
  job: JobPostingCard;
  onPress: (jobId: string) => void;
  applicationStatus?: ApplicationStatusType;
  filledCounts?: Map<string, number>;
}

export const JobCard = memo(function JobCard({
  job,
  onPress,
  applicationStatus,
  filledCounts,
}: JobCardProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(job.id);
  const cardFilledCounts = extractPostingFilledSubmap(filledCounts, job.id);

  const handlePress = useCallback(() => {
    onPress(job.id);
  }, [job.id, onPress]);

  const handleBookmarkPress = useCallback(() => {
    toggleBookmark({
      id: job.id,
      title: job.title,
      location: job.fullLocation || job.location,
      workDate: job.workDate,
    });
  }, [job.fullLocation, job.id, job.location, job.title, job.workDate, toggleBookmark]);

  const handleBookmarkClick = useCallback(
    (event?: GestureResponderEvent | React.MouseEvent) => {
      event?.stopPropagation?.();
      handleBookmarkPress();
    },
    [handleBookmarkPress]
  );

  const stripeTone: CardStripeTone = applicationStatus
    ? STRIPE_TONE_BY_STATUS[applicationStatus]
    : 'gold';

  const bookmarkButton =
    Platform.OS === 'web' ? (
      <View
        // @ts-expect-error React Native Web supports onClick on View
        onClick={handleBookmarkClick}
        className="-my-1 p-1"
        style={{ cursor: 'pointer' }}
        accessibilityLabel={bookmarked ? '북마크 해제' : '북마크 추가'}
      >
        {bookmarked ? (
          <HeartFilledIcon size={20} color={STATUS_COLORS.error} />
        ) : (
          <HeartOutlineIcon size={20} />
        )}
      </View>
    ) : (
      <Pressable
        onPress={handleBookmarkClick}
        hitSlop={HIT_SLOP.medium}
        className="-my-1 p-1"
        accessibilityLabel={bookmarked ? '북마크 해제' : '북마크 추가'}
        accessibilityRole="button"
      >
        {bookmarked ? (
          <HeartFilledIcon size={20} color={STATUS_COLORS.error} />
        ) : (
          <HeartOutlineIcon size={20} />
        )}
      </Pressable>
    );

  return (
    <PostingCardSurface
      card={job}
      onPress={handlePress}
      stripeTone={stripeTone}
      filledCounts={cardFilledCounts}
      topStatus={
        applicationStatus ? (
          <Badge variant="chip" dot>
            {SCHEDULE_STATUS[applicationStatus].label}
          </Badge>
        ) : undefined
      }
      bodyFooter={
        <View className="mt-1.5 flex-row items-center justify-between border-t border-secondary-100 pt-1.5 dark:border-surface-overlay">
          <Text
            className="flex-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans"
            numberOfLines={1}
          >
            {job.ownerName ? `구인처 ${job.ownerName}` : ''}
          </Text>
          {bookmarkButton}
        </View>
      }
      containerClassName="overflow-hidden"
      pressableClassName="py-4 pr-4 active:opacity-80"
      accessibilityHint="탭하면 공고 상세 페이지로 이동합니다"
    />
  );
});

export default JobCard;
