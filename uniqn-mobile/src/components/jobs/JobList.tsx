/**
 * UNIQN Mobile - 구인공고 목록 컴포넌트
 *
 * @description FlashList 기반 무한스크롤 공고 목록
 * @version 1.1.0
 */

import React, { useCallback } from 'react';
import { View, RefreshControl, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { JobCard } from './JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonJobCard } from '@/components/ui/Skeleton';
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

  // 초기 로딩 - 표준화된 SkeletonJobCard 사용
  if (isLoading && jobs.length === 0) {
    return (
      <View className="flex-1 p-4">
        {[1, 2, 3].map((i) => (
          <SkeletonJobCard key={i} />
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
    <FlashList
      data={jobs}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
      estimatedItemSize={160}
      contentContainerStyle={{ padding: 16 }}
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
    />
  );
}

export default JobList;
