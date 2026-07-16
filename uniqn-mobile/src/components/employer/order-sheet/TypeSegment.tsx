import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { POSTING_TYPE_INFO } from '@/types/jobPostingForm';
import type { PostingType } from '@/types/jobPosting';

const TYPES: PostingType[] = ['regular', 'urgent', 'fixed', 'tournament'];

export function TypeSegment({
  value,
  onChange,
  disabled = false,
}: {
  value: 'regular' | 'urgent' | 'tournament' | 'fixed';
  onChange: (t: PostingType) => void;
  /** 편집 모드 잠금(S3) — 레거시 PostingTypeSelector disabled={isEdit} 계약 계승 */
  disabled?: boolean;
}) {
  return (
    <View className="flex-row gap-1 p-1 rounded-xl bg-surface-card border border-secondary-200 dark:border-surface-overlay">
      {TYPES.map((t) => {
        const selected = t === value;
        return (
          <Pressable
            key={t}
            disabled={disabled}
            onPress={() => onChange(t)}
            className={`flex-1 items-center justify-center py-2 min-h-[44px] rounded-lg ${
              selected ? 'bg-primary-100 border border-primary-500' : 'active:opacity-80'
            } ${disabled && !selected ? 'opacity-40' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`공고 유형 ${POSTING_TYPE_INFO[t].label}`}
            testID={`order-sheet-type-${t}`}
          >
            <Text
              className={`text-sm font-sans-medium ${
                selected
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-secondary-700 dark:text-secondary-300'
              }`}
            >
              {POSTING_TYPE_INFO[t].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
