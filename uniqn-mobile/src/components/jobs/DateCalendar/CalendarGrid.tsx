/**
 * UNIQN Mobile - CalendarGrid
 *
 * @description 7×N 달력 그리드 (요일 헤더 + 날짜 셀). CalendarCell 조합.
 * @version 1.1.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday as dfIsToday,
} from 'date-fns';
import { CalendarCell } from './CalendarCell';
import { toDateString } from '@/utils/date';
import type { GridDayCell } from '@/domains/weeklyGrid';

interface CalendarGridProps {
  visibleMonth: Date;
  selectedDate: Date | null;
  counts: Record<string, number>;
  onDateSelect: (date: Date) => void;
  /** true이면 셀 뱃지 위치에 Skeleton shimmer 표시 (Rule 16) */
  isLoading?: boolean;
  /**
   * 주간 그리드 셀 맵(yyyy-MM-dd → GridDayCell). 제공되면 각 셀이 그리드 모드로 렌더.
   * 미제공이면 기존 캘린더 동작 그대로(공개 캘린더 무회귀).
   */
  gridCells?: Record<string, GridDayCell>;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function weekdayColor(index: number): string {
  if (index === 0) return 'text-error-500';
  if (index === 6) return 'text-info-500';
  return 'text-content-secondary';
}

export const CalendarGrid = memo(function CalendarGrid({
  visibleMonth,
  selectedDate,
  counts,
  onDateSelect,
  isLoading = false,
  gridCells,
}: CalendarGridProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  return (
    <View>
      {/* 요일 헤더 */}
      <View className="flex-row border-b border-divider">
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={label} className="flex-1 items-center py-1">
            <Text className={`text-xs font-sans-medium ${weekdayColor(index)}`}>{label}</Text>
          </View>
        ))}
      </View>

      {/* 날짜 그리드 */}
      <View className="flex-row flex-wrap">
        {days.map((day) => {
          // 날짜키 SSOT: 적재(densify)와 조회(gridCells lookup)가 동일하게 toDateString 경유.
          const key = toDateString(day);
          const count = counts[key] ?? 0;
          const isOutsideMonth = !isSameMonth(day, visibleMonth);
          const isSelected = selectedDate !== null && isSameDay(day, selectedDate);
          return (
            <View key={key} style={{ width: `${100 / 7}%` }}>
              <CalendarCell
                date={day}
                count={count}
                isToday={dfIsToday(day)}
                isSelected={isSelected}
                isOutsideMonth={isOutsideMonth}
                onPress={onDateSelect}
                testID={`calendar-cell-${key}`}
                loading={isLoading}
                gridCell={gridCells?.[key]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default CalendarGrid;
