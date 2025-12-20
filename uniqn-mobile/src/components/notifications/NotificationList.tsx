/**
 * UNIQN Mobile - NotificationList 컴포넌트
 *
 * @description 알림 목록을 표시하는 리스트 컴포넌트
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList, ListRenderItem } from '@shopify/flash-list';
import { BellSlashIcon } from '@/components/icons';
import { NotificationItem, NotificationItemSkeleton } from './NotificationItem';
import { NotificationData } from '@/types/notification';
import { EmptyState } from '@/components/ui/EmptyState';

export interface NotificationListProps {
  /** 알림 목록 */
  notifications: NotificationData[];
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 에러 */
  error?: Error | null;
  /** 추가 데이터 존재 여부 */
  hasMore?: boolean;
  /** 다음 페이지 로딩 중 여부 */
  isFetchingNextPage?: boolean;
  /** 새로고침 핸들러 */
  onRefresh?: () => void;
  /** 다음 페이지 로드 핸들러 */
  onLoadMore?: () => void;
  /** 알림 클릭 핸들러 */
  onNotificationPress?: (notification: NotificationData) => void;
  /** 알림 삭제 핸들러 */
  onDeleteNotification?: (notificationId: string) => void;
  /** 모두 읽음 처리 핸들러 */
  onMarkAllAsRead?: () => void;
  /** 삭제 버튼 표시 여부 */
  showDelete?: boolean;
  /** 헤더 표시 여부 (모두 읽음 버튼) */
  showHeader?: boolean;
  /** 빈 상태 커스텀 컴포넌트 */
  ListEmptyComponent?: React.ReactElement;
  /** 추가 스타일 */
  className?: string;
}

const SKELETON_COUNT = 5;

export const NotificationList = memo(function NotificationList({
  notifications,
  isLoading = false,
  error,
  hasMore = false,
  isFetchingNextPage = false,
  onRefresh,
  onLoadMore,
  onNotificationPress,
  onDeleteNotification,
  onMarkAllAsRead,
  showDelete = false,
  showHeader = true,
  ListEmptyComponent,
  className = '',
}: NotificationListProps) {
  // 알림 항목 렌더링
  const renderItem: ListRenderItem<NotificationData> = useCallback(
    ({ item }) => (
      <NotificationItem
        notification={item}
        onPress={onNotificationPress}
        onDelete={onDeleteNotification}
        showDelete={showDelete}
      />
    ),
    [onNotificationPress, onDeleteNotification, showDelete]
  );

  // 키 추출
  const keyExtractor = useCallback(
    (item: NotificationData) => item.id,
    []
  );

  // 더 로드
  const handleEndReached = useCallback(() => {
    if (hasMore && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isFetchingNextPage, onLoadMore]);

  // 읽지 않은 알림 수
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // 스켈레톤 렌더링
  if (isLoading && notifications.length === 0) {
    return (
      <View className={`flex-1 bg-gray-50 dark:bg-gray-900 ${className}`}>
        {[...Array(SKELETON_COUNT)].map((_, index) => (
          <NotificationItemSkeleton key={`skeleton-${index}`} />
        ))}
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View className={`flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center p-4 ${className}`}>
        <Text className="text-error-600 dark:text-error-400 text-center">
          알림을 불러오는데 실패했습니다.
        </Text>
        {onRefresh && (
          <Pressable
            onPress={onRefresh}
            className="mt-4 px-4 py-2 bg-primary-500 rounded-lg"
          >
            <Text className="text-white font-medium">다시 시도</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // 빈 상태
  const defaultEmptyComponent = (
    <EmptyState
      icon={<BellSlashIcon size={48} color="#9ca3af" />}
      title="알림이 없습니다"
      description="새로운 알림이 오면 여기에 표시됩니다"
    />
  );

  return (
    <View className={`flex-1 bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* 헤더 (모두 읽음 버튼) */}
      {showHeader && notifications.length > 0 && (
        <View className="px-4 py-2 flex-row justify-between items-center border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {unreadCount > 0
              ? `읽지 않음 ${unreadCount}개`
              : '모든 알림을 확인했습니다'}
          </Text>
          {unreadCount > 0 && onMarkAllAsRead && (
            <Pressable
              onPress={onMarkAllAsRead}
              hitSlop={8}
              className="py-1"
            >
              <Text className="text-primary-600 dark:text-primary-400 font-medium">
                모두 읽음
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 알림 리스트 */}
      <FlashList<NotificationData>
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
        estimatedItemSize={85}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isLoading && notifications.length > 0}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
            />
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
        contentContainerClassName="bg-white dark:bg-gray-900"
      />
    </View>
  );
});

/**
 * 간단한 알림 리스트 (최근 N개만 표시)
 */
export interface SimpleNotificationListProps {
  /** 알림 목록 */
  notifications: NotificationData[];
  /** 최대 표시 개수 */
  maxItems?: number;
  /** 알림 클릭 핸들러 */
  onNotificationPress?: (notification: NotificationData) => void;
  /** 더보기 클릭 핸들러 */
  onSeeAll?: () => void;
  /** 빈 상태 시 표시할 메시지 */
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
      <View className="py-8 items-center">
        <BellSlashIcon size={32} color="#d1d5db" />
        <Text className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
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
          className="py-3 items-center border-t border-gray-100 dark:border-gray-800"
        >
          <Text className="text-primary-600 dark:text-primary-400 font-medium">
            {hasMore ? `${notifications.length - maxItems}개 더 보기` : '전체 보기'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default NotificationList;
