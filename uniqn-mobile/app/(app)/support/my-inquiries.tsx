/**
 * UNIQN Mobile - My Inquiries Screen
 * 문의 내역 화면
 */

import { useCallback } from 'react';
import { View, RefreshControl, ActivityIndicator } from 'react-native';
import { PRIMARY_COLORS } from '@/constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { EmptyState, Button } from '@/components/ui';
import { InquiryCard } from '@/components/support';
import { StackHeader } from '@/components/headers';
import { useMyInquiries } from '@/hooks/useInquiry';
import type { Inquiry } from '@/types';

export default function MyInquiriesScreen() {
  const {
    inquiries,
    isLoading,
    isRefreshing,
    isFetchingNextPage,
    hasMore,
    fetchNextPage,
    refetch,
  } = useMyInquiries();

  const handleInquiryPress = useCallback((inquiry: Inquiry) => {
    router.push(`/(app)/support/inquiry/${inquiry.id}`);
  }, []);

  const handleCreateInquiry = useCallback(() => {
    router.push('/(app)/support/create-inquiry');
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasMore) {
      fetchNextPage();
    }
  }, [hasMore, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Inquiry }) => (
      <InquiryCard inquiry={item} onPress={() => handleInquiryPress(item)} className="mx-4 mb-3" />
    ),
    [handleInquiryPress]
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="items-center py-4">
        <ActivityIndicator size="small" color={PRIMARY_COLORS[300]} />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(
    () => (
      <View className="flex-1 items-center justify-center px-4 py-12">
        <EmptyState title="문의 내역이 없습니다" description="아직 문의하신 내역이 없습니다" />
        <Button onPress={handleCreateInquiry} className="mt-4">
          1:1 문의하기
        </Button>
      </View>
    ),
    [handleCreateInquiry]
  );

  if (isLoading && inquiries.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="문의 내역" fallbackHref="/(app)/support" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY_COLORS[300]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
      <StackHeader title="문의 내역" fallbackHref="/(app)/support" />
      <FlashList
        data={inquiries}
        renderItem={renderItem}
        // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
        estimatedItemSize={100}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={PRIMARY_COLORS[300]}
          />
        }
      />
    </SafeAreaView>
  );
}
