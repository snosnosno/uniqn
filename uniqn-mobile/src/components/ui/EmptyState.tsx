/**
 * UNIQN Mobile - EmptyState 컴포넌트
 *
 * @description 빈 상태나 결과 없음 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';
import { SearchIcon, DocumentIcon } from '@/components/icons';
import { Button } from './Button';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Theme Constants
// ============================================================================

const ICON_COLORS = {
  default: { light: '#6B7280', dark: '#9CA3AF' }, // gray-500 / gray-400
  error: '#EF4444', // error-500 (동일)
} as const;

export interface EmptyStateProps {
  title?: string;
  description?: string;
  /** 아이콘 (이모지 문자열 또는 React 컴포넌트) */
  icon?: React.ReactNode | string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'search' | 'content' | 'error';
}

export function EmptyState({
  title = '데이터가 없습니다',
  description,
  icon,
  actionLabel,
  onAction,
  variant = 'content',
}: EmptyStateProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const defaultIconColor = isDarkMode ? ICON_COLORS.default.dark : ICON_COLORS.default.light;

  const getDefaultIcon = () => {
    switch (variant) {
      case 'search':
        return <SearchIcon size={48} color={defaultIconColor} />;
      case 'error':
        return <DocumentIcon size={48} color={ICON_COLORS.error} />;
      default:
        return <DocumentIcon size={48} color={defaultIconColor} />;
    }
  };

  // icon이 문자열(이모지)인 경우 Text로 감싸기
  const renderIcon = () => {
    if (!icon) return getDefaultIcon();
    if (typeof icon === 'string') {
      return <Text className="text-5xl">{icon}</Text>;
    }
    return icon;
  };

  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="mb-4">{renderIcon()}</View>

      <Text className="mb-2 text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </Text>

      {description && (
        <Text className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {description}
        </Text>
      )}

      {actionLabel && onAction && (
        <Button variant="outline" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

export default EmptyState;
