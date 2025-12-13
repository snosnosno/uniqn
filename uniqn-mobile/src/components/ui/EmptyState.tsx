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

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
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
  const getDefaultIcon = () => {
    switch (variant) {
      case 'search':
        return <SearchIcon size={48} color="#9CA3AF" />;
      case 'error':
        return <DocumentIcon size={48} color="#EF4444" />;
      default:
        return <DocumentIcon size={48} color="#9CA3AF" />;
    }
  };

  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="mb-4">{icon || getDefaultIcon()}</View>

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
