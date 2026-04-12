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
import { ko } from 'date-fns/locale/ko';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { toDate } from '@/utils/date';

// ============================================================================
// Types
// ============================================================================

export interface CalendarPickerProps {
  /** 현재 선택된 날짜 (단일 선택 모드) */
  value?: Date | null;
  /** 날짜 변경 콜백 (단일 선택 모드) */
  onChange?: (date: Date) => void;
  /** 다중 선택 모드 여부 */
  multiSelect?: boolean;
  /** 선택된 날짜 목록 (다중 선택 모드) */
  selectedDates?: Date[];
  /** 날짜 선택/해제 콜백 (다중 선택 모드) */
  onMultiSelectChange?: (dates: Date[]) => void;
  /** 선택 불가능한 날짜 목록 (이미 추가된 날짜 등) */
  disabledDates?: string[];
  /** 최소 선택 가능 날짜 */
  minimumDate?: Date;
  /** 최대 선택 가능 날짜 */
  maximumDate?: Date;
  /** 최대 선택 가능 개수 (다중 선택 모드) */
  maxSelections?: number;
  /** 테스트 ID */
  testID?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  isAlreadyAdded: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ============================================================================
// Utils
// ============================================================================

function cloneDate(value: Date | null | undefined): Date | null {
  const parsed = toDate(value);
  return parsed ? new Date(parsed.getTime()) : null;
}

function canNavigateToMonth(
  currentMonth: Date,
  offsetMonths: number,
  minimumDate?: Date,
  maximumDate?: Date
): boolean {
  const targetMonth = addMonths(currentMonth, offsetMonths);

  if (minimumDate && isBefore(endOfMonth(targetMonth), minimumDate)) {
    return false;
  }

  if (maximumDate && isAfter(startOfMonth(targetMonth), maximumDate)) {
    return false;
  }

  return true;
}

function getCalendarDays(
  currentMonth: Date,
  selectedDate: Date | null,
  selectedDates: Date[],
  multiSelect: boolean,
  disabledDates: string[],
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

    // 선택 여부 확인 (다중 선택 모드 vs 단일 선택 모드)
    const isSelected = multiSelect
      ? selectedDates.some((d) => isSameDay(d, day))
      : selectedDate
        ? isSameDay(day, selectedDate)
        : false;

    // 이미 추가된 날짜인지 확인
    const dateString = format(day, 'yyyy-MM-dd');
    const isAlreadyAdded = disabledDates.includes(dateString);

    // 비활성화 조건
    let isDisabled = false;
    if (minimumDate) {
      // minimumDate의 시작 시간으로 비교 (당일은 선택 가능)
      const minStart = cloneDate(minimumDate);
      const dayStart = new Date(day.getTime());
      dayStart.setHours(0, 0, 0, 0);
      if (minStart) {
        minStart.setHours(0, 0, 0, 0);
      }
      if (minStart && isBefore(dayStart, minStart)) {
        isDisabled = true;
      }
    }
    if (maximumDate) {
      const maxEnd = cloneDate(maximumDate);
      if (maxEnd) {
        maxEnd.setHours(23, 59, 59, 999);
      }
      if (maxEnd && isAfter(day, maxEnd)) {
        isDisabled = true;
      }
    }

    days.push({
      date: new Date(day.getTime()),
      isCurrentMonth,
      isToday: dayIsToday,
      isSelected,
      isDisabled,
      isAlreadyAdded,
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
    // 이미 추가된 날짜나 비활성화된 날짜는 선택 불가
    if (!day.isDisabled && !day.isAlreadyAdded) {
      onSelect(day.date);
    }
  }, [day.date, day.isDisabled, day.isAlreadyAdded, onSelect]);

  // 스타일 결정
  const getContainerStyle = () => {
    const base = 'w-10 h-10 items-center justify-center rounded-sm mx-auto';

    // 이미 추가된 날짜
    if (day.isAlreadyAdded) {
      return `${base} bg-secondary-300 dark:bg-surface-elevated`;
    }
    if (day.isSelected) {
      return `${base} bg-indigo-500`;
    }
    if (day.isToday && !day.isSelected) {
      return `${base} border-2 border-indigo-500`;
    }
    return base;
  };

  const getTextStyle = () => {
    // 이미 추가된 날짜
    if (day.isAlreadyAdded) {
      return 'text-secondary-500 dark:text-secondary-400 line-through';
    }
    if (day.isDisabled) {
      return 'text-secondary-300 dark:text-secondary-600';
    }
    if (day.isSelected) {
      return 'text-white font-semibold';
    }
    if (!day.isCurrentMonth) {
      return 'text-secondary-300 dark:text-secondary-600';
    }
    // 주말 색상
    const dayOfWeek = day.date.getDay();
    if (dayOfWeek === 0) {
      return 'text-error-500 dark:text-error-400'; // 일요일
    }
    if (dayOfWeek === 6) {
      return 'text-primary-500 dark:text-primary-400'; // 토요일
    }
    return 'text-secondary-900 dark:text-white';
  };

  const dayNumber = day.date.getDate();
  const accessibilityLabel = format(day.date, 'yyyy년 M월 d일 EEEE', { locale: ko });
  const isInteractable = !day.isDisabled && !day.isAlreadyAdded;

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isInteractable}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !isInteractable, selected: day.isSelected }}
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
  multiSelect = false,
  selectedDates = [],
  onMultiSelectChange,
  disabledDates = [],
  minimumDate,
  maximumDate,
  maxSelections,
  testID,
}: CalendarPickerProps) {
  // 현재 표시 중인 월 (선택된 날짜 또는 오늘 기준)
  const [currentMonth, setCurrentMonth] = useState(() => cloneDate(value) ?? new Date());

  // 캘린더 날짜 계산
  const calendarDays = useMemo(
    () =>
      getCalendarDays(
        currentMonth,
        value ?? null,
        selectedDates,
        multiSelect,
        disabledDates,
        minimumDate,
        maximumDate
      ),
    [currentMonth, value, selectedDates, multiSelect, disabledDates, minimumDate, maximumDate]
  );

  // 이전/다음 달 이동 가능 여부
  const canGoPrevYear = useMemo(
    () => canNavigateToMonth(currentMonth, -12, minimumDate, maximumDate),
    [currentMonth, minimumDate, maximumDate]
  );
  const canGoPrev = useMemo(
    () => canNavigateToMonth(currentMonth, -1, minimumDate, maximumDate),
    [currentMonth, minimumDate, maximumDate]
  );
  const canGoNext = useMemo(
    () => canNavigateToMonth(currentMonth, 1, minimumDate, maximumDate),
    [currentMonth, minimumDate, maximumDate]
  );
  const canGoNextYear = useMemo(
    () => canNavigateToMonth(currentMonth, 12, minimumDate, maximumDate),
    [currentMonth, minimumDate, maximumDate]
  );

  // 월 네비게이션
  const goToPrevYear = useCallback(() => {
    if (canGoPrevYear) {
      setCurrentMonth((prev) => subMonths(prev, 12));
    }
  }, [canGoPrevYear]);

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

  const goToNextYear = useCallback(() => {
    if (canGoNextYear) {
      setCurrentMonth((prev) => addMonths(prev, 12));
    }
  }, [canGoNextYear]);

  // 날짜 선택
  const handleDaySelect = useCallback(
    (date: Date) => {
      if (multiSelect && onMultiSelectChange) {
        // 다중 선택 모드
        const isAlreadySelected = selectedDates.some((d) => isSameDay(d, date));

        if (isAlreadySelected) {
          // 이미 선택된 날짜면 제거
          onMultiSelectChange(selectedDates.filter((d) => !isSameDay(d, date)));
        } else {
          // 최대 선택 개수 확인
          if (maxSelections && selectedDates.length >= maxSelections) {
            return; // 최대 개수 초과 시 추가 안함
          }
          // 새 날짜 추가
          onMultiSelectChange([...selectedDates, date]);
        }
      } else if (onChange) {
        // 단일 선택 모드
        onChange(date);
      }
    },
    [multiSelect, onChange, onMultiSelectChange, selectedDates, maxSelections]
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
      <View className="px-2 mb-4">
        <View className="flex-row items-center mb-3">
          <View className="flex-1 flex-row items-center">
            <Pressable
              onPress={goToPrevYear}
              disabled={!canGoPrevYear}
              accessibilityRole="button"
              accessibilityLabel="이전 연도"
              className={`h-9 rounded-sm bg-secondary-100 dark:bg-surface-elevated px-3 items-center justify-center mr-2 ${
                !canGoPrevYear ? 'opacity-30' : ''
              }`}
            >
              <Text className="text-xs font-semibold text-secondary-700 dark:text-secondary-100">
                1년 전
              </Text>
            </Pressable>
            <Pressable
              onPress={goToPrevMonth}
              disabled={!canGoPrev}
              accessibilityRole="button"
              accessibilityLabel="이전 달"
              className={`h-9 w-9 rounded-sm bg-secondary-100 dark:bg-surface-elevated items-center justify-center ${
                !canGoPrev ? 'opacity-30' : ''
              }`}
            >
              <ChevronLeftIcon size={18} color={canGoPrev ? '#6B7280' : '#D1D5DB'} />
            </Pressable>
          </View>

          <Text className="text-lg font-semibold text-secondary-900 dark:text-white">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </Text>

          <View className="flex-1 flex-row items-center justify-end">
            <Pressable
              onPress={goToNextMonth}
              disabled={!canGoNext}
              accessibilityRole="button"
              accessibilityLabel="다음 달"
              className={`h-9 w-9 rounded-sm bg-secondary-100 dark:bg-surface-elevated items-center justify-center mr-2 ${
                !canGoNext ? 'opacity-30' : ''
              }`}
            >
              <ChevronRightIcon size={18} color={canGoNext ? '#6B7280' : '#D1D5DB'} />
            </Pressable>
            <Pressable
              onPress={goToNextYear}
              disabled={!canGoNextYear}
              accessibilityRole="button"
              accessibilityLabel="다음 연도"
              className={`h-9 rounded-sm bg-secondary-100 dark:bg-surface-elevated px-3 items-center justify-center ${
                !canGoNextYear ? 'opacity-30' : ''
              }`}
            >
              <Text className="text-xs font-semibold text-secondary-700 dark:text-secondary-100">
                1년 후
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* 요일 헤더 */}
      <View className="flex-row mb-2">
        {WEEKDAYS.map((day, index) => (
          <View key={day} className="flex-1 items-center">
            <Text
              className={`text-xs font-medium ${
                index === 0
                  ? 'text-error-500 dark:text-error-400'
                  : index === 6
                    ? 'text-primary-500 dark:text-primary-400'
                    : 'text-secondary-500 dark:text-secondary-400'
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
              <CalendarDayCell key={day.date.toISOString()} day={day} onSelect={handleDaySelect} />
            ))}
          </View>
        ))}
      </View>

      {/* 범위 안내 (최소/최대 날짜가 있을 때) */}
      {(minimumDate || maximumDate) && (
        <View className="mt-4 px-2">
          <View className="flex-row items-center">
            <View className="w-3 h-3 rounded-sm bg-indigo-500 mr-2" />
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">
              선택 가능: {minimumDate && format(minimumDate, 'M/d', { locale: ko })}
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
