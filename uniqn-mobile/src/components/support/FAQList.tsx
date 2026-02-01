/**
 * UNIQN Mobile - FAQList 컴포넌트
 *
 * @description FAQ 아코디언 리스트
 * @version 1.0.0
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, LayoutAnimation } from 'react-native';
import { AccordionItem } from '@/components/ui';
import type { FAQItem, InquiryCategory } from '@/types';
import { INQUIRY_CATEGORY_LABELS } from '@/types';

export interface FAQListProps {
  /** FAQ 아이템 목록 */
  items: FAQItem[];
  /** 선택된 카테고리 */
  selectedCategory?: InquiryCategory | 'all';
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 커스텀 클래스 */
  className?: string;
}

export function FAQList({
  items,
  selectedCategory = 'all',
  emptyMessage = '검색 결과가 없습니다.',
  className = '',
}: FAQListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 카테고리별 필터링
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') {
      return items.filter((item) => item.isActive !== false);
    }
    return items.filter(
      (item) => item.category === selectedCategory && item.isActive !== false
    );
  }, [items, selectedCategory]);

  // 카테고리별 그룹화
  const groupedItems = useMemo(() => {
    if (selectedCategory !== 'all') {
      return { [selectedCategory]: filteredItems };
    }

    const groups: Record<string, FAQItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems, selectedCategory]);

  const handleToggle = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // 빈 상태
  if (filteredItems.length === 0) {
    return (
      <View className={`items-center justify-center py-12 ${className}`}>
        <Text className="text-gray-500 dark:text-gray-400">{emptyMessage}</Text>
      </View>
    );
  }

  // 전체 카테고리일 때 그룹별 표시
  if (selectedCategory === 'all') {
    return (
      <View className={className}>
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <View key={category} className="mb-4">
            <Text className="mb-2 px-4 text-sm font-semibold text-gray-500 dark:text-gray-400">
              {INQUIRY_CATEGORY_LABELS[category as InquiryCategory] || category}
            </Text>
            <View className="rounded-xl bg-white dark:bg-surface">
              {categoryItems.map((item, index) => (
                <View key={item.id}>
                  <View className="px-4">
                    <AccordionItem
                      title={item.question}
                      expanded={expandedId === item.id}
                      onToggle={() => handleToggle(item.id)}
                    >
                      <Text className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                        {item.answer}
                      </Text>
                    </AccordionItem>
                  </View>
                  {index < categoryItems.length - 1 && (
                    <View className="mx-4 h-px bg-gray-100 dark:bg-surface" />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  // 특정 카테고리일 때 단순 리스트
  return (
    <View className={`rounded-xl bg-white dark:bg-surface ${className}`}>
      {filteredItems.map((item, index) => (
        <View key={item.id}>
          <View className="px-4">
            <AccordionItem
              title={item.question}
              expanded={expandedId === item.id}
              onToggle={() => handleToggle(item.id)}
            >
              <Text className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                {item.answer}
              </Text>
            </AccordionItem>
          </View>
          {index < filteredItems.length - 1 && (
            <View className="mx-4 h-px bg-gray-100 dark:bg-surface" />
          )}
        </View>
      ))}
    </View>
  );
}

export default FAQList;
