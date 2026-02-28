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
        className={`flex-1 py-3 rounded-xl items-center border ${
          value === 'male'
            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500'
            : 'bg-white dark:bg-surface border-gray-200 dark:border-gray-700'
        }`}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'male' }}
        accessibilityLabel="남성"
      >
        <Text
          className={`text-base font-medium ${
            value === 'male'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          남성
        </Text>
      </Pressable>
      <Pressable
        onPress={() => !disabled && onChange('female')}
        className={`flex-1 py-3 rounded-xl items-center border ${
          value === 'female'
            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500'
            : 'bg-white dark:bg-surface border-gray-200 dark:border-gray-700'
        }`}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'female' }}
        accessibilityLabel="여성"
      >
        <Text
          className={`text-base font-medium ${
            value === 'female'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          여성
        </Text>
      </Pressable>
    </View>
  );
}
