/**
 * UNIQN Mobile - FAQCategoryTabs 컴포넌트
 *
 * @description FAQ 카테고리 필터 탭
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { InquiryCategory } from '@/types';
import { INQUIRY_CATEGORY_LABELS } from '@/types';

export type FAQCategoryFilter = InquiryCategory | 'all';

export interface FAQCategoryTabsProps {
  selectedCategory: FAQCategoryFilter;
  onSelectCategory: (category: FAQCategoryFilter) => void;
  className?: string;
}

const CATEGORY_OPTIONS: { key: FAQCategoryFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'general', label: INQUIRY_CATEGORY_LABELS.general },
  { key: 'account', label: INQUIRY_CATEGORY_LABELS.account },
  { key: 'payment', label: INQUIRY_CATEGORY_LABELS.payment },
  { key: 'technical', label: INQUIRY_CATEGORY_LABELS.technical },
  { key: 'other', label: INQUIRY_CATEGORY_LABELS.other },
];

export function FAQCategoryTabs({
  selectedCategory,
  onSelectCategory,
  className = '',
}: FAQCategoryTabsProps) {
  return (
    <View className={className}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 py-2"
      >
        {CATEGORY_OPTIONS.map((option) => {
          const isSelected = selectedCategory === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onSelectCategory(option.key)}
              className={`rounded-full px-4 py-2 ${
                isSelected ? 'bg-primary-500 dark:bg-primary-600' : 'bg-gray-100 dark:bg-surface'
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${option.label} 카테고리`}
            >
              <Text
                className={`text-sm font-medium ${
                  isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default FAQCategoryTabs;
