/**
 * UNIQN Mobile - Loading 컴포넌트
 *
 * @description 로딩 상태 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Theme Constants
// ============================================================================

const LOADING_COLORS = {
  light: '#A855F7', // primary-500
  dark: '#C084FC',  // primary-400 (다크모드에서 더 밝게)
} as const;

export interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export function Loading({
  size = 'large',
  color,
  message,
  fullScreen = false,
}: LoadingProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const resolvedColor = color ?? (isDarkMode ? LOADING_COLORS.dark : LOADING_COLORS.light);

  const content = (
    <View className="items-center justify-center">
      <ActivityIndicator size={size} color={resolvedColor} />
      {message && (
        <Text className="mt-3 text-sm text-gray-600 dark:text-gray-400">{message}</Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View className="absolute inset-0 items-center justify-center bg-white/80 dark:bg-surface-dark/80">
        {content}
      </View>
    );
  }

  return <View className="flex-1 items-center justify-center py-8">{content}</View>;
}

export default Loading;
