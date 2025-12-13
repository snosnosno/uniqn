/**
 * UNIQN Mobile - Notifications Screen
 * 알림 목록 화면
 */

import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, EmptyState } from '@/components/ui';
import { ChevronLeftIcon, BellIcon } from '@/components/icons';
import { useState, useCallback } from 'react';

// 임시 알림 데이터
const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    type: 'application_confirmed',
    title: '지원이 확정되었습니다',
    message: '강남 홀덤펍 딜러 지원이 확정되었습니다.',
    createdAt: '2024-12-15T10:30:00Z',
    isRead: false,
  },
  {
    id: '2',
    type: 'new_job',
    title: '새로운 공고가 등록되었습니다',
    message: '홍대 토너먼트 스태프 모집 공고를 확인하세요.',
    createdAt: '2024-12-14T15:00:00Z',
    isRead: true,
  },
  {
    id: '3',
    type: 'reminder',
    title: '내일 근무가 예정되어 있습니다',
    message: '판교 프라이빗 이벤트 (18:00)',
    createdAt: '2024-12-13T09:00:00Z',
    isRead: true,
  },
];

export default function NotificationsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    return `${days}일 전`;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <View className="flex-row items-center bg-white px-2 py-3 dark:bg-gray-800">
        <Pressable onPress={() => router.back()} className="p-2" hitSlop={8}>
          <ChevronLeftIcon size={24} color="#6B7280" />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          알림
        </Text>
      </View>

      {/* 알림 목록 */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <EmptyState
            title="알림이 없습니다"
            description="새로운 알림이 오면 여기에 표시됩니다"
            icon={<BellIcon size={48} color="#9CA3AF" />}
          />
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
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
                    {notification.message}
                  </Text>
                </View>
                <Text className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(notification.createdAt)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
