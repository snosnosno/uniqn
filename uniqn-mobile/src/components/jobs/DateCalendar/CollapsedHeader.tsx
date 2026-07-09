/**
 * UNIQN Mobile - CollapsedHeader
 *
 * @description 달력이 접힌 상태의 헤더
 *   - 날짜 선택됨: [ 📅  4월 18일 (토) · 12건    [ ✕ ] ]  — 좌측 탭 = 펼치기 / ✕ = 선택 해제
 *   - 선택 없음:   [ ▼  2026년 4월 · 전체 보기 ]         — 영역 전체 탭 = 펼치기
 * @version 1.1.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { CalendarIcon, ChevronDownIcon, XIcon } from '@/components/icons';
import { triggerHaptic } from '@/utils/haptics';

interface CollapsedHeaderProps {
  selectedDate: Date | null;
  visibleMonth: Date;
  count: number;
  onExpand: () => void;
  onClear: () => void;
}

export const CollapsedHeader = memo(function CollapsedHeader({
  selectedDate,
  visibleMonth,
  count,
  onExpand,
  onClear,
}: CollapsedHeaderProps) {
  const handleExpand = useCallback(() => {
    void triggerHaptic('light');
    onExpand();
  }, [onExpand]);

  const handleClear = useCallback(() => {
    void triggerHaptic('light');
    onClear();
  }, [onClear]);

  if (!selectedDate) {
    const monthLabel = format(visibleMonth, 'yyyy년 M월', { locale: ko });
    return (
      <View
        className="flex-row items-center bg-surface-card dark:bg-surface-elevated border-b border-divider"
        style={{ minHeight: 48 }}
      >
        <Pressable
          onPress={handleExpand}
          accessibilityRole="button"
          accessibilityLabel={`달력 펼치기, 현재 ${monthLabel} 전체 보기`}
          className="flex-1 flex-row items-center px-4 py-3 active:bg-secondary-100 dark:active:bg-surface-hover"
        >
          <ChevronDownIcon size={16} />
          <Text className="ml-2 text-sm font-sans-medium text-content-primary">
            {monthLabel} · 전체 보기
          </Text>
        </Pressable>
      </View>
    );
  }

  const summary = `${format(selectedDate, 'M월 d일 (E)', { locale: ko })} · ${count}건`;

  return (
    <View
      className="flex-row items-center bg-surface-card dark:bg-surface-elevated border-b border-divider"
      style={{ minHeight: 48 }}
    >
      <Pressable
        onPress={handleExpand}
        accessibilityRole="button"
        accessibilityLabel={`날짜 필터 펼치기, 현재 ${summary} 선택됨`}
        className="flex-1 flex-row items-center px-4 py-3 active:bg-secondary-100 dark:active:bg-surface-hover"
      >
        <CalendarIcon size={16} />
        <Text className="ml-2 text-sm font-sans-medium text-content-primary">{summary}</Text>
      </Pressable>

      <Pressable
        onPress={handleClear}
        accessibilityRole="button"
        accessibilityLabel="날짜 필터 해제"
        hitSlop={10}
        className="w-11 h-11 items-center justify-center active:bg-secondary-100 dark:active:bg-surface-hover"
      >
        <XIcon size={16} />
      </Pressable>
    </View>
  );
});
