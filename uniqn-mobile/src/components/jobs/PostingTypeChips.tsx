import React, { memo, useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { PostingType } from '@/types';

interface PostingTypeChipsProps {
  selected: PostingType | null;
  onChange: (type: PostingType | null) => void;
  counts?: Partial<Record<PostingType, number>>;
  className?: string;
  /** true면 시각적으로 비활성화(dim)하고 탭을 무시한다 (예: 검색 모드) */
  disabled?: boolean;
}

interface ChipConfig {
  id: string;
  label: string;
  value: PostingType | null;
}

interface ChipItemProps {
  chip: ChipConfig;
  count?: number;
  isSelected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * 세로 슬롭을 4로 줄인 이유 — 칩 행과 바로 아래 FilterBar 필 행 사이 간격이 8px(pb-2)이라
 * 양쪽이 slop 8을 쓰면 그 8px 전체가 두 행의 히트 영역에 이중 귀속된다. 두 행은 동작이
 * 이질적이라(칩=타입 즉시 토글 / 필=필터 시트 열기) 오탭 비용이 크다.
 * 36 + 4 + 4 = 44px 로 WCAG 2.5.5 최소 타깃은 유지한다(2026-07-25).
 */
const CHIP_HIT_SLOP = { top: 4, bottom: 4, left: 8, right: 8 } as const;

const CHIPS: ChipConfig[] = [
  { id: 'urgent', label: '급구', value: 'urgent' },
  { id: 'tournament', label: '대회', value: 'tournament' },
  { id: 'regular', label: '지원', value: 'regular' },
  { id: 'fixed', label: '고정', value: 'fixed' },
];

function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

const ChipItem = memo(function ChipItem({
  chip,
  count,
  isSelected,
  disabled,
  onPress,
}: ChipItemProps) {
  // FilterBar 필과 동일한 칩 언어(36px 알약·outline 비활성/골드 filled 활성)로 통일 —
  // 두 행이 서로 다른 배경판·높이·모서리로 어긋나 보이던 문제 해소(2026-07-25).
  // 눌림 피드백(active:opacity-70)도 필과 동일하게 맞춘다.
  const showCount = typeof count === 'number';
  const accessibilityLabel = showCount
    ? `${chip.label} 공고 ${count}건`
    : `${chip.label} 공고 필터`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isSelected, disabled }}
      hitSlop={CHIP_HIT_SLOP}
      className={`min-h-[36px] flex-row items-center rounded-full border px-3 py-1.5 active:opacity-70 ${
        isSelected
          ? 'border-transparent bg-primary-600 dark:bg-primary-700'
          : 'border-secondary-300 bg-transparent dark:border-surface-overlay'
      }`}
    >
      <Text
        className={`text-sm font-sans-medium ${isSelected ? 'text-content-onGold' : 'text-content-secondary dark:text-secondary-400'}`}
      >
        {chip.label}
      </Text>
      {showCount ? (
        <View
          className={`ml-1.5 min-w-[20px] items-center rounded-full px-1.5 py-0.5 ${
            isSelected
              ? 'bg-white/20 dark:bg-white/20'
              : 'bg-secondary-100 dark:bg-surface-elevated'
          }`}
        >
          <Text
            className={`text-xs font-sans-semibold ${
              isSelected ? 'text-content-onGold' : 'text-secondary-600 dark:text-secondary-300'
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
  disabled = false,
}: PostingTypeChipsProps) {
  const handlePress = useCallback(
    (value: PostingType | null) => {
      if (disabled) {
        return;
      }
      onChange(value);
    },
    [disabled, onChange]
  );

  return (
    // 배경판 없음 — 검색바·필터바와 같은 페이지 배경 위에 얹혀 한 덩어리로 보인다
    <View className={`${disabled ? 'opacity-50' : ''} ${className}`}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-2 px-4 pb-2"
      >
        {CHIPS.map((chip) => (
          <ChipItem
            key={chip.id}
            chip={chip}
            count={chip.value ? counts?.[chip.value] : undefined}
            isSelected={selected === chip.value}
            disabled={disabled}
            onPress={() => handlePress(chip.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
});
