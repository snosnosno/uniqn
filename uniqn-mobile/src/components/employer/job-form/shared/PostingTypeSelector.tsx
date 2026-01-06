/**
 * PostingTypeSelector - 공고 타입 선택 컴포넌트
 *
 * @description 4가지 공고 타입(지원/고정/대회/긴급)을 선택하는 2x2 그리드 카드 UI
 * @version 1.0.0
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
        relative flex-1 min-h-[88px] p-3 rounded-xl border-2
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
        }
        ${disabled ? 'opacity-50' : 'active:scale-[0.98]'}
      `}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled }}
      accessibilityLabel={`${info.label} 공고 타입`}
    >
      {/* 선택 체크 표시 */}
      {isSelected && (
        <View className="absolute top-2 right-2">
          <CheckCircleIcon size={20} color="#3B82F6" />
        </View>
      )}

      {/* 아이콘 */}
      <Text className="text-2xl mb-1">{info.icon}</Text>

      {/* 라벨 */}
      <Text
        className={`
          text-base font-semibold
          ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}
        `}
      >
        {info.label}
      </Text>

      {/* 설명 */}
      <Text
        className={`
          text-xs mt-0.5
          ${isSelected ? 'text-blue-500 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}
        `}
      >
        {info.description}
      </Text>

      {/* 대회 타입 특별 안내 */}
      {type === 'tournament' && isSelected && (
        <View className="mt-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded">
          <Text className="text-[10px] text-amber-700 dark:text-amber-300">
            관리자 승인 후 게시
          </Text>
        </View>
      )}
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
      <View className="flex-row gap-3 mb-2">
        {/* 첫 번째 행: 지원, 고정 */}
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
      <View className="flex-row gap-3">
        {/* 두 번째 행: 대회, 긴급 */}
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

      {/* 긴급 공고 안내 */}
      {value === 'urgent' && (
        <View className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
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
