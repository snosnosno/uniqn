/**
 * UNIQN Mobile - CalendarCell
 *
 * @description 달력 단일 날짜 셀 — 날짜 숫자 + 카운트 뱃지 + 오늘/선택/과거 상태
 * @version 1.1.0
 *
 * 스타일 결정 트리:
 *   isOutsideMonth   → opacity-30, disabled
 *   loading=true     → 뱃지 위치에 SkeletonText (shimmer) 표시
 *   count === 0      → 뱃지 없음, disabled
 *   isSelected       → bg-primary-500, text-content-onGold, 뱃지 bg-[rgba(9,9,11,0.2)]
 *   isToday          → border-2 border-primary-500, 뱃지 bg-primary-500/15
 *   과거 + count>0   → opacity-60, 탭 가능, 뱃지 bg-primary-500/15
 *   기본             → 탭 가능, 뱃지 bg-primary-500/15
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { triggerHaptic } from '@/utils/haptics';
import { Skeleton } from '@/components/ui/Skeleton';

interface CalendarCellProps {
  date: Date;
  count: number;
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  onPress: (date: Date) => void;
  testID?: string;
  /** true일 때 뱃지 위치에 Skeleton shimmer 표시 (Rule 16) */
  loading?: boolean;
}

export const CalendarCell = memo(function CalendarCell({
  date,
  count,
  isToday,
  isSelected,
  isOutsideMonth,
  onPress,
  testID,
  loading = false,
}: CalendarCellProps) {
  const disabled = isOutsideMonth || count === 0;
  const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
  const dayNumber = format(date, 'd');
  const fullLabel = format(date, 'M월 d일 EEEE', { locale: ko });
  const countLabel = count > 0 ? `공고 ${count}건` : '공고 없음';

  const handlePress = useCallback(() => {
    if (disabled) return;
    void triggerHaptic('light');
    onPress(date);
  }, [date, disabled, onPress]);

  const containerBase =
    'flex-1 items-center justify-center min-h-[64px] rounded-sm mx-0.5 my-0.5 active:bg-secondary-100 dark:active:bg-surface-hover';
  const containerState = isSelected
    ? 'bg-primary-500'
    : isToday
      ? 'border-2 border-primary-500'
      : '';
  const opacityClass = isOutsideMonth ? 'opacity-30' : isPast && !isSelected ? 'opacity-60' : '';

  const numberColor = isSelected
    ? 'text-content-onGold'
    : isToday
      ? 'text-primary-500'
      : 'text-content-primary';

  const badgeBase = 'rounded-sm px-1.5 py-0.5 mt-1 text-[10px] font-sans-medium';
  const badgeColor = isSelected
    ? 'bg-[rgba(9,9,11,0.2)] text-content-onGold'
    : 'bg-primary-500/25 text-primary-500';

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${fullLabel} ${countLabel}`}
      accessibilityState={{ selected: isSelected, disabled }}
      className={`${containerBase} ${containerState} ${opacityClass}`}
    >
      <Text className={`text-sm font-sans-medium ${numberColor}`}>{dayNumber}</Text>
      {loading && !isOutsideMonth ? (
        <View className="mt-1">
          <Skeleton width={24} height={10} accessible={false} />
        </View>
      ) : (
        count > 0 &&
        !isOutsideMonth && <Text className={`${badgeBase} ${badgeColor}`}>{count}건</Text>
      )}
    </Pressable>
  );
});

export default CalendarCell;
