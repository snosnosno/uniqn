import React from 'react';
import { Text, View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton, SkeletonJobCard } from '@/components/ui/Skeleton';

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

function PostingDetailSkeleton() {
  return (
    <View
      className="flex-1 p-4"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="로딩 중"
    >
      {/* 히어로 타이틀 + 서브라인 */}
      <Skeleton width="75%" height={24} accessible={false} className="mb-2" />
      <Skeleton width="40%" height={16} accessible={false} className="mb-5" />
      {/* 급여 라인 */}
      <Skeleton width="55%" height={20} accessible={false} className="mb-6" />
      {/* 섹션 행 4개 (라벨 + 본문 2줄) */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} className="mb-5">
          <Skeleton width="30%" height={14} accessible={false} className="mb-2" />
          <Skeleton width="100%" height={14} accessible={false} className="mb-2" />
          <Skeleton width="70%" height={14} accessible={false} />
        </View>
      ))}
    </View>
  );
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

    return <PostingDetailSkeleton />;
  }

  if (mode === 'error') {
    return <ErrorState error={error} title={title} message={message} onRetry={onRetry} />;
  }

  if (mode === 'partial') {
    return (
      <View className="mx-4 mb-3 rounded-md bg-warning-50 px-4 py-3 dark:bg-warning-100">
        <Text className="text-sm font-sans-medium text-warning-700 dark:text-warning-500">
          {title || '일부 정보만 불러왔습니다'}
        </Text>
        {message ? (
          <Text className="mt-1 text-xs text-warning-600 dark:text-warning-500 font-sans">
            {message}
          </Text>
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
