/**
 * UNIQN Mobile - 날짜 슬라이더 컴포넌트
 *
 * @description 가로 스크롤 칩 형태의 날짜 필터 (지원 타입 공고용)
 * @version 1.0.0
 */

import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { subDays, addDays, isToday, isYesterday, format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';

// ============================================================================
// Types
// ============================================================================

interface DateSliderProps {
  /** 선택된 날짜 (null = 전체) */
  selectedDate: Date | null;
  /** 날짜 변경 핸들러 */
  onDateSelect: (date: Date | null) => void;
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 날짜 범위 생성
 */
function generateDateRange(startDate: Date, days: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(startDate, i));
  }
  return dates;
}

/**
 * 날짜 라벨 포맷
 */
function getDateLabel(date: Date): string {
  if (isToday(date)) return '오늘';
  if (isYesterday(date)) return '어제';
  return format(date, 'M/d', { locale: ko });
}

/**
 * 요일 라벨
 */
function getDayLabel(date: Date): string {
  return format(date, 'EEE', { locale: ko });
}

// ============================================================================
// Sub-Components
// ============================================================================

interface DateChipProps {
  date: Date;
  isSelected: boolean;
  onPress: () => void;
}

const DateChip = memo(function DateChip({ date, isSelected, onPress }: DateChipProps) {
  const label = getDateLabel(date);
  const dayLabel = getDayLabel(date);
  const today = isToday(date);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${dayLabel}`}
      accessibilityState={{ selected: isSelected }}
      className={`items-center px-4 py-2 rounded-lg min-w-[60px] ${
        isSelected ? 'bg-primary-600 dark:bg-primary-700' : 'bg-gray-100 dark:bg-surface'
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          isSelected
            ? 'text-white'
            : today
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        {label}
      </Text>
      <Text
        className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}
      >
        {dayLabel}
      </Text>
    </Pressable>
  );
});

interface AllChipProps {
  isSelected: boolean;
  onPress: () => void;
}

const AllChip = memo(function AllChip({ isSelected, onPress }: AllChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="전체 날짜"
      accessibilityState={{ selected: isSelected }}
      className={`items-center justify-center px-4 py-2 rounded-lg min-w-[60px] ${
        isSelected ? 'bg-primary-600 dark:bg-primary-700' : 'bg-gray-100 dark:bg-surface'
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        전체
      </Text>
    </Pressable>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 날짜 슬라이더
 *
 * @example
 * <DateSlider
 *   selectedDate={selectedDate}
 *   onDateSelect={setSelectedDate}
 * />
 */
export const DateSlider = memo(function DateSlider({
  selectedDate,
  onDateSelect,
  className = '',
}: DateSliderProps) {
  const scrollRef = useRef<ScrollView>(null);

  // 날짜 범위 생성 (어제~+14일 = 16일)
  const dates = useMemo(() => {
    const yesterday = subDays(new Date(), 1);
    return generateDateRange(yesterday, 16);
  }, []);

  // 오늘 날짜 인덱스 계산
  const todayIndex = useMemo(() => {
    return dates.findIndex((d) => isToday(d));
  }, [dates]);

  // 마운트 시 오늘 날짜로 스크롤
  useEffect(() => {
    if (scrollRef.current && todayIndex > 0) {
      // 칩 너비 약 68px (min-w-[60px] + gap) 기준으로 스크롤 위치 계산
      const chipWidth = 68;
      const paddingLeft = 16; // px-4 = 16px
      const offset = todayIndex * chipWidth;
      // 약간의 딜레이 후 스크롤 (레이아웃 완료 후)
      // Math.max(0, ...)로 왼쪽 패딩이 화면 밖으로 나가지 않도록 제한
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: Math.max(0, offset - paddingLeft), animated: true });
      }, 100);
    }
  }, [todayIndex]);

  const handleDatePress = useCallback(
    (date: Date | null) => {
      onDateSelect(date);
    },
    [onDateSelect]
  );

  return (
    <View
      className={`bg-white dark:bg-surface border-t border-gray-100 dark:border-surface-overlay ${className}`}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4 py-3 gap-2"
      >
        {/* 전체 버튼 */}
        <AllChip isSelected={selectedDate === null} onPress={() => handleDatePress(null)} />

        {/* 날짜 버튼들 */}
        {dates.map((date) => (
          <DateChip
            key={date.toISOString()}
            date={date}
            isSelected={selectedDate !== null && isSameDay(date, selectedDate)}
            onPress={() => handleDatePress(date)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

export default DateSlider;
