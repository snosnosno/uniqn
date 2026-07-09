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
  /**
   * Visual variant.
   * - 'card' (default): elevated card with title header — existing behavior.
   * - 'hero': borderless hero block with gold mini-caps title (Home V2 top slot).
   * - 'section': section header with divider and optional right-side action.
   */
  variant?: 'card' | 'hero' | 'section';
  /**
   * Right-side action rendered in the section header (e.g. "전체 보기" link).
   * Only rendered for variant='section'.
   */
  action?: React.ReactNode;
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
  variant = 'card',
  action,
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

  const emptyOrChildren =
    isEmpty && emptyState ? (
      <View>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">{emptyState.message}</Text>
        {emptyState.cta && (
          <Pressable onPress={emptyState.cta.onPress} accessibilityRole="button" className="mt-2">
            <Text className="text-sm font-medium text-primary-300 dark:text-primary-300">
              {emptyState.cta.label}
            </Text>
          </Pressable>
        )}
      </View>
    ) : (
      children
    );

  if (variant === 'hero') {
    return (
      <View className="px-4 py-4 border-b border-divider dark:border-divider">
        <Text className="text-micro uppercase tracking-wider text-primary-500 font-sans-bold mb-2">
          {title}
        </Text>
        {emptyOrChildren}
      </View>
    );
  }

  if (variant === 'section') {
    return (
      <View className="px-4 py-3">
        <View className="flex-row items-center justify-between pb-2 border-b border-divider dark:border-divider mb-2">
          <Text className="text-micro uppercase tracking-wider text-content-secondary font-sans-bold">
            {title}
          </Text>
          {action}
        </View>
        {emptyOrChildren}
      </View>
    );
  }

  return (
    <Card variant="elevated" padding="md">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-semibold text-secondary-900 dark:text-secondary-50">
          {title}
        </Text>
      </View>

      <View className="mb-3">{emptyOrChildren}</View>

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
