/**
 * UNIQN Mobile - NotificationItem 컴포넌트
 *
 * @description 개별 알림을 표시하는 카드 컴포넌트
 * @version 1.1.0
 */

// 1. React/React Native
import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, useColorScheme } from 'react-native';

// 2. 외부 라이브러리
import Animated, { FadeInRight, FadeOutLeft, Layout } from 'react-native-reanimated';
import { router, type Href } from 'expo-router';

// 3. 내부 모듈
import { ChevronRightIcon, TrashIcon } from '@/components/icons';
import { getIconColor } from '@/constants/colors';
import { formatRelativeTime } from '@/utils/dateUtils';
import { toDateFromTimestamp } from '@/types/notification';

// 4. 타입
import type { NotificationData } from '@/types/notification';

// 5. 상대 경로
import { NotificationIcon } from './NotificationIcon';

export interface NotificationItemProps {
  /** 알림 데이터 */
  notification: NotificationData;
  /** 클릭 핸들러 */
  onPress?: (notification: NotificationData) => void;
  /** 삭제 핸들러 */
  onDelete?: (notificationId: string) => void;
  /** 삭제 버튼 표시 여부 */
  showDelete?: boolean;
  /** 애니메이션 활성화 (기본: true) */
  animated?: boolean;
  /** 아이콘에 이모지 사용 (기본: true) */
  useEmoji?: boolean;
}

export const NotificationItem = memo(function NotificationItem({
  notification,
  onPress,
  onDelete,
  showDelete = false,
  animated = true,
  useEmoji = true,
}: NotificationItemProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(notification);
    } else if (notification.link) {
      router.push(notification.link as Href);
    }
  }, [notification, onPress]);

  const handleDelete = useCallback(() => {
    onDelete?.(notification.id);
  }, [notification.id, onDelete]);

  const createdAt = toDateFromTimestamp(notification.createdAt);
  const timeAgo = createdAt ? formatRelativeTime(createdAt) : '';

  // 접근성을 위한 설명 텍스트
  const accessibilityLabel = `${notification.isRead ? '읽음' : '읽지 않음'}, ${notification.title}, ${notification.body}, ${timeAgo}`;

  const content = (
    <View
      className={`
        relative border-b border-gray-100 dark:border-surface
        ${
          notification.isRead
            ? 'bg-white dark:bg-surface-dark'
            : 'bg-primary-50 dark:bg-primary-900/20'
        }
      `}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={notification.link ? '탭하면 관련 페이지로 이동합니다' : undefined}
        className="px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800"
      >
        <View className="flex-row items-start">
          {/* 아이콘 */}
          <NotificationIcon type={notification.type} useEmoji={useEmoji} className="mr-3" />

          {/* 컨텐츠 */}
          <View className="flex-1">
            {/* 제목 */}
            <View className="flex-row items-center">
              {!notification.isRead && (
                <View className="w-2 h-2 rounded-full bg-primary-500 mr-2" />
              )}
              <Text
                numberOfLines={1}
                className={`
                  text-base flex-1
                  ${
                    notification.isRead
                      ? 'text-gray-700 dark:text-gray-300 font-normal'
                      : 'text-gray-900 dark:text-white font-semibold'
                  }
                `}
              >
                {notification.title}
              </Text>
            </View>

            {/* 본문 */}
            <Text numberOfLines={2} className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {notification.body}
            </Text>

            {/* 시간 */}
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo}</Text>
          </View>

          {/* 오른쪽: 링크 화살표 (삭제 모드가 아닐 때만) */}
          {!showDelete && notification.link ? (
            <View className="ml-2 items-center justify-center">
              <ChevronRightIcon size={20} color={getIconColor(isDarkMode, 'secondary')} />
            </View>
          ) : showDelete ? (
            <View className="w-10" />
          ) : null}
        </View>
      </Pressable>

      {/* 삭제 버튼: Pressable 외부에 배치하여 button 중첩 방지 */}
      {showDelete && onDelete ? (
        <Pressable
          onPress={handleDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="알림 삭제"
          className="absolute right-2 top-3 p-2 rounded-full active:bg-gray-100 dark:active:bg-gray-800"
        >
          <TrashIcon size={18} color={getIconColor(isDarkMode, 'secondary')} />
        </Pressable>
      ) : null}
    </View>
  );

  if (animated) {
    return (
      <Animated.View
        entering={FadeInRight.duration(200)}
        exiting={FadeOutLeft.duration(200)}
        layout={Layout.duration(200)}
      >
        {content}
      </Animated.View>
    );
  }

  return content;
});

/**
 * 알림 아이템 스켈레톤
 */
export function NotificationItemSkeleton() {
  return (
    <View className="px-4 py-3 border-b border-gray-100 dark:border-surface">
      <View className="flex-row items-start">
        {/* 아이콘 스켈레톤 */}
        <View className="w-10 h-10 rounded-full bg-gray-200 dark:bg-surface animate-pulse mr-3" />

        {/* 컨텐츠 스켈레톤 */}
        <View className="flex-1">
          {/* 제목 스켈레톤 */}
          <View className="h-4 w-3/4 bg-gray-200 dark:bg-surface rounded animate-pulse" />
          {/* 본문 스켈레톤 */}
          <View className="h-3 w-full bg-gray-200 dark:bg-surface rounded animate-pulse mt-2" />
          <View className="h-3 w-2/3 bg-gray-200 dark:bg-surface rounded animate-pulse mt-1" />
          {/* 시간 스켈레톤 */}
          <View className="h-2 w-16 bg-gray-200 dark:bg-surface rounded animate-pulse mt-2" />
        </View>
      </View>
    </View>
  );
}

export default NotificationItem;
