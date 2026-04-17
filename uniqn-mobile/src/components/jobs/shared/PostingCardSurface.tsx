import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PostingTypeBadge } from '@/components/jobs/PostingTypeBadge';
import { Badge, CardStripe, type CardStripeTone } from '@/components/ui';
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
  stripeTone?: CardStripeTone;
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
  stripeTone,
}: PostingCardSurfaceProps) {
  const schedule = buildPostingScheduleModel(card);
  const compensation = buildPostingCompensationModel(card, { display: 'card' });
  const resolvedAccessibilityLabel =
    accessibilityLabel || buildAccessibilityLabel(card, schedule, compensation.primaryText);

  return (
    <CardStripe tone={stripeTone ?? 'gold'} style={{ marginBottom: 8 }}>
      <View
        className={`bg-surface-card dark:bg-surface-elevated rounded-md pl-4 ${containerClassName ?? ''}`.trim()}
      >
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
                className="flex-1 text-base font-sans-bold text-content-primary dark:text-off-white"
                style={{ letterSpacing: -0.32 }}
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
            <View className="flex-1 pr-2">
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

            <View className="mx-2 w-px self-stretch bg-secondary-100 dark:bg-surface-overlay" />

            <View className="flex-1 pl-2">
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
    </CardStripe>
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
