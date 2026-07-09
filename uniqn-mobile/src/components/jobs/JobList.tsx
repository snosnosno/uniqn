import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { LIST_CONTAINER_STYLES } from '@/constants';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import type { JobPostingCard } from '@/types';
import { JobCard } from './JobCard';
import { PostingSurfaceState } from './shared';
import { ScreenSkeleton } from '@/components/ui';

interface JobListProps {
  jobs: JobPostingCard[];
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onJobPress: (jobId: string) => void;
  emptyMessage?: string;
  error?: Error | null;
  filledCounts?: Map<string, number>;
}

export function JobList({
  jobs,
  isLoading,
  isRefreshing,
  isFetchingMore,
  hasMore,
  onRefresh,
  onLoadMore,
  onJobPress,
  emptyMessage = '등록된 공고가 없습니다',
  error,
  filledCounts,
}: JobListProps) {
  const renderItem = useCallback(
    ({ item }: { item: JobPostingCard }) => (
      <JobCard job={item} onPress={onJobPress} filledCounts={filledCounts} />
    ),
    [onJobPress, filledCounts]
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingMore) {
      return null;
    }

    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isFetchingMore]);

  const handleEndReached = useCallback(() => {
    if (!isFetchingMore && hasMore) {
      onLoadMore();
    }
  }, [hasMore, isFetchingMore, onLoadMore]);

  if (isLoading && jobs.length === 0) {
    return <ScreenSkeleton type="jobsList" count={5} />;
  }

  if (error && jobs.length === 0) {
    return (
      <PostingSurfaceState
        mode="error"
        scope="list"
        title="공고 목록을 불러올 수 없습니다"
        error={error}
        onRetry={onRefresh}
      />
    );
  }

  if (!isLoading && jobs.length === 0) {
    return (
      <PostingSurfaceState mode="empty" scope="list" title="공고 없음" message={emptyMessage} />
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
      {error && jobs.length > 0 ? (
        <PostingSurfaceState
          mode="partial"
          scope="list"
          title="일부 정보만 표시 중입니다"
          message="최신 공고 상태를 모두 불러오지 못했습니다. 아래 목록은 계속 확인할 수 있습니다."
        />
      ) : null}

      <AppFlashList
        data={jobs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={160}
        contentContainerStyle={LIST_CONTAINER_STYLES.padding16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} {...PTR_REFRESH_PROPS} />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}
