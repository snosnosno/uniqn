/**
 * UNIQN Mobile - 관리자 공지사항 관리 페이지
 *
 * @description 공지사항 목록 조회 및 관리
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useAllAnnouncements, useAnnouncementStats } from '@/hooks/useAnnouncement';
import { AnnouncementCard } from '@/components/admin/announcements';
import type { AnnouncementStatus, Announcement } from '@/types';

type FilterStatus = AnnouncementStatus | 'all';

const STATUS_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'draft', label: '초안' },
  { key: 'published', label: '발행됨' },
  { key: 'archived', label: '보관됨' },
];

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAllAnnouncements(
    statusFilter === 'all' ? undefined : { status: statusFilter }
  );

  const { data: stats } = useAnnouncementStats();

  // Flatten pages
  const announcements = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.announcements);
  }, [data]);

  // Navigate to create
  const handleCreate = useCallback(() => {
    router.push('/(admin)/announcements/create');
  }, [router]);

  // Navigate to detail
  const handlePress = useCallback(
    (announcement: Announcement) => {
      router.push(`/(admin)/announcements/${announcement.id}`);
    },
    [router]
  );

  // Load more
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Render item
  const renderItem = useCallback(
    ({ item }: { item: Announcement }) => (
      <View className="px-4 mb-3">
        <AnnouncementCard announcement={item} onPress={() => handlePress(item)} />
      </View>
    ),
    [handlePress]
  );

  // Get count for tab
  const getTabCount = (status: FilterStatus): number | undefined => {
    if (!stats) return undefined;
    switch (status) {
      case 'all':
        return stats.total;
      case 'draft':
        return stats.draft;
      case 'published':
        return stats.published;
      case 'archived':
        return stats.archived;
      default:
        return undefined;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '공지사항 관리',
          headerBackTitle: '뒤로',
          headerRight: () => (
            <Pressable onPress={handleCreate} className="mr-2">
              <Ionicons name="add-circle-outline" size={24} color="#2563eb" />
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        {/* Status Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {STATUS_TABS.map((tab) => {
            const count = getTabCount(tab.key);
            const isActive = statusFilter === tab.key;

            return (
              <Pressable
                key={tab.key}
                onPress={() => setStatusFilter(tab.key)}
                className={`px-4 py-3 mr-2 border-b-2 ${
                  isActive
                    ? 'border-blue-600'
                    : 'border-transparent'
                }`}
              >
                <View className="flex-row items-center">
                  <Text
                    className={`text-sm font-medium ${
                      isActive
                        ? 'text-blue-600'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {tab.label}
                  </Text>
                  {count !== undefined && (
                    <View
                      className={`ml-2 px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          isActive
                            ? 'text-blue-600'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Content */}
        {isLoading && !data ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
            <Text className="text-gray-500 dark:text-gray-400 mt-4">
              공지사항을 불러오는 중...
            </Text>
          </View>
        ) : announcements.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="document-text-outline" size={64} color="#9ca3af" />
            <Text className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-4">
              공지사항이 없습니다
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
              새 공지사항을 작성해보세요
            </Text>
            <Pressable
              onPress={handleCreate}
              className="mt-6 bg-blue-600 px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-medium">공지사항 작성</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1">
            <FlashList
              data={announcements}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator size="small" />
                  </View>
                ) : null
              }
            />
          </View>
        )}
      </View>
    </>
  );
}
