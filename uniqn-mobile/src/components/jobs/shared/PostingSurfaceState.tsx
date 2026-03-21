import React from 'react';
import { Text, View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { SkeletonJobCard } from '@/components/ui/Skeleton';

type PostingSurfaceStateMode = 'loading' | 'empty' | 'error' | 'partial';

interface PostingSurfaceStateProps {
  mode: PostingSurfaceStateMode;
  scope: 'list' | 'detail';
  title?: string;
  message?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode | string;
}

export function PostingSurfaceState({
  mode,
  scope,
  title,
  message,
  error,
  onRetry,
  actionLabel,
  onAction,
  icon,
}: PostingSurfaceStateProps) {
  if (mode === 'loading') {
    if (scope === 'list') {
      return (
        <View className="flex-1 p-4">
          {[1, 2, 3].map((item) => (
            <SkeletonJobCard key={item} />
          ))}
        </View>
      );
    }

    return <Loading variant="layout" message={message} />;
  }

  if (mode === 'error') {
    return <ErrorState error={error} title={title} message={message} onRetry={onRetry} />;
  }

  if (mode === 'partial') {
    return (
      <View className="mx-4 mb-3 rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
        <Text className="text-sm font-medium text-amber-800 dark:text-amber-300">
          {title || '일부 정보만 불러왔습니다'}
        </Text>
        {message ? (
          <Text className="mt-1 text-xs text-amber-700 dark:text-amber-400">{message}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <EmptyState
      title={title}
      description={message}
      icon={icon}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

export default PostingSurfaceState;
