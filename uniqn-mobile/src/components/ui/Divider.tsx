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
        <View className="flex-1 h-px bg-divider" />
        <Text className="mx-4 text-sm text-content-secondary font-sans">{label}</Text>
        <View className="flex-1 h-px bg-divider" />
      </View>
    );
  }

  return <View className={`h-px bg-divider ${spacingStyles[spacing]}`} />;
}

export default Divider;
