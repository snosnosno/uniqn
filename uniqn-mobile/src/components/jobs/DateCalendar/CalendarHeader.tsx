/**
 * UNIQN Mobile - CalendarHeader
 *
 * @description 달력 상단 헤더 — 월 이동 화살표 + 월 이름 + "전체 보기" 버튼
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from '@/components/icons';

interface CalendarHeaderProps {
  visibleMonth: Date;
  canGoPrev: boolean;
  canGoNext: boolean;
  hasSelection: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClearSelection: () => void;
  onCollapse: () => void;
}

export const CalendarHeader = memo(function CalendarHeader({
  visibleMonth,
  canGoPrev,
  canGoNext,
  hasSelection,
  onPrev,
  onNext,
  onClearSelection,
  onCollapse,
}: CalendarHeaderProps) {
  const monthLabel = format(visibleMonth, 'yyyy년 M월', { locale: ko });

  // 월 이동·접기·필터 해제에는 햅틱을 쓰지 않는다 — impeccable §17 금지 목록의
  // '네비게이션'·'일반 탭'에 해당한다. 스케줄 탭 달력은 같은 동작에 원래 진동이 없었고,
  // 두 달력이 같은 일을 하는데 한쪽만 떨리는 게 이 항목의 결함이다.
  const handlePrev = useCallback(() => {
    if (!canGoPrev) return;
    onPrev();
  }, [canGoPrev, onPrev]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    onNext();
  }, [canGoNext, onNext]);

  return (
    <View className="flex-row items-center px-4 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 달"
        accessibilityState={{ disabled: !canGoPrev }}
        disabled={!canGoPrev}
        onPress={handlePrev}
        hitSlop={10}
        className={`w-11 h-11 items-center justify-center ${canGoPrev ? '' : 'opacity-40'}`}
      >
        <ChevronLeftIcon size={24} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="달력 접기"
        onPress={onCollapse}
        hitSlop={10}
        className="flex-1 flex-row items-center justify-center gap-1 active:opacity-70"
      >
        <Text
          className="text-base font-sans-semibold text-content-primary"
          accessibilityRole="header"
        >
          {monthLabel}
        </Text>
        <ChevronUpIcon size={16} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 달"
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        onPress={handleNext}
        hitSlop={10}
        className={`w-11 h-11 items-center justify-center ${canGoNext ? '' : 'opacity-40'}`}
      >
        <ChevronRightIcon size={24} />
      </Pressable>

      {hasSelection && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="전체 날짜 보기"
          onPress={onClearSelection}
          hitSlop={10}
          className="ml-2 px-2 py-1"
        >
          <Text className="text-xs font-sans-medium text-content-secondary">전체 보기</Text>
        </Pressable>
      )}
    </View>
  );
});
