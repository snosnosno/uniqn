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
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { triggerHaptic } from '@/utils/haptics';

interface CalendarHeaderProps {
  visibleMonth: Date;
  canGoPrev: boolean;
  canGoNext: boolean;
  hasSelection: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClearSelection: () => void;
}

export const CalendarHeader = memo(function CalendarHeader({
  visibleMonth,
  canGoPrev,
  canGoNext,
  hasSelection,
  onPrev,
  onNext,
  onClearSelection,
}: CalendarHeaderProps) {
  const monthLabel = format(visibleMonth, 'yyyy년 M월', { locale: ko });

  const handlePrev = useCallback(() => {
    if (!canGoPrev) return;
    void triggerHaptic('light');
    onPrev();
  }, [canGoPrev, onPrev]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    void triggerHaptic('light');
    onNext();
  }, [canGoNext, onNext]);

  return (
    <View className="flex-row items-center px-4 py-3">
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

      <View className="flex-1 items-center">
        <Text
          className="text-base font-sans-semibold text-content-primary"
          accessibilityRole="header"
        >
          {monthLabel}
        </Text>
      </View>

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
          onPress={() => {
            void triggerHaptic('light');
            onClearSelection();
          }}
          hitSlop={10}
          className="ml-2 px-2 py-1"
        >
          <Text className="text-xs font-sans-medium text-content-secondary">전체 보기</Text>
        </Pressable>
      )}
    </View>
  );
});

export default CalendarHeader;
