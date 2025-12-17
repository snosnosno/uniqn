/**
 * UNIQN Mobile - Loading 컴포넌트
 *
 * @description 로딩 상태 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

export interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export function Loading({
  size = 'large',
  color = '#3b82f6',
  message,
  fullScreen = false,
}: LoadingProps) {
  const content = (
    <View className="items-center justify-center">
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text className="mt-3 text-sm text-gray-600 dark:text-gray-400">{message}</Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View className="absolute inset-0 items-center justify-center bg-white/80 dark:bg-gray-900/80">
        {content}
      </View>
    );
  }

  return <View className="flex-1 items-center justify-center py-8">{content}</View>;
}

export default Loading;
