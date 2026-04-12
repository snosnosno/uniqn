import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CheckCircleIcon } from '@/components/icons';

import type { PostingType } from '@/types';
import { POSTING_TYPE_INFO } from '@/types/jobPostingForm';

interface PostingTypeSelectorProps {
  value: PostingType;
  onChange: (type: PostingType) => void;
  disabled?: boolean;
}

const AVAILABLE_POSTING_TYPES: PostingType[] = ['regular', 'fixed', 'tournament', 'urgent'];

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
        flex-1 rounded-md border p-3
        ${
          isSelected
            ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30'
            : 'border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface'
        }
        ${disabled ? 'opacity-50' : 'active:scale-[0.98]'}
      `}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled }}
      accessibilityLabel={`${info.label} 공고 타입`}
    >
      <View className="flex-row items-center">
        <Text className="mr-2 text-xl font-sans">{info.icon}</Text>
        <View className="flex-1">
          <Text
            className={`
              text-sm font-sans-semibold
              ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-900 dark:text-secondary-100'}
            `}
          >
            {info.label}
          </Text>
          <Text
            className={`
              text-xs font-sans
              ${isSelected ? 'text-primary-500 dark:text-primary-300' : 'text-secondary-500 dark:text-secondary-400'}
             font-sans`}
          >
            {info.description}
          </Text>
        </View>
        {isSelected && <CheckCircleIcon size={16} color="#D4AF37" />}
      </View>
    </Pressable>
  );
});

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
      <Text className="mb-2 text-sm font-sans-medium text-content-secondary">
        공고 타입<Text className="text-error-500 font-sans">*</Text>
      </Text>

      <View className="gap-2">
        <View className="flex-row gap-2">
          {AVAILABLE_POSTING_TYPES.map((type) => (
            <TypeCard
              key={type}
              type={type}
              isSelected={value === type}
              disabled={disabled}
              onPress={() => handlePress(type)}
            />
          ))}
        </View>
      </View>

      {value === 'tournament' && (
        <View className="mt-3 rounded-lg border border-amber-200 bg-warning-50 p-2.5 dark:border-amber-800 dark:bg-warning-900/20">
          <Text className="text-sm text-warning-700 dark:text-warning-300 font-sans">
            대회공고는 관리자 승인 후 게시됩니다.
          </Text>
        </View>
      )}

      {value === 'urgent' && (
        <View className="mt-3 rounded-lg border border-error-200 bg-error-50 p-2.5 dark:border-error-800 dark:bg-error-900/20">
          <Text className="text-sm text-error-700 dark:text-error-300 font-sans">
            긴급 공고는 오늘 기준 7일 이내 날짜만 선택할 수 있습니다.
          </Text>
        </View>
      )}

      {disabled && (
        <View className="mt-2 rounded bg-surface-card p-2 dark:bg-surface">
          <Text className="text-center text-xs text-secondary-500 dark:text-secondary-400 font-sans">
            공고 타입은 수정할 수 없습니다.
          </Text>
        </View>
      )}
    </View>
  );
});

export default PostingTypeSelector;
