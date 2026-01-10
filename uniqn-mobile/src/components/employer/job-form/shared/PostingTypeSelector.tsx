/**
 * PostingTypeSelector - 공고 타입 선택 컴포넌트
 *
 * @description 4가지 공고 타입(지원/고정/대회/긴급)을 선택하는 칩 UI
 * @version 1.1.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CheckCircleIcon } from '@/components/icons';

import type { PostingType } from '@/types';
import { POSTING_TYPE_INFO } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface PostingTypeSelectorProps {
  /** 선택된 공고 타입 */
  value: PostingType;
  /** 타입 변경 핸들러 */
  onChange: (type: PostingType) => void;
  /** 비활성화 여부 (수정 모드에서 true) */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 공고 타입 선택 카드
 */
const TypeCard = memo(function TypeCard({
  type,
  isSelected,
  disabled,
  onPress,
}: {
  type: PostingType;
  isSelected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const info = POSTING_TYPE_INFO[type];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`
        flex-1 p-3 rounded-xl border
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        }
        ${disabled ? 'opacity-50' : 'active:scale-[0.98]'}
      `}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled }}
      accessibilityLabel={`${info.label} 공고 타입`}
    >
      <View className="flex-row items-center">
        {/* 아이콘 */}
        <Text className="text-xl mr-2">{info.icon}</Text>

        {/* 라벨 + 설명 */}
        <View className="flex-1">
          <Text
            className={`
              text-sm font-semibold
              ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}
            `}
          >
            {info.label}
          </Text>
          <Text
            className={`
              text-xs
              ${isSelected ? 'text-blue-500 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}
            `}
          >
            {info.description}
          </Text>
        </View>

        {/* 체크 */}
        {isSelected && <CheckCircleIcon size={16} color="#3B82F6" />}
      </View>
    </Pressable>
  );
});

/**
 * PostingTypeSelector 메인 컴포넌트
 */
export const PostingTypeSelector = memo(function PostingTypeSelector({
  value,
  onChange,
  disabled = false,
}: PostingTypeSelectorProps) {
  const handlePress = useCallback(
    (type: PostingType) => {
      if (!disabled && type !== value) {
        onChange(type);
      }
    },
    [disabled, value, onChange]
  );

  return (
    <View className="mb-4">
      {/* 라벨 */}
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        공고 타입 <Text className="text-red-500">*</Text>
      </Text>

      {/* 2x2 그리드 */}
      <View className="gap-2">
        <View className="flex-row gap-2">
          <TypeCard
            type="regular"
            isSelected={value === 'regular'}
            disabled={disabled}
            onPress={() => handlePress('regular')}
          />
          <TypeCard
            type="fixed"
            isSelected={value === 'fixed'}
            disabled={disabled}
            onPress={() => handlePress('fixed')}
          />
        </View>
        <View className="flex-row gap-2">
          <TypeCard
            type="tournament"
            isSelected={value === 'tournament'}
            disabled={disabled}
            onPress={() => handlePress('tournament')}
          />
          <TypeCard
            type="urgent"
            isSelected={value === 'urgent'}
            disabled={disabled}
            onPress={() => handlePress('urgent')}
          />
        </View>
      </View>

      {/* 대회 공고 안내 */}
      {value === 'tournament' && (
        <View className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <Text className="text-sm text-amber-700 dark:text-amber-300">
            대회 공고는 관리자 승인 후 게시됩니다.
          </Text>
        </View>
      )}

      {/* 긴급 공고 안내 */}
      {value === 'urgent' && (
        <View className="mt-3 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <Text className="text-sm text-red-700 dark:text-red-300">
            긴급 공고는 오늘부터 7일 이내의 날짜만 선택할 수 있습니다.
          </Text>
        </View>
      )}

      {/* 수정 모드 안내 */}
      {disabled && (
        <View className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
            공고 타입은 수정할 수 없습니다
          </Text>
        </View>
      )}
    </View>
  );
});

export default PostingTypeSelector;
