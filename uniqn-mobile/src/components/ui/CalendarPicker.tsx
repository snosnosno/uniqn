/**
 * UNIQN Mobile - CalendarPicker 컴포넌트
 *
 * @description 캘린더 뷰 날짜 선택 (iOS/Android/Web 통일)
 * @version 1.0.0
 */

import React, { memo, useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  isBefore,
  isAfter,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

export interface CalendarPickerProps {
  /** 현재 선택된 날짜 */
  value: Date | null;
  /** 날짜 변경 콜백 */
  onChange: (date: Date) => void;
  /** 최소 선택 가능 날짜 */
  minimumDate?: Date;
  /** 최대 선택 가능 날짜 */
  maximumDate?: Date;
  /** 테스트 ID */
  testID?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ============================================================================
// Utils
// ============================================================================

function getCalendarDays(
  currentMonth: Date,
  selectedDate: Date | null,
  minimumDate?: Date,
  maximumDate?: Date
): CalendarDay[] {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 일요일 시작
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: CalendarDay[] = [];
  let day = calendarStart;

  while (day <= calendarEnd) {
    const isCurrentMonth = isSameMonth(day, currentMonth);
    const dayIsToday = isToday(day);
    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

    // 비활성화 조건
    let isDisabled = false;
    if (minimumDate) {
      // minimumDate의 시작 시간으로 비교 (당일은 선택 가능)
      const minStart = new Date(minimumDate);
      minStart.setHours(0, 0, 0, 0);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      if (isBefore(dayStart, minStart)) {
        isDisabled = true;
      }
    }
    if (maximumDate) {
      const maxEnd = new Date(maximumDate);
      maxEnd.setHours(23, 59, 59, 999);
      if (isAfter(day, maxEnd)) {
        isDisabled = true;
      }
    }

    days.push({
      date: new Date(day),
      isCurrentMonth,
      isToday: dayIsToday,
      isSelected,
      isDisabled,
    });

    day = addDays(day, 1);
  }

  return days;
}

// ============================================================================
// CalendarDay Component
// ============================================================================

const CalendarDayCell = memo(function CalendarDayCell({
  day,
  onSelect,
}: {
  day: CalendarDay;
  onSelect: (date: Date) => void;
}) {
  const handlePress = useCallback(() => {
    if (!day.isDisabled) {
      onSelect(day.date);
    }
  }, [day.date, day.isDisabled, onSelect]);

  // 스타일 결정
  const getContainerStyle = () => {
    const base = 'w-10 h-10 items-center justify-center rounded-full mx-auto';

    if (day.isSelected) {
      return `${base} bg-indigo-500`;
    }
    if (day.isToday && !day.isSelected) {
      return `${base} border-2 border-indigo-500`;
    }
    return base;
  };

  const getTextStyle = () => {
    if (day.isDisabled) {
      return 'text-gray-300 dark:text-gray-600';
    }
    if (day.isSelected) {
      return 'text-white font-semibold';
    }
    if (!day.isCurrentMonth) {
      return 'text-gray-300 dark:text-gray-600';
    }
    // 주말 색상
    const dayOfWeek = day.date.getDay();
    if (dayOfWeek === 0) {
      return 'text-red-500 dark:text-red-400'; // 일요일
    }
    if (dayOfWeek === 6) {
      return 'text-blue-500 dark:text-blue-400'; // 토요일
    }
    return 'text-gray-900 dark:text-white';
  };

  const dayNumber = day.date.getDate();
  const accessibilityLabel = format(day.date, 'yyyy년 M월 d일 EEEE', { locale: ko });

  return (
    <Pressable
      onPress={handlePress}
      disabled={day.isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: day.isDisabled, selected: day.isSelected }}
      className="flex-1 py-1"
    >
      <View className={getContainerStyle()}>
        <Text className={`text-sm ${getTextStyle()}`}>{dayNumber}</Text>
      </View>
    </Pressable>
  );
});

// ============================================================================
// CalendarPicker Component
// ============================================================================

export const CalendarPicker = memo(function CalendarPicker({
  value,
  onChange,
  minimumDate,
  maximumDate,
  testID,
}: CalendarPickerProps) {
  // 현재 표시 중인 월 (선택된 날짜 또는 오늘 기준)
  const [currentMonth, setCurrentMonth] = useState(() => value ?? new Date());

  // 캘린더 날짜 계산
  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth, value, minimumDate, maximumDate),
    [currentMonth, value, minimumDate, maximumDate]
  );

  // 이전/다음 달 이동 가능 여부
  const canGoPrev = useMemo(() => {
    if (!minimumDate) return true;
    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthEnd = endOfMonth(prevMonth);
    return !isBefore(prevMonthEnd, minimumDate);
  }, [currentMonth, minimumDate]);

  const canGoNext = useMemo(() => {
    if (!maximumDate) return true;
    const nextMonth = addMonths(currentMonth, 1);
    const nextMonthStart = startOfMonth(nextMonth);
    return !isAfter(nextMonthStart, maximumDate);
  }, [currentMonth, maximumDate]);

  // 월 네비게이션
  const goToPrevMonth = useCallback(() => {
    if (canGoPrev) {
      setCurrentMonth((prev) => subMonths(prev, 1));
    }
  }, [canGoPrev]);

  const goToNextMonth = useCallback(() => {
    if (canGoNext) {
      setCurrentMonth((prev) => addMonths(prev, 1));
    }
  }, [canGoNext]);

  // 날짜 선택
  const handleDaySelect = useCallback(
    (date: Date) => {
      onChange(date);
    },
    [onChange]
  );

  // 주 단위로 분할
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  return (
    <View testID={testID} className="py-2">
      {/* 헤더: 월 네비게이션 */}
      <View className="flex-row items-center justify-between px-2 mb-4">
        <Pressable
          onPress={goToPrevMonth}
          disabled={!canGoPrev}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          className={`p-2 rounded-full ${!canGoPrev ? 'opacity-30' : ''}`}
        >
          <ChevronLeftIcon size={24} color={canGoPrev ? '#6B7280' : '#D1D5DB'} />
        </Pressable>

        <Text className="text-lg font-semibold text-gray-900 dark:text-white">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </Text>

        <Pressable
          onPress={goToNextMonth}
          disabled={!canGoNext}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          className={`p-2 rounded-full ${!canGoNext ? 'opacity-30' : ''}`}
        >
          <ChevronRightIcon size={24} color={canGoNext ? '#6B7280' : '#D1D5DB'} />
        </Pressable>
      </View>

      {/* 요일 헤더 */}
      <View className="flex-row mb-2">
        {WEEKDAYS.map((day, index) => (
          <View key={day} className="flex-1 items-center">
            <Text
              className={`text-xs font-medium ${
                index === 0
                  ? 'text-red-500 dark:text-red-400'
                  : index === 6
                    ? 'text-blue-500 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* 날짜 그리드 */}
      <View>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} className="flex-row">
            {week.map((day) => (
              <CalendarDayCell
                key={day.date.toISOString()}
                day={day}
                onSelect={handleDaySelect}
              />
            ))}
          </View>
        ))}
      </View>

      {/* 범위 안내 (최소/최대 날짜가 있을 때) */}
      {(minimumDate || maximumDate) && (
        <View className="mt-4 px-2">
          <View className="flex-row items-center">
            <View className="w-3 h-3 rounded-full bg-indigo-500 mr-2" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              선택 가능:{' '}
              {minimumDate && format(minimumDate, 'M/d', { locale: ko })}
              {minimumDate && maximumDate && ' ~ '}
              {maximumDate && format(maximumDate, 'M/d', { locale: ko })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default CalendarPicker;
