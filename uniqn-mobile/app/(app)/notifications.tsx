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
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import {
  NotificationList,
  NotificationCategoryTabs,
  type NotificationCategoryFilter,
} from '@/components/notifications';
import { SettingsIcon } from '@/components/icons';
import {
  useGroupedNotifications,
  useMarkAllAsRead,
  useDeleteNotification,
  useDeleteAllNotifications,
} from '@/hooks/useNotifications';
import { useNotificationNavigation } from '@/hooks/useDeepLink';
import { useNotificationStore } from '@/stores/notificationStore';
import { confirmAction } from '@/utils/confirmAction';
import { triggerHaptic } from '@/utils/haptics';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { NotificationData, NotificationCategory } from '@/types/notification';

export default function NotificationsScreen() {
  // 카테고리 필터 상태
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategoryFilter>('all');

  // 그룹화된 알림 목록 훅 (카운터는 실시간 구독이 동기화) (무한스크롤 + 그룹핑 지원)
  const {
    groupedNotifications,
    rawNotifications,
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

  const { markAllAsRead } = useMarkAllAsRead();
  const { handleNotificationPress: navigateNotification } = useNotificationNavigation();

  // 삭제 훅
  const { deleteNotification } = useDeleteNotification();

  // 전체 삭제 훅
  const { deleteAllNotifications, isDeletingAll } = useDeleteAllNotifications();

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
      void navigateNotification(notification);
    },
    [navigateNotification]
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

  // 모두 삭제 핸들러 — 파괴적 액션이므로 확인 후 실행
  const handleDeleteAll = useCallback(() => {
    confirmAction({
      title: '알림 모두 삭제',
      message: '모든 알림이 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.',
      confirmText: '모두 삭제',
      destructive: true,
      onConfirm: () => {
        void triggerHaptic('warning');
        deleteAllNotifications();
      },
    });
  }, [deleteAllNotifications]);

  // 알림 설정 진입 핸들러
  const handleOpenSettings = useCallback(() => {
    router.push('/(app)/settings/notifications');
  }, []);

  // 카테고리 선택 핸들러
  const handleCategoryChange = useCallback((category: NotificationCategoryFilter) => {
    setSelectedCategory(category);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      {/* 헤더 */}
      <StackHeader
        title="알림"
        titleSuffix={
          unreadCount > 0 ? (
            <Text className="text-lg font-display-semibold text-primary-600 dark:text-primary-400">
              ({unreadCount})
            </Text>
          ) : null
        }
        fallbackHref="/(app)/(tabs)/home-jobs"
        rightAction={
          <View className="flex-row items-center">
            {unreadCount > 0 && (
              <Pressable
                onPress={handleMarkAllAsRead}
                className="px-2 py-1"
                accessible
                role="button"
                accessibilityRole="button"
                accessibilityLabel="모두 읽음"
                testID="notifications-mark-all-read"
              >
                <Text className="text-sm text-primary-600 dark:text-primary-400 font-sans">
                  모두 읽음
                </Text>
              </Pressable>
            )}
            {/* 카테고리 필터로 빈 탭이어도 노출 유지 — 원본 목록 기준 */}
            {rawNotifications.length > 0 && (
              <Pressable
                onPress={handleDeleteAll}
                disabled={isDeletingAll}
                className={isDeletingAll ? 'px-2 py-1 opacity-40' : 'px-2 py-1'}
                accessible
                role="button"
                accessibilityRole="button"
                accessibilityLabel="알림 모두 삭제"
                testID="notifications-delete-all"
              >
                <Text className="text-sm text-error-600 dark:text-error-400 font-sans">
                  모두 삭제
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleOpenSettings}
              className="px-2 py-1"
              hitSlop={6}
              accessible
              role="button"
              accessibilityRole="button"
              accessibilityLabel="알림 설정"
              testID="notifications-open-settings"
            >
              <SettingsIcon size={20} color={SECONDARY_PALETTE[500]} />
            </Pressable>
          </View>
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
        onMarkGroupAsRead={markGroupAsRead}
        onDeleteNotification={handleDelete}
        onMarkAllAsRead={handleMarkAllAsRead}
        showDelete={true}
        showHeader={false}
      />
    </SafeAreaView>
  );
}
