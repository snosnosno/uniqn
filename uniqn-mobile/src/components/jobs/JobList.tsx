import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LIST_CONTAINER_STYLES } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import type { JobPostingCard } from '@/types';
import { JobCard } from './JobCard';
import { PostingSurfaceState } from './shared';

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
}: JobListProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const renderItem = useCallback(
    ({ item }: { item: JobPostingCard }) => <JobCard job={item} onPress={onJobPress} />,
    [onJobPress]
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
    return <PostingSurfaceState mode="loading" scope="list" />;
  }

  if (error && jobs.length === 0) {
    return (
      <PostingSurfaceState
        mode="error"
        scope="list"
        title="공고 목록을 불러올 수 없습니다"
        message={error.message}
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

      <FlashList
        data={jobs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
        estimatedItemSize={160}
        contentContainerStyle={LIST_CONTAINER_STYLES.padding16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          // impeccable v2 §24 — 골드 tint(브랜드 일관성)
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? '#D4AF37' : '#8A7228'}
            colors={['#D4AF37']}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}

export default JobList;
