/**
 * UNIQN Mobile - CalendarCell
 *
 * @description 달력 단일 날짜 셀 — 날짜 숫자 + 카운트 뱃지 + 오늘/선택/과거 상태
 * @version 1.0.0
 *
 * 스타일 결정 트리:
 *   isOutsideMonth   → opacity-30, disabled
 *   count === 0      → 뱃지 없음, disabled
 *   isSelected       → bg-primary-500, text-content-onGold, 뱃지 bg-[rgba(9,9,11,0.2)]
 *   isToday          → border-2 border-primary-500, 뱃지 bg-primary-500/15
 *   과거 + count>0   → opacity-60, 탭 가능, 뱃지 bg-primary-500/15
 *   기본             → 탭 가능, 뱃지 bg-primary-500/15
 */

import React, { memo, useCallback } from 'react';
import { Text, Pressable } from 'react-native';
import { format, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { triggerHaptic } from '@/utils/haptics';

interface CalendarCellProps {
  date: Date;
  count: number;
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  onPress: (date: Date) => void;
  testID?: string;
}

export const CalendarCell = memo(function CalendarCell({
  date,
  count,
  isToday,
  isSelected,
  isOutsideMonth,
  onPress,
  testID,
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

  const containerBase = 'flex-1 items-center justify-center min-h-[64px] rounded-sm mx-0.5 my-0.5';
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
    : 'bg-primary-500/15 text-content-primary';

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${fullLabel} ${countLabel}`}
      accessibilityState={{ selected: isSelected, disabled }}
      className={`${containerBase} ${containerState} ${opacityClass}`}
      style={({ pressed }) =>
        pressed && !disabled ? { backgroundColor: 'rgba(34, 34, 40, 0.4)' } : undefined
      }
    >
      <Text className={`text-sm font-sans-medium ${numberColor}`}>{dayNumber}</Text>
      {count > 0 && !isOutsideMonth && (
        <Text className={`${badgeBase} ${badgeColor}`}>{count}건</Text>
      )}
    </Pressable>
  );
});

export default CalendarCell;
