/**
 * UNIQN Mobile - 리뷰 목록 컴포넌트
 *
 * @description FlashList 기반 리뷰 목록
 */

import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import ReviewCard from './ReviewCard';
import type { Review } from '@/types/review';

interface ReviewListProps {
  reviews: Review[];
  showReviewer?: boolean;
  emptyMessage?: string;
  ListHeaderComponent?: React.ReactElement;
}

export default function ReviewList({
  reviews,
  showReviewer = true,
  emptyMessage = '아직 받은 평가가 없습니다',
  ListHeaderComponent,
}: ReviewListProps) {
  const renderItem = useCallback(
    ({ item }: { item: Review }) => (
      <ReviewCard review={item} showReviewer={showReviewer} />
    ),
    [showReviewer]
  );

  const keyExtractor = useCallback(
    (item: Review) => `${item.workLogId}_${item.reviewerType}`,
    []
  );

  const ItemSeparator = useCallback(
    () => <View className="h-3" />,
    []
  );

  if (reviews.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={reviews}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
      estimatedItemSize={120}
      ItemSeparatorComponent={ItemSeparator}
      ListHeaderComponent={ListHeaderComponent}
      contentContainerClassName="px-4 py-4"
    />
  );
}
