import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PostingTypeBadge } from '@/components/jobs/PostingTypeBadge';
import { Badge } from '@/components/ui/Badge';
import type { PostingCardViewModel } from '@/types';
import { PostingCompensationContent } from './PostingCompensationContent';
import { PostingScheduleContent } from './PostingScheduleContent';
import {
  buildPostingCompensationModel,
  buildPostingScheduleModel,
  FOCUSED_GROUP_DATE_HINT,
  shouldShowUrgentBadge,
} from './postingSurfaceModel';

interface PostingCardSurfaceProps {
  card: PostingCardViewModel;
  onPress: () => void;
  topStatus?: React.ReactNode;
  titleAccessory?: React.ReactNode;
  bodyFooter?: React.ReactNode;
  footer?: React.ReactNode;
  containerClassName?: string;
  pressableClassName?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function PostingCardSurface({
  card,
  onPress,
  topStatus,
  titleAccessory,
  bodyFooter,
  footer,
  containerClassName,
  pressableClassName,
  accessibilityLabel,
  accessibilityHint,
}: PostingCardSurfaceProps) {
  const schedule = buildPostingScheduleModel(card);
  const compensation = buildPostingCompensationModel(card, { display: 'card' });
  const resolvedAccessibilityLabel =
    accessibilityLabel || buildAccessibilityLabel(card, schedule, compensation.primaryText);

  return (
    <View className={containerClassName}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityHint={accessibilityHint}
        className={pressableClassName}
      >
        {topStatus ? <View className="mb-2">{topStatus}</View> : null}

        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1 flex-row flex-wrap items-center">
            {card.postingType && card.postingType !== 'regular' ? (
              <PostingTypeBadge type={card.postingType} size="sm" className="mr-2" />
            ) : null}
            {shouldShowUrgentBadge(card.postingType, card.isUrgent) ? (
              <Badge variant="error" size="sm" className="mr-2">
                긴급
              </Badge>
            ) : null}
            <Text
              className="flex-1 text-base font-sans-semibold text-content-primary dark:text-off-white"
              numberOfLines={1}
            >
              {card.title}
            </Text>
          </View>

          {titleAccessory}
        </View>

        <Text className="mb-2 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
          {card.location}
        </Text>

        <View className="flex-row">
          <View className="flex-1 pr-3">
            <PostingScheduleContent
              display="card"
              workflow={card.workflow}
              scheduleDisplay={card.scheduleDisplay}
              workDate={card.workDate}
              timeSlot={card.timeSlot}
              daysPerWeek={card.daysPerWeek}
              startTime={card.startTime}
              requiredRolesWithCount={card.requiredRolesWithCount}
              displayContext={card.displayContext}
            />
          </View>

          <View className="flex-1 border-l border-secondary-100 pl-3 dark:border-surface-overlay">
            <PostingCompensationContent
              display="card"
              salaryDisplay={card.salaryDisplay}
              defaultSalary={card.defaultSalary}
              allowanceLabels={card.allowanceLabels}
              taxLabel={card.taxLabel}
            />
          </View>
        </View>

        {bodyFooter}
      </Pressable>

      {footer}
    </View>
  );
}

function buildAccessibilityLabel(
  card: PostingCardViewModel,
  schedule: ReturnType<typeof buildPostingScheduleModel>,
  compensationLabel: string
) {
  const scheduleLabel =
    schedule.variant === 'fixed'
      ? `${schedule.fixed.daysLabel}, ${schedule.fixed.timeLabel}`
      : schedule.variant === 'legacy'
        ? `${schedule.dateLabel}, ${schedule.timeLabel}`
        : schedule.sections[0]?.label || card.workDate;
  const focusedGroupHint = card.displayContext?.wasGroupedRange
    ? `, ${FOCUSED_GROUP_DATE_HINT}`
    : '';

  return `${card.title}, ${card.location}, ${scheduleLabel}, ${compensationLabel}${focusedGroupHint}`;
}

export default PostingCardSurface;
