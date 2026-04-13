/**
 * UNIQN Mobile - Notification list component
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList, ListRenderItem } from '@shopify/flash-list';
import { BellSlashIcon } from '@/components/icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationItem, NotificationItemSkeleton } from './NotificationItem';
import { NotificationGroupItem } from './NotificationGroupItem';
import {
  type NotificationData,
  type NotificationListItem,
  type GroupedNotificationData,
  isGroupedNotification,
} from '@/types/notification';

export interface NotificationListProps {
  notifications: NotificationListItem[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: Error | null;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onNotificationPress?: (notification: NotificationData) => void;
  onGroupPress?: (group: GroupedNotificationData) => void;
  onDeleteNotification?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  showDelete?: boolean;
  showHeader?: boolean;
  ListEmptyComponent?: React.ReactElement;
  className?: string;
}

const SKELETON_COUNT = 5;

export const NotificationList = memo(function NotificationList({
  notifications,
  isLoading = false,
  isRefreshing = false,
  error,
  hasMore = false,
  isFetchingNextPage = false,
  onRefresh,
  onLoadMore,
  onNotificationPress,
  onGroupPress,
  onDeleteNotification,
  onMarkAllAsRead,
  showDelete = false,
  showHeader = true,
  ListEmptyComponent,
  className = '',
}: NotificationListProps) {
  const renderItem: ListRenderItem<NotificationListItem> = useCallback(
    ({ item }) => {
      if (isGroupedNotification(item)) {
        return (
          <NotificationGroupItem
            group={item}
            onGroupPress={onGroupPress}
            onNotificationPress={onNotificationPress}
            onDeleteNotification={onDeleteNotification}
            showDelete={showDelete}
          />
        );
      }

      return (
        <NotificationItem
          notification={item}
          onPress={onNotificationPress}
          onDelete={onDeleteNotification}
          showDelete={showDelete}
        />
      );
    },
    [onDeleteNotification, onGroupPress, onNotificationPress, showDelete]
  );

  const keyExtractor = useCallback(
    (item: NotificationListItem) => (isGroupedNotification(item) ? item.groupId : item.id),
    []
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isFetchingNextPage, onLoadMore]);

  const unreadCount = useMemo(
    () =>
      notifications.reduce((count, item) => {
        if (isGroupedNotification(item)) {
          return count + item.unreadCount;
        }

        return count + (item.isRead ? 0 : 1);
      }, 0),
    [notifications]
  );

  const showInlineError = !!error && notifications.length > 0;

  if (isLoading && notifications.length === 0) {
    return (
      <View className={`flex-1 bg-surface-page ${className}`}>
        {[...Array(SKELETON_COUNT)].map((_, index) => (
          <NotificationItemSkeleton key={`skeleton-${index}`} />
        ))}
      </View>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <View
        accessibilityRole="alert"
        className={`flex-1 items-center justify-center bg-surface-page p-4 ${className}`}
      >
        <Text className="text-center text-error-600 dark:text-error-400 font-sans">
          알림을 불러오지 못했습니다.
        </Text>
        {onRefresh ? (
          <Pressable onPress={onRefresh} className="mt-4 rounded-lg bg-primary-500 px-4 py-2">
            <Text className="font-sans-medium text-surface-dark">다시 시도</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const defaultEmptyComponent = (
    <EmptyState
      icon={<BellSlashIcon size={48} color={SECONDARY_PALETTE[400]} />}
      title="알림이 없습니다"
      description="새로운 알림이 오면 이곳에 표시됩니다."
    />
  );

  return (
    <View className={`flex-1 bg-surface-page ${className}`}>
      {showHeader && notifications.length > 0 && (
        <View className="flex-row items-center justify-between border-b border-secondary-100 bg-white px-4 py-2 dark:border-surface">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            {unreadCount > 0 ? `읽지 않음 ${unreadCount}개` : '모든 알림을 확인했습니다'}
          </Text>
          {unreadCount > 0 && onMarkAllAsRead ? (
            <Pressable onPress={onMarkAllAsRead} hitSlop={8} className="py-1">
              <Text className="font-sans-medium text-primary-600 dark:text-primary-400">
                모두 읽음
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {showInlineError ? (
        <View className="mx-4 mb-3 mt-4 rounded-md border border-amber-200 bg-warning-50 px-4 py-3 dark:border-amber-700 dark:bg-warning-900/20">
          <Text className="text-sm text-warning-800 dark:text-warning-200 font-sans">
            새 알림을 가져오지 못했어요. 보고 있던 목록은 그대로 유지했습니다.
          </Text>
          {onRefresh ? (
            <Pressable onPress={onRefresh} hitSlop={8} className="mt-2 self-start">
              <Text className="text-sm font-sans-medium text-warning-700 dark:text-warning-300">
                다시 시도
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <FlashList<NotificationListItem>
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
        estimatedItemSize={85}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#D4AF37" />
          ) : undefined
        }
        ListEmptyComponent={ListEmptyComponent || defaultEmptyComponent}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <NotificationItemSkeleton />
            </View>
          ) : null
        }
        contentContainerClassName="bg-white"
      />
    </View>
  );
});

export interface SimpleNotificationListProps {
  notifications: NotificationData[];
  maxItems?: number;
  onNotificationPress?: (notification: NotificationData) => void;
  onSeeAll?: () => void;
  emptyMessage?: string;
}

export function SimpleNotificationList({
  notifications,
  maxItems = 5,
  onNotificationPress,
  onSeeAll,
  emptyMessage = '새로운 알림이 없습니다',
}: SimpleNotificationListProps) {
  const displayNotifications = notifications.slice(0, maxItems);
  const hasMore = notifications.length > maxItems;

  if (displayNotifications.length === 0) {
    return (
      <View className="items-center py-8">
        <BellSlashIcon size={32} color={SECONDARY_PALETTE[200]} />
        <Text className="mt-2 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {displayNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onPress={onNotificationPress}
          animated={false}
        />
      ))}

      {(hasMore || onSeeAll) && (
        <Pressable
          onPress={onSeeAll}
          className="items-center border-t border-secondary-100 py-3 dark:border-surface"
        >
          <Text className="font-sans-medium text-primary-600 dark:text-primary-400">
            {hasMore ? `${notifications.length - maxItems}개 더 보기` : '전체 보기'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default NotificationList;
