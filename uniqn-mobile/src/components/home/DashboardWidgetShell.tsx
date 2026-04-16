import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, SkeletonCard } from '@/components/ui';
import { ChevronRightIcon } from '@/components/icons';

interface EmptyStateConfig {
  message: string;
  cta?: {
    label: string;
    onPress: () => void;
  };
}

export interface DashboardWidgetShellProps {
  title: string;
  children: React.ReactNode;
  onSeeMore?: () => void;
  seeMoreLabel?: string;
  isLoading?: boolean;
  emptyState?: EmptyStateConfig;
  error?: Error | null;
  onRetry?: () => void;
  partial?: boolean;
}

export function DashboardWidgetShell({
  title,
  children,
  onSeeMore,
  seeMoreLabel = '상세 보기',
  isLoading = false,
  emptyState,
  error,
  onRetry,
  partial = false,
}: DashboardWidgetShellProps) {
  if (isLoading) {
    return <SkeletonCard />;
  }

  const hasError = error !== null && error !== undefined && !partial;

  if (hasError) {
    return (
      <View className="bg-surface-overlay border-l-2 border-error/40 rounded-md p-4 dark:bg-surface-overlay dark:border-error/40">
        <Text className="text-sm font-medium text-error dark:text-error mb-2">
          불러오지 못했습니다
        </Text>
        {onRetry && (
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text className="text-sm font-medium text-primary-300 dark:text-primary-300">
              다시 시도
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  const isEmpty = children === null || children === undefined;

  return (
    <Card variant="elevated" padding="md">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-semibold text-secondary-900 dark:text-secondary-50">
          {title}
        </Text>
      </View>

      <View className="mb-3">
        {isEmpty && emptyState ? (
          <View>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">
              {emptyState.message}
            </Text>
            {emptyState.cta && (
              <Pressable
                onPress={emptyState.cta.onPress}
                accessibilityRole="button"
                className="mt-2"
              >
                <Text className="text-sm font-medium text-primary-300 dark:text-primary-300">
                  {emptyState.cta.label}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          children
        )}
      </View>

      {onSeeMore && (
        <Pressable
          onPress={onSeeMore}
          accessibilityRole="button"
          className="flex-row items-center justify-end"
        >
          <Text className="text-sm font-medium text-primary-300 dark:text-primary-300 mr-1">
            {seeMoreLabel}
          </Text>
          <ChevronRightIcon size={12} color="#C9A84C" />
        </Pressable>
      )}
    </Card>
  );
}

export default DashboardWidgetShell;
