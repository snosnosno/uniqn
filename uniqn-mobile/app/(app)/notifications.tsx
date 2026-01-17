/**
 * UNIQN Mobile - Notifications Screen
 * 알림 목록 화면
 */

import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, EmptyState, SkeletonNotificationItem } from '@/components/ui';
import { BellIcon } from '@/components/icons';
import { StackHeader } from '@/components/headers';
import { useNotificationList, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { Timestamp } from 'firebase/firestore';
import { useCallback } from 'react';

export default function NotificationsScreen() {
  // 알림 목록 훅
  const {
    notifications,
    isLoading,
    refetch,
  } = useNotificationList();

  // 읽음 처리 훅
  const { markAsRead, isMarking } = useMarkAsRead();
  const { markAllAsRead } = useMarkAllAsRead();

  // 리프레시
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // 알림 클릭 시 읽음 처리
  const handleNotificationPress = useCallback((id: string, isRead: boolean) => {
    if (!isRead && !isMarking) {
      markAsRead(id);
    }
  }, [markAsRead, isMarking]);

  // Timestamp 또는 Date를 문자열로 변환
  const formatDate = (createdAt: Timestamp | Date | undefined): string => {
    if (!createdAt) return '';

    const date = createdAt instanceof Timestamp ? createdAt.toDate() : createdAt;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    return `${days}일 전`;
  };

  // 읽지 않은 알림 수
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <StackHeader
        title="알림"
        titleSuffix={
          unreadCount > 0 ? (
            <Text className="text-primary-600"> ({unreadCount})</Text>
          ) : null
        }
        fallbackHref="/(app)/(tabs)"
        rightAction={
          unreadCount > 0 ? (
            <Pressable onPress={() => markAllAsRead()} className="px-3 py-1">
              <Text className="text-sm text-primary-600 dark:text-primary-400">
                모두 읽음
              </Text>
            </Pressable>
          ) : null
        }
      />

      {/* 알림 목록 */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
      >
        {isLoading && notifications.length === 0 ? (
          // 스켈레톤 로딩
          <View>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonNotificationItem key={i} />
            ))}
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="알림이 없습니다"
            description="새로운 알림이 오면 여기에 표시됩니다"
            icon={<BellIcon size={48} color="#9CA3AF" />}
          />
        ) : (
          notifications.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() => handleNotificationPress(notification.id, notification.isRead)}
            >
              <Card
                className={`mb-2 ${!notification.isRead ? 'border-l-4 border-l-primary-500' : ''}`}
                padding="sm"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text
                      className={`font-medium ${
                        notification.isRead
                          ? 'text-gray-700 dark:text-gray-300'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {notification.title}
                    </Text>
                    <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {notification.body}
                    </Text>
                  </View>
                  <Text className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(notification.createdAt)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
