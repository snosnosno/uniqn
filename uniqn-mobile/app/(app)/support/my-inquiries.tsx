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
import { EmptyState, ErrorState } from '@/components/ui';
import { InquiryCard, INQUIRY_STATUS_STRIPE_TONE } from '@/components/support';
import { StackHeader } from '@/components/headers';
import { useMyInquiries } from '@/hooks/useInquiry';
import type { Inquiry } from '@/types';
import { useManualRefresh } from '@/hooks/useManualRefresh';

export default function MyInquiriesScreen() {
  const { inquiries, isLoading, isFetchingNextPage, hasMore, fetchNextPage, refetch, error } =
    useMyInquiries();

  // PTR 스피너는 사용자가 당겼을 때만 — 조회 상태를 그대로 물리면 화면에 들어올 때마다
  // 배경 재조회로 스피너가 뜬다(useManualRefresh 주석 참고).
  const { refreshing: pullRefreshing, onRefresh: onPullRefresh } = useManualRefresh(() =>
    refetch()
  );

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

  // 조회가 실패해도 목록은 빈 배열이라 "아직 문의한 내역이 없어요"가 뜬다 —
  // 답변을 기다리는 사용자에게 문의가 사라진 것처럼 보인다(감사 A4).
  // 이미 받아둔 항목이 있으면 목록을 유지하고 PTR 로 재시도하게 둔다.
  if (error && inquiries.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="문의 내역" fallbackHref="/(app)/support" />
        <ErrorState
          error={error}
          title="문의 내역을 불러오지 못했어요"
          onRetry={() => {
            void refetch();
          }}
          alwaysAllowRetry
        />
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
            refreshing={pullRefreshing}
            onRefresh={onPullRefresh}
            tintColor={PRIMARY_COLORS[300]}
          />
        }
      />
    </SafeAreaView>
  );
}
