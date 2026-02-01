/**
 * UNIQN Mobile - Admin Inquiries Screen
 * 관리자 문의 관리 화면
 */

import { useState, useCallback } from 'react';
import { View, Text, RefreshControl, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { EmptyState } from '@/components/ui';
import { InquiryCard } from '@/components/support';
import { useAllInquiries, useUnansweredCount } from '@/hooks/useInquiry';
import type { Inquiry, InquiryStatus, InquiryFilters } from '@/types';

type StatusFilter = InquiryStatus | 'all';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'open', label: '접수됨' },
  { key: 'in_progress', label: '처리중' },
  { key: 'closed', label: '완료' },
];

export default function AdminInquiriesScreen() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const filters: InquiryFilters = statusFilter === 'all' ? {} : { status: statusFilter };

  const { inquiries, isLoading, hasMore, fetchNextPage, refetch } = useAllInquiries({
    filters,
  });
  const { data: unansweredCount } = useUnansweredCount();

  const handleInquiryPress = useCallback((inquiry: Inquiry) => {
    router.push(`/(admin)/inquiries/${inquiry.id}`);
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasMore) {
      fetchNextPage();
    }
  }, [hasMore, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Inquiry }) => (
      <InquiryCard
        inquiry={item}
        onPress={() => handleInquiryPress(item)}
        showAuthor
        className="mx-4 mb-3"
      />
    ),
    [handleInquiryPress]
  );

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color="#A855F7" />
      </View>
    );
  }, [hasMore]);

  const renderEmpty = useCallback(
    () => (
      <View className="flex-1 items-center justify-center px-4 py-12">
        <EmptyState
          icon="📭"
          title="문의가 없습니다"
          description={
            statusFilter === 'all'
              ? '아직 접수된 문의가 없습니다'
              : `${STATUS_FILTERS.find((f) => f.key === statusFilter)?.label} 상태의 문의가 없습니다`
          }
        />
      </View>
    ),
    [statusFilter]
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      {/* 통계 */}
      <View className="border-b border-gray-200 bg-white px-4 py-3 dark:border-surface-overlay dark:bg-surface">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-500 dark:text-gray-400">미답변 문의</Text>
          <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
            {unansweredCount ?? 0}건
          </Text>
        </View>
      </View>

      {/* 필터 탭 */}
      <View className="border-b border-gray-200 bg-white dark:border-surface-overlay dark:bg-surface">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4 py-2"
        >
          {STATUS_FILTERS.map((filter) => {
            const isSelected = statusFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setStatusFilter(filter.key)}
                className={`rounded-full px-4 py-2 ${
                  isSelected ? 'bg-primary-500 dark:bg-primary-600' : 'bg-gray-100 dark:bg-surface'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 문의 목록 */}
      {isLoading && inquiries.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#A855F7" />
        </View>
      ) : (
        <FlashList
          data={inquiries}
          renderItem={renderItem}
          // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
          estimatedItemSize={120}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#A855F7" />
          }
        />
      )}
    </SafeAreaView>
  );
}
