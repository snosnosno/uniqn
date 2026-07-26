/**
 * UNIQN Mobile - NextShiftCard
 *
 * @description 스케줄 탭 최상단 '내 다음 근무' 히어로.
 *   이 탭을 여는 이유의 대부분은 "나 오늘/내일 언제 어디로 가지?"인데, 예전 최상단은
 *   월 집계 밴드였고 오늘 일정이 없는 날엔 달력 아래가 통째로 비어 다음 근무를 알려면
 *   점을 눈으로 찾아 탭해야 했다. 그 질문 하나에만 답한다.
 */
import React, { memo, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SECONDARY_PALETTE } from '@/constants/colors';
import {
  CalendarIcon,
  ClockIcon,
  MapIcon,
  QrCodeIcon,
  AlertTriangleIcon,
} from '@/components/icons';
import { Badge } from '@/components/ui';
import { getRoleDisplayName } from '@/types/unified';
import { STATUS } from '@/constants';
import { TimeNormalizer, WorkTimeDisplay } from '@/shared/time';
import { describeNextShiftCountdown, formatWorkTimeRange } from './helpers/timeHelpers';
import { formatSingleDate } from '@/utils/scheduleGrouping';
import type { ScheduleEvent } from '@/types';

export interface NextShiftCardProps {
  /** 다음 근무. 없으면 카드를 렌더하지 않는다. */
  schedule: ScheduleEvent | null;
  /** 카드 본문 탭 — 상세 시트 열기 */
  onPress: () => void;
  /** QR 출퇴근 */
  onQRScan?: () => void;
  /** 현재 시각 주입점 (테스트용). 기본값은 렌더 시점. */
  now?: Date;
  /** 같은 시간대 다른 확정 근무가 있을 때의 경고 — 다음 근무야말로 미리 알아야 한다. */
  overlapWarning?: string | null;
}

export const NextShiftCard = memo(function NextShiftCard({
  schedule,
  onPress,
  onQRScan,
  now,
  overlapWarning,
}: NextShiftCardProps) {
  const timeInfo = useMemo(
    () => (schedule ? WorkTimeDisplay.getDisplayInfo(schedule) : null),
    [schedule]
  );

  const countdown = useMemo(() => {
    if (!schedule) return null;
    return describeNextShiftCountdown(
      schedule.date,
      TimeNormalizer.parseTime(schedule.startTime),
      now ?? new Date(),
      schedule.status === STATUS.ATTENDANCE.CHECKED_IN
    );
  }, [schedule, now]);

  if (!schedule || !countdown || !timeInfo) return null;

  const isWorking = countdown.urgency === 'working';
  const isImminent = countdown.urgency === 'imminent';
  const canScan = Boolean(schedule.workLogId && onQRScan);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`다음 근무: ${schedule.jobPostingName}, ${countdown.label}, ${formatSingleDate(
        schedule.date
      )}`}
      testID="schedule-next-shift-card"
      className="mx-4 mt-3 rounded-md bg-surface-card px-4 py-3 active:bg-secondary-100 dark:bg-surface-elevated dark:active:bg-secondary-700"
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs text-content-muted dark:text-secondary-400 font-sans">
          내 다음 근무
        </Text>
        <Badge variant={isWorking || isImminent ? 'warning' : 'default'} size="sm">
          {countdown.label}
        </Badge>
      </View>

      <Text
        className="mb-2 text-base font-sans-semibold text-content-primary dark:leading-base-dark"
        numberOfLines={1}
      >
        {schedule.jobPostingName}
      </Text>

      <View className="flex-row items-center">
        <CalendarIcon size={14} color={SECONDARY_PALETTE[500]} />
        <Text className="ml-1.5 text-sm text-content-secondary font-sans">
          {formatSingleDate(schedule.date)}
        </Text>
        <View className="mx-2 h-3 w-px bg-secondary-300 dark:bg-surface-elevated" />
        <ClockIcon size={14} color={SECONDARY_PALETTE[500]} />
        <Text className="ml-1.5 text-sm text-content-secondary font-sans">
          {formatWorkTimeRange(timeInfo)}
        </Text>
      </View>

      {schedule.location && (
        <View className="mt-1.5 flex-row items-center">
          <MapIcon size={14} color={SECONDARY_PALETTE[500]} />
          <Text
            className="ml-1.5 flex-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans"
            numberOfLines={1}
          >
            {schedule.location}
          </Text>
          <Text className="ml-2 text-sm text-content-muted dark:text-secondary-400 font-sans">
            {getRoleDisplayName(schedule.role, schedule.customRole)}
          </Text>
        </View>
      )}

      {overlapWarning && (
        <View className="mt-2 flex-row items-center rounded-md bg-warning-50 px-3 py-2 dark:bg-warning-900/20">
          <AlertTriangleIcon size={14} color="#D4A017" />
          <Text className="ml-1.5 flex-1 text-xs text-warning-700 dark:text-warning-400 font-sans">
            {overlapWarning}
          </Text>
        </View>
      )}

      {canScan && (
        <Pressable
          onPress={onQRScan}
          accessibilityRole="button"
          accessibilityLabel={isWorking ? 'QR 코드로 퇴근하기' : 'QR 코드로 출근하기'}
          testID="schedule-next-shift-qr-button"
          className={`mt-3 flex-row items-center justify-center rounded-md py-2.5 ${
            isWorking
              ? 'bg-secondary-100 active:bg-secondary-200 dark:bg-surface-overlay dark:active:bg-secondary-700'
              : 'bg-primary-600 active:bg-primary-700'
          }`}
        >
          <QrCodeIcon size={18} color={isWorking ? SECONDARY_PALETTE[500] : '#FFFFFF'} />
          <Text
            className={`ml-2 text-sm font-sans-semibold ${
              isWorking ? 'text-secondary-900 dark:text-secondary-100' : 'text-content-onGold'
            }`}
          >
            QR 코드로 {isWorking ? '퇴근' : '출근'}하기
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
});

export default NextShiftCard;
