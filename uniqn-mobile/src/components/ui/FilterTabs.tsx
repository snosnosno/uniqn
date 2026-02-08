/**
 * UNIQN Mobile - FilterTabs 공통 컴포넌트
 *
 * @description 세그먼트 컨트롤 스타일의 필터 탭 UI
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface FilterTabOption<T extends string = string> {
  /** 필터 값 */
  value: T;
  /** 탭에 표시할 레이블 */
  label: string;
  /** 카운트 (선택적) */
  count?: number;
}

export interface FilterTabsProps<T extends string = string> {
  /** 필터 옵션 목록 */
  options: FilterTabOption<T>[];
  /** 현재 선택된 필터 값 */
  selectedValue: T;
  /** 필터 변경 핸들러 */
  onSelect: (value: T) => void;
  /** 카운트 표시 모드: 'always' | 'positive' | 'none' (기본: 'positive') */
  countDisplay?: 'always' | 'positive' | 'none';
  /** 레이블 텍스트 크기: 'xs' | 'sm' (기본: 'xs') */
  labelSize?: 'xs' | 'sm';
  /** 추가 className (외부 래퍼) */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const LABEL_SIZE_CLASS = {
  xs: 'text-xs',
  sm: 'text-sm',
} as const;

// ============================================================================
// Component
// ============================================================================

function FilterTabsInner<T extends string = string>({
  options,
  selectedValue,
  onSelect,
  countDisplay = 'positive',
  labelSize = 'xs',
  className,
}: FilterTabsProps<T>) {
  const renderCount = useCallback(
    (option: FilterTabOption<T>): string => {
      if (countDisplay === 'none') return '';
      if (countDisplay === 'always') return ` (${option.count ?? 0})`;
      // 'positive' (기본값)
      if (option.count !== undefined && option.count > 0) return ` (${option.count})`;
      return '';
    },
    [countDisplay]
  );

  return (
    <View className={className ?? 'px-4 mb-4'}>
      <View
        className="flex-row bg-gray-100 dark:bg-surface rounded-lg p-1"
        accessibilityRole="tablist"
      >
        {options.map((option) => {
          const isSelected = selectedValue === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              className="flex-1 items-center justify-center py-2 rounded-md"
              style={{
                backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${option.label} 필터${option.count !== undefined ? `, ${option.count}건` : ''}`}
            >
              <Text
                className={`${LABEL_SIZE_CLASS[labelSize]} font-medium`}
                style={{
                  color: isSelected ? '#4F46E5' : '#6B7280',
                }}
              >
                {option.label}
                {renderCount(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const FilterTabs = React.memo(FilterTabsInner) as typeof FilterTabsInner;
