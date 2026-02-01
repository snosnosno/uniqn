/**
 * UNIQN Mobile - 공지사항 목록 페이지 (사용자용)
 *
 * @description 발행된 공지사항 목록을 표시하는 페이지
 */

import { View, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { NoticeCard } from '@/components/notices';
import { usePublishedAnnouncements } from '@/hooks/useAnnouncement';
import type { Announcement } from '@/types';

export default function NoticesPage() {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isRefetching } =
    usePublishedAnnouncements();

  // 모든 페이지의 공지사항을 평탄화
  const notices = data?.pages.flatMap((page) => page.announcements) ?? [];

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderItem = ({ item }: { item: Announcement }) => <NoticeCard notice={item} />;

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Ionicons name="megaphone-outline" size={64} color="#9CA3AF" />
        <Text className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-400">
          공지사항이 없습니다
        </Text>
        <Text className="mt-1 text-sm text-gray-500 dark:text-gray-500">
          새로운 공지사항이 등록되면 알려드릴게요
        </Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '공지사항',
          headerBackTitle: '뒤로',
        }}
      />

      <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlashList
            data={notices}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          />
        )}
      </View>
    </>
  );
}
