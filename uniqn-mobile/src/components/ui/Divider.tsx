/**
 * UNIQN Mobile - Divider 컴포넌트
 *
 * @description 콘텐츠 구분선
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';

interface DividerProps {
  label?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

const spacingStyles = {
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-6',
};

export function Divider({ label, spacing = 'md' }: DividerProps) {
  if (label) {
    return (
      <View className={`flex-row items-center ${spacingStyles[spacing]}`}>
        <View className="flex-1 h-px bg-gray-200 dark:bg-surface" />
        <Text className="mx-4 text-sm text-gray-500 dark:text-gray-400">{label}</Text>
        <View className="flex-1 h-px bg-gray-200 dark:bg-surface" />
      </View>
    );
  }

  return (
    <View
      className={`h-px bg-gray-200 dark:bg-surface ${spacingStyles[spacing]}`}
    />
  );
}

export default Divider;
