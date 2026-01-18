/**
 * UNIQN Mobile - NotificationCategoryTabs 컴포넌트
 *
 * @description 알림 카테고리 필터 탭
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  NotificationCategory,
  NOTIFICATION_CATEGORY_LABELS,
} from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

export type NotificationCategoryFilter = NotificationCategory | 'all';

export interface NotificationCategoryTabsProps {
  /** 선택된 카테고리 */
  selectedCategory: NotificationCategoryFilter;
  /** 카테고리 선택 핸들러 */
  onSelectCategory: (category: NotificationCategoryFilter) => void;
  /** 카테고리별 읽지 않은 알림 수 */
  unreadByCategory?: Partial<Record<NotificationCategory, number>>;
  /** 추가 스타일 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_OPTIONS: { key: NotificationCategoryFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: NotificationCategory.APPLICATION, label: NOTIFICATION_CATEGORY_LABELS[NotificationCategory.APPLICATION] },
  { key: NotificationCategory.ATTENDANCE, label: NOTIFICATION_CATEGORY_LABELS[NotificationCategory.ATTENDANCE] },
  { key: NotificationCategory.SETTLEMENT, label: NOTIFICATION_CATEGORY_LABELS[NotificationCategory.SETTLEMENT] },
  { key: NotificationCategory.JOB, label: NOTIFICATION_CATEGORY_LABELS[NotificationCategory.JOB] },
  { key: NotificationCategory.SYSTEM, label: NOTIFICATION_CATEGORY_LABELS[NotificationCategory.SYSTEM] },
];

// ============================================================================
// Component
// ============================================================================

export function NotificationCategoryTabs({
  selectedCategory,
  onSelectCategory,
  unreadByCategory,
  className = '',
}: NotificationCategoryTabsProps) {
  const handleSelect = useCallback(
    (category: NotificationCategoryFilter) => {
      onSelectCategory(category);
    },
    [onSelectCategory]
  );

  return (
    <View className={`bg-white dark:bg-gray-800 ${className}`}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}
      >
        {CATEGORY_OPTIONS.map((option) => {
          const isSelected = selectedCategory === option.key;
          const unreadCount =
            option.key === 'all'
              ? undefined
              : unreadByCategory?.[option.key as NotificationCategory];

          return (
            <Pressable
              key={option.key}
              onPress={() => handleSelect(option.key)}
              className={`flex-row items-center rounded-full px-4 py-2 ${
                isSelected
                  ? 'bg-primary-500 dark:bg-primary-600'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${option.label} 카테고리${
                unreadCount ? `, ${unreadCount}개의 읽지 않은 알림` : ''
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isSelected
                    ? 'text-white'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {option.label}
              </Text>
              {/* 읽지 않은 알림 수 배지 */}
              {unreadCount !== undefined && unreadCount > 0 && (
                <View
                  className={`ml-1.5 min-w-[18px] items-center justify-center rounded-full px-1.5 ${
                    isSelected ? 'bg-white/20' : 'bg-error-500'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-white' : 'text-white'
                    }`}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default NotificationCategoryTabs;
