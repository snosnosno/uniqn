/**
 * UNIQN Mobile - Notifications Screen
 * 알림 목록 화면
 *
 * @description 개선된 알림 화면
 * - NotificationList 컴포넌트 활용 (FlashList 기반)
 * - 무한 스크롤 지원
 * - 삭제 기능 지원
 * - 카테고리 필터 지원
 * - 알림 그룹핑 지원
 */

import { useState, useCallback } from 'react';
import { Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import {
  NotificationList,
  NotificationCategoryTabs,
  type NotificationCategoryFilter,
} from '@/components/notifications';
import {
  useGroupedNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '@/hooks/useNotifications';
import { useNotificationStore } from '@/stores/notificationStore';
import type {
  NotificationData,
  NotificationCategory,
  GroupedNotificationData,
} from '@/types/notification';

export default function NotificationsScreen() {
  // 카테고리 필터 상태
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategoryFilter>('all');

  // 그룹화된 알림 목록 훅 (카운터는 실시간 구독이 동기화) (무한스크롤 + 그룹핑 지원)
  const {
    groupedNotifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
    markGroupAsRead,
  } = useGroupedNotifications({
    categoryFilter: selectedCategory === 'all' ? 'all' : selectedCategory,
    groupingOptions: {
      enabled: true,
      minGroupSize: 2,
      timeWindowMs: 24 * 60 * 60 * 1000, // 24시간
    },
  });

  // 읽음 처리 훅
  const { markAsRead, isMarking } = useMarkAsRead();
  const { markAllAsRead } = useMarkAllAsRead();

  // 삭제 훅
  const { deleteNotification } = useDeleteNotification();

  // 스토어에서 카테고리별 읽지 않은 수
  const unreadByCategory = useNotificationStore((state) => state.unreadByCategory);

  // 리프레시 핸들러
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // 무한 스크롤 핸들러
  const handleLoadMore = useCallback(async () => {
    await fetchNextPage();
  }, [fetchNextPage]);

  // 알림 클릭 핸들러
  const handleNotificationPress = useCallback(
    (notification: NotificationData) => {
      if (!notification.isRead && !isMarking) {
        markAsRead(notification.id);
      }
      // NotificationItem이 딥링크 네비게이션 자동 처리
    },
    [markAsRead, isMarking]
  );

  // 그룹 클릭 핸들러 (그룹 내 모든 알림 읽음 처리)
  const handleGroupPress = useCallback(
    (group: GroupedNotificationData) => {
      if (group.unreadCount > 0) {
        markGroupAsRead(group);
      }
    },
    [markGroupAsRead]
  );

  // 삭제 핸들러
  const handleDelete = useCallback(
    (notificationId: string) => {
      deleteNotification(notificationId);
    },
    [deleteNotification]
  );

  // 모두 읽음 핸들러
  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // 카테고리 선택 핸들러
  const handleCategoryChange = useCallback((category: NotificationCategoryFilter) => {
    setSelectedCategory(category);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      {/* 헤더 */}
      <StackHeader
        title="알림"
        titleSuffix={
          unreadCount > 0 ? <Text className="text-primary-600"> ({unreadCount})</Text> : null
        }
        fallbackHref="/(app)/(tabs)"
        rightAction={
          unreadCount > 0 ? (
            <Pressable onPress={handleMarkAllAsRead} className="px-3 py-1">
              <Text className="text-sm text-primary-600 dark:text-primary-400">모두 읽음</Text>
            </Pressable>
          ) : null
        }
      />

      {/* 카테고리 필터 탭 */}
      <NotificationCategoryTabs
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryChange}
        unreadByCategory={unreadByCategory as Partial<Record<NotificationCategory, number>>}
      />

      {/* 알림 목록 (무한스크롤 + 그룹핑 + 삭제) */}
      <NotificationList
        notifications={groupedNotifications}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={error}
        hasMore={hasMore}
        isFetchingNextPage={isFetchingNextPage}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        onNotificationPress={handleNotificationPress}
        onGroupPress={handleGroupPress}
        onDeleteNotification={handleDelete}
        onMarkAllAsRead={handleMarkAllAsRead}
        showDelete={true}
        showHeader={false}
      />
    </SafeAreaView>
  );
}
