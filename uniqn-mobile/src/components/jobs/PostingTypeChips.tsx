/**
 * UNIQN Mobile - 공고 타입 칩 필터 컴포넌트
 *
 * @description 가로 스크롤 칩 형태의 공고 타입 필터
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { PostingType } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface PostingTypeChipsProps {
  /** 선택된 공고 타입 (null = 전체) */
  selected: PostingType | null;
  /** 타입 변경 핸들러 */
  onChange: (type: PostingType | null) => void;
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Chip Configuration
// ============================================================================

interface ChipConfig {
  id: string;
  label: string;
  icon: string;
  value: PostingType | null;
}

const CHIPS: ChipConfig[] = [
  { id: 'urgent', label: '긴급', icon: '🚨', value: 'urgent' },
  { id: 'tournament', label: '대회', icon: '🏆', value: 'tournament' },
  { id: 'regular', label: '지원', icon: '📝', value: 'regular' },
  { id: 'fixed', label: '고정', icon: '📌', value: 'fixed' },
];

// ============================================================================
// Sub-Components
// ============================================================================

interface ChipItemProps {
  chip: ChipConfig;
  isSelected: boolean;
  onPress: () => void;
}

const ChipItem = memo(function ChipItem({ chip, isSelected, onPress }: ChipItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${chip.label} 공고 필터`}
      accessibilityState={{ selected: isSelected }}
      className={`flex-row items-center px-4 py-2 rounded-full ${
        isSelected ? 'bg-primary-600 dark:bg-primary-700' : 'bg-gray-100 dark:bg-surface'
      }`}
    >
      <Text className="mr-1.5">{chip.icon}</Text>
      <Text
        className={`font-medium ${isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}
      >
        {chip.label}
      </Text>
    </Pressable>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 공고 타입 칩 필터
 *
 * @example
 * <PostingTypeChips
 *   selected={selectedType}
 *   onChange={setSelectedType}
 * />
 */
export const PostingTypeChips = memo(function PostingTypeChips({
  selected,
  onChange,
  className = '',
}: PostingTypeChipsProps) {
  const handlePress = useCallback(
    (value: PostingType | null) => {
      onChange(value);
    },
    [onChange]
  );

  return (
    <View className={`bg-white dark:bg-surface ${className}`}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4 py-3 gap-2"
      >
        {CHIPS.map((chip) => (
          <ChipItem
            key={chip.id}
            chip={chip}
            isSelected={selected === chip.value}
            onPress={() => handlePress(chip.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

export default PostingTypeChips;
