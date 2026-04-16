/**
 * UNIQN Mobile - 관리자 공지사항 관리 페이지
 *
 * @description 공지사항 목록 조회 및 관리
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { StackHeader } from '@/components/headers';
import { AddCircleOutlineIcon, DocumentTextOutlineIcon } from '@/components/icons';
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

  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAllAnnouncements(statusFilter === 'all' ? undefined : { status: statusFilter });

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
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
      <StackHeader
        title="공지사항 관리"
        fallbackHref="/(admin)"
        rightAction={
          <Pressable onPress={handleCreate} accessibilityLabel="공지사항 작성" hitSlop={8}>
            <AddCircleOutlineIcon size={24} color="#B8962E" />
          </Pressable>
        }
      />

      <View className="flex-1 bg-surface-page">
        {/* Status Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-divider bg-white dark:bg-surface"
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
                  isActive ? 'border-primary-600' : 'border-transparent'
                }`}
              >
                <View className="flex-row items-center">
                  <Text
                    className={`text-sm font-sans-medium ${
                      isActive ? 'text-primary-600' : 'text-secondary-500 dark:text-secondary-400'
                    }`}
                  >
                    {tab.label}
                  </Text>
                  {count !== undefined && (
                    <View
                      className={`ml-2 px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-primary-100 dark:bg-primary-900/30'
                          : 'bg-secondary-100 dark:bg-surface'
                      }`}
                    >
                      <Text
                        className={`text-xs font-sans ${
                          isActive
                            ? 'text-primary-600'
                            : 'text-secondary-500 dark:text-secondary-400'
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
            <Text className="text-secondary-500 dark:text-secondary-400 mt-4 font-sans">
              공지사항을 불러오는 중...
            </Text>
          </View>
        ) : announcements.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <DocumentTextOutlineIcon size={64} color={SECONDARY_PALETTE[400]} />
            <Text className="text-lg font-sans-medium text-content-secondary mt-4">
              공지사항이 없습니다
            </Text>
            <Text className="text-secondary-500 dark:text-secondary-400 text-center mt-2 font-sans">
              새 공지사항을 작성해보세요
            </Text>
            <Pressable onPress={handleCreate} className="mt-6 bg-primary-600 px-6 py-3 rounded-lg">
              <Text className="text-surface-dark font-sans-medium">공지사항 작성</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1">
            <FlashList
              data={announcements}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
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
    </SafeAreaView>
  );
}
