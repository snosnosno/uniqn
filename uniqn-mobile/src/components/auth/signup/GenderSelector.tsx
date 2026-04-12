/**
 * 성별 선택 컴포넌트 (남성/여성 버튼)
 *
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface GenderSelectorProps {
  value?: 'male' | 'female';
  onChange: (value: 'male' | 'female') => void;
  disabled?: boolean;
}

export function GenderSelector({ value, onChange, disabled }: GenderSelectorProps) {
  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={() => !disabled && onChange('male')}
        className={`flex-1 py-3 rounded-md items-center border ${
          value === 'male'
            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500'
            : 'bg-white dark:bg-surface border-secondary-200 dark:border-secondary-700'
        }`}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'male' }}
        accessibilityLabel="남성"
      >
        <Text
          className={`text-base font-sans-medium ${
            value === 'male'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-secondary-500 dark:text-secondary-400'
          }`}
        >
          남성
        </Text>
      </Pressable>
      <Pressable
        onPress={() => !disabled && onChange('female')}
        className={`flex-1 py-3 rounded-md items-center border ${
          value === 'female'
            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500'
            : 'bg-white dark:bg-surface border-secondary-200 dark:border-secondary-700'
        }`}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'female' }}
        accessibilityLabel="여성"
      >
        <Text
          className={`text-base font-sans-medium ${
            value === 'female'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-secondary-500 dark:text-secondary-400'
          }`}
        >
          여성
        </Text>
      </Pressable>
    </View>
  );
}
