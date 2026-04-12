/**
 * UNIQN Mobile - 날짜 네비게이션 헤더 컴포넌트
 *
 * @description 그룹 모드에서 날짜 이동 UI 표시
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronLeftIcon, ChevronRightIcon } from '../../../icons';
import { formatDate } from '@/utils/date';
import { parseTimestamp } from '@/utils/settlement';

export interface DateNavigationHeaderProps {
  /** 현재 워크로그의 날짜 */
  workLogDate: string;
  /** 현재 날짜 인덱스 (0-based) */
  currentDateIndex: number;
  /** 전체 날짜 수 */
  totalDays: number;
  /** 이전 날짜 이동 가능 여부 */
  canGoPrev: boolean;
  /** 다음 날짜 이동 가능 여부 */
  canGoNext: boolean;
  /** 이전 날짜로 이동 */
  onPrevDate: () => void;
  /** 다음 날짜로 이동 */
  onNextDate: () => void;
  /** 다크모드 여부 */
  isDark: boolean;
}

/**
 * 날짜 네비게이션 헤더
 *
 * @example
 * <DateNavigationHeader
 *   workLogDate="2024-01-15"
 *   currentDateIndex={0}
 *   totalDays={3}
 *   canGoPrev={false}
 *   canGoNext={true}
 *   onPrevDate={handlePrev}
 *   onNextDate={handleNext}
 *   isDark={false}
 * />
 */
export function DateNavigationHeader({
  workLogDate,
  currentDateIndex,
  totalDays,
  canGoPrev,
  canGoNext,
  onPrevDate,
  onNextDate,
  isDark,
}: DateNavigationHeaderProps) {
  return (
    <View className="flex-row items-center justify-center py-3 mx-4 mt-4 bg-secondary-50 dark:bg-surface rounded-lg">
      <Pressable
        onPress={onPrevDate}
        disabled={!canGoPrev}
        className={`p-2 rounded-sm min-w-[44px] min-h-[44px] items-center justify-center ${
          !canGoPrev ? 'opacity-30' : 'active:bg-secondary-200 dark:active:bg-secondary-700'
        }`}
        accessibilityLabel="이전 날짜"
      >
        <ChevronLeftIcon
          size={24}
          color={isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]}
        />
      </Pressable>

      <View className="flex-1 items-center">
        <Text className="text-base font-sans-semibold text-secondary-900 dark:text-off-white">
          {formatDate(parseTimestamp(workLogDate) ?? workLogDate)}
        </Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {currentDateIndex + 1} / {totalDays}
        </Text>
      </View>

      <Pressable
        onPress={onNextDate}
        disabled={!canGoNext}
        className={`p-2 rounded-sm min-w-[44px] min-h-[44px] items-center justify-center ${
          !canGoNext ? 'opacity-30' : 'active:bg-secondary-200 dark:active:bg-secondary-700'
        }`}
        accessibilityLabel="다음 날짜"
      >
        <ChevronRightIcon
          size={24}
          color={isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]}
        />
      </Pressable>
    </View>
  );
}
