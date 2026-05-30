/**
 * UNIQN Mobile - My Inquiries Screen
 * 문의 내역 화면
 */

import { useCallback } from 'react';
import { View, RefreshControl, ActivityIndicator } from 'react-native';
import { PRIMARY_COLORS } from '@/constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { EmptyState } from '@/components/ui';
import { InquiryCard, INQUIRY_STATUS_STRIPE_TONE } from '@/components/support';
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
      <InquiryCard
        inquiry={item}
        onPress={() => handleInquiryPress(item)}
        stripeTone={INQUIRY_STATUS_STRIPE_TONE[item.status]}
        className="mx-4 mb-3"
      />
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
      <EmptyState
        title="아직 문의한 내역이 없어요"
        description="궁금한 점이 있으시면 언제든 문의해주세요. 영업일 기준 1~2일 내에 답변드립니다."
        actionLabel="1:1 문의하기"
        onAction={handleCreateInquiry}
      />
    ),
    [handleCreateInquiry]
  );

  if (isLoading && inquiries.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="문의 내역" fallbackHref="/(app)/support" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY_COLORS[300]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="문의 내역" fallbackHref="/(app)/support" />
      <AppFlashList
        data={inquiries}
        renderItem={renderItem}
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
