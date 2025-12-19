/**
 * UNIQN Mobile - 구인공고 목록 컴포넌트
 *
 * @description 무한스크롤 지원 공고 목록
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { View, RefreshControl, ActivityIndicator, FlatList } from 'react-native';
import { JobCard } from './JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { JobPostingCard } from '@/types';

// ============================================================================
// Types
// ============================================================================

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
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function JobCardSkeleton() {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-100 dark:border-gray-700">
      <Skeleton className="h-5 w-3/4 mb-3" />
      <View className="flex-row gap-2 mb-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </View>
      <Skeleton className="h-4 w-1/2 mb-2" />
      <View className="flex-row justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-28" />
      </View>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

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
}: JobListProps) {
  // Hooks must be called before any conditional returns
  const renderItem = useCallback(
    ({ item }: { item: JobPostingCard }) => (
      <JobCard job={item} onPress={onJobPress} />
    ),
    [onJobPress]
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingMore) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isFetchingMore]);

  const handleEndReached = useCallback(() => {
    if (!isFetchingMore && hasMore) {
      onLoadMore();
    }
  }, [isFetchingMore, hasMore, onLoadMore]);

  const keyExtractor = useCallback((item: JobPostingCard) => item.id, []);

  // 초기 로딩
  if (isLoading && jobs.length === 0) {
    return (
      <View className="flex-1 p-4">
        {[1, 2, 3].map((i) => (
          <JobCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  // 빈 상태
  if (!isLoading && jobs.length === 0) {
    return (
      <EmptyState
        title="공고 없음"
        description={emptyMessage}
        icon="📋"
      />
    );
  }

  return (
    <FlatList
      data={jobs}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#6366f1"
        />
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={
        <EmptyState
          title="공고 없음"
          description={emptyMessage}
          icon="📋"
        />
      }
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

export default JobList;
