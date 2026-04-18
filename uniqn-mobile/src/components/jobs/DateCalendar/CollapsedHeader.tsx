/**
 * UNIQN Mobile - CollapsedHeader
 *
 * @description 달력이 접힌 상태의 헤더 — 선택 요약 + 펼치기 탭 + ✕ 해제
 * @version 1.0.0
 *
 * H1 디자인 (spec 결정 #8):
 *   [ 📅  4월 18일 (토) · 12건              [ ✕ ] ]
 *   ↑ 왼쪽 영역 전체 탭 = 펼치기    ↑ ✕ = 선택 해제
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { CalendarIcon, XIcon } from '@/components/icons';
import { triggerHaptic } from '@/utils/haptics';

interface CollapsedHeaderProps {
  selectedDate: Date;
  count: number;
  onExpand: () => void;
  onClear: () => void;
}

export const CollapsedHeader = memo(function CollapsedHeader({
  selectedDate,
  count,
  onExpand,
  onClear,
}: CollapsedHeaderProps) {
  const summary = `${format(selectedDate, 'M월 d일 (E)', { locale: ko })} · ${count}건`;

  const handleExpand = useCallback(() => {
    void triggerHaptic('light');
    onExpand();
  }, [onExpand]);

  const handleClear = useCallback(() => {
    void triggerHaptic('light');
    onClear();
  }, [onClear]);

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

export default CollapsedHeader;
