import React, { memo, useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { PostingType } from '@/types';

interface PostingTypeChipsProps {
  selected: PostingType | null;
  onChange: (type: PostingType | null) => void;
  counts?: Partial<Record<PostingType, number>>;
  className?: string;
}

interface ChipConfig {
  id: string;
  label: string;
  icon: string;
  value: PostingType | null;
}

interface ChipItemProps {
  chip: ChipConfig;
  count?: number;
  isSelected: boolean;
  onPress: () => void;
}

const CHIPS: ChipConfig[] = [
  { id: 'urgent', label: '긴급', icon: '', value: 'urgent' },
  { id: 'tournament', label: '대회', icon: '', value: 'tournament' },
  { id: 'regular', label: '일반', icon: '', value: 'regular' },
  { id: 'fixed', label: '고정', icon: '', value: 'fixed' },
];

function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

const ChipItem = memo(function ChipItem({ chip, count, isSelected, onPress }: ChipItemProps) {
  const showCount = typeof count === 'number';
  const accessibilityLabel = showCount
    ? `${chip.label} 공고 ${count}건`
    : `${chip.label} 공고 필터`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isSelected }}
      className={`flex-row items-center rounded-sm px-4 py-2 ${
        isSelected ? 'bg-primary-600 dark:bg-primary-700' : 'bg-secondary-100 dark:bg-surface'
      }`}
    >
      <Text className="mr-1.5">{chip.icon}</Text>
      <Text
        className={`font-medium ${isSelected ? 'text-surface-dark' : 'text-secondary-700 dark:text-secondary-300'}`}
      >
        {chip.label}
      </Text>
      {showCount ? (
        <View
          className={`ml-2 rounded-sm px-2 py-0.5 ${
            isSelected ? 'bg-white/20 dark:bg-white/20' : 'bg-white dark:bg-surface-elevated'
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              isSelected ? 'text-surface-dark' : 'text-secondary-600 dark:text-secondary-300'
            }`}
          >
            {formatCount(count)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

export const PostingTypeChips = memo(function PostingTypeChips({
  selected,
  onChange,
  counts,
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
        contentContainerClassName="gap-2 px-4 py-3"
      >
        {CHIPS.map((chip) => (
          <ChipItem
            key={chip.id}
            chip={chip}
            count={chip.value ? counts?.[chip.value] : undefined}
            isSelected={selected === chip.value}
            onPress={() => handlePress(chip.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

export default PostingTypeChips;
