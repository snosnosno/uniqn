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
  filledCounts?: Map<string, number>;
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
  filledCounts,
}: PostingCardSurfaceProps) {
  // 스케줄 모델은 filledCounts 를 주입해 한 번만 생성하고, a11y label 과 콘텐츠 렌더가
  // 동일 모델을 공유한다(S2). 이원화 시 label 에 확정 수를 쓰는 순간 0/N 드리프트 재발 소지.
  // a11y label 은 filled 수치를 읽지 않으므로 filledCounts 주입이 label 텍스트를 바꾸지 않는다.
  const schedule = buildPostingScheduleModel(card, filledCounts);
  const compensation = buildPostingCompensationModel(card, { display: 'card' });
  const resolvedAccessibilityLabel =
    accessibilityLabel || buildAccessibilityLabel(card, schedule, compensation.primaryText);

  const innerContent = (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityHint={accessibilityHint}
        className={pressableClassName}
      >
        {topStatus ? <View className="mb-2">{topStatus}</View> : null}

        <View className="mb-2 flex-row items-start justify-between">
          <View className="flex-1 flex-row flex-wrap items-center pr-2">
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

          <View className="flex-shrink-0 items-end">
            {card.location ? (
              <Text
                numberOfLines={1}
                className="max-w-[140px] text-xs text-secondary-500 dark:text-secondary-400 font-sans"
              >
                {card.location}
              </Text>
            ) : null}
            {card.regionLabel ? (
              <Text
                numberOfLines={1}
                className="max-w-[140px] text-[11px] text-secondary-400 dark:text-secondary-500 font-sans"
              >
                📍 {card.regionLabel}
              </Text>
            ) : null}
            {titleAccessory}
          </View>
        </View>

        <View className="flex-row">
          <View style={{ flex: 1.3 }} className="pr-2">
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
              filledCounts={filledCounts}
              schedule={schedule}
            />
          </View>

          <View className="mx-2 w-px self-stretch bg-secondary-100 dark:bg-surface-overlay" />

          <View style={{ flex: 1 }} className="pl-2">
            <PostingCompensationContent
              display="card"
              salaryDisplay={card.salaryDisplay}
              defaultSalary={card.defaultSalary}
              allowanceLabels={card.allowanceLabels}
              taxLabel={card.taxLabel}
            />
          </View>
        </View>

        {(card.allowanceLabels?.length ?? 0) > 0 || card.taxLabel ? (
          <Text className="mt-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            {[...(card.allowanceLabels ?? []), ...(card.taxLabel ? [card.taxLabel] : [])].join(
              ' · '
            )}
          </Text>
        ) : null}

        {(card.conditionLabels?.length ?? 0) > 0 ? (
          <Text
            className="mt-0.5 text-sm text-secondary-500 dark:text-secondary-400 font-sans"
            numberOfLines={1}
          >
            {(card.conditionLabels ?? []).join(' · ')}
          </Text>
        ) : null}

        {bodyFooter}
      </Pressable>

      {footer}
    </>
  );

  if (stripeTone) {
    return (
      <CardStripe tone={stripeTone} style={{ marginBottom: 8 }}>
        <View
          className={`bg-surface-card dark:bg-surface-elevated rounded-md pl-4 ${containerClassName ?? ''}`.trim()}
        >
          {innerContent}
        </View>
      </CardStripe>
    );
  }

  return <View className={containerClassName}>{innerContent}</View>;
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
