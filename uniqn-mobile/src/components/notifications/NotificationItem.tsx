/**
 * UNIQN Mobile - Notification item component
 */

import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, Layout } from 'react-native-reanimated';
import { ChevronRightIcon, TrashIcon } from '@/components/icons';
import { getIconColor } from '@/constants/colors';
import { navigateFromNotification } from '@/services/observability/deepLinkService';
import { useThemeStore } from '@/stores/themeStore';
import { formatRelativeTime, toDate } from '@/utils/date';
import { logger } from '@/utils/logger';
import type { NotificationData } from '@/types/notification';
import { NotificationIcon } from './NotificationIcon';

export interface NotificationItemProps {
  notification: NotificationData;
  onPress?: (notification: NotificationData) => void;
  onDelete?: (notificationId: string) => void;
  showDelete?: boolean;
  animated?: boolean;
}

export const NotificationItem = memo(function NotificationItem({
  notification,
  onPress,
  onDelete,
  showDelete = false,
  animated = true,
}: NotificationItemProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(notification);
      return;
    }

    if (!notification.link) {
      return;
    }

    void navigateFromNotification(notification.type, notification.data, notification.link).catch(
      (error) => {
        logger.warn('알림 딥링크 이동 실패', {
          link: notification.link,
          error: String(error),
        });
      }
    );
  }, [notification, onPress]);

  const handleDelete = useCallback(() => {
    onDelete?.(notification.id);
  }, [notification.id, onDelete]);

  const createdAt = toDate(notification.createdAt);
  const timeAgo = createdAt ? formatRelativeTime(createdAt) : '';
  const accessibilityLabel = `${notification.isRead ? '읽음' : '읽지 않음'}, ${notification.title}, ${notification.body}, ${timeAgo}`;

  const content = (
    <View
      className={`relative border-b border-secondary-100 dark:border-surface ${
        notification.isRead
          ? 'bg-white dark:bg-surface-dark'
          : 'bg-primary-50 dark:bg-primary-900/20'
      }`}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={notification.link ? '누르면 관련 페이지로 이동합니다.' : undefined}
        className="px-4 py-3 active:bg-secondary-50 dark:active:bg-secondary-800"
      >
        <View className="flex-row items-start">
          <NotificationIcon type={notification.type} className="mr-3" />

          <View className="flex-1">
            <View className="flex-row items-center">
              {!notification.isRead && <View className="mr-2 h-2 w-2 rounded-sm bg-primary-500" />}
              <Text
                numberOfLines={1}
                className={`flex-1 text-base font-sans ${
                  notification.isRead
                    ? 'font-normal text-secondary-700 dark:text-secondary-300'
                    : 'font-sans-semibold text-secondary-900 dark:text-off-white'
                }`}
              >
                {notification.title}
              </Text>
            </View>

            <Text
              numberOfLines={2}
              className="mt-1 text-sm text-secondary-600 dark:text-secondary-400 font-sans"
            >
              {notification.body}
            </Text>

            <Text className="mt-1 text-xs text-secondary-400 dark:text-secondary-500 font-sans">
              {timeAgo}
            </Text>
          </View>

          {!showDelete && notification.link ? (
            <View className="ml-2 items-center justify-center">
              <ChevronRightIcon size={20} color={getIconColor(isDarkMode, 'secondary')} />
            </View>
          ) : showDelete ? (
            <View className="w-10" />
          ) : null}
        </View>
      </Pressable>

      {showDelete && onDelete ? (
        <Pressable
          onPress={handleDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="알림 삭제"
          className="absolute right-2 top-3 rounded-sm p-2 active:bg-secondary-100 dark:active:bg-secondary-800"
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

export function NotificationItemSkeleton() {
  return (
    <View
      className="border-b border-secondary-100 px-4 py-3 dark:border-surface"
      accessibilityElementsHidden={true}
    >
      <View className="flex-row items-start">
        <View className="mr-3 h-10 w-10 animate-pulse rounded-sm bg-secondary-200 dark:bg-surface" />

        <View className="flex-1">
          <View className="h-4 w-3/4 animate-pulse rounded bg-secondary-200 dark:bg-surface" />
          <View className="mt-2 h-3 w-full animate-pulse rounded bg-secondary-200 dark:bg-surface" />
          <View className="mt-1 h-3 w-2/3 animate-pulse rounded bg-secondary-200 dark:bg-surface" />
          <View className="mt-2 h-2 w-16 animate-pulse rounded bg-secondary-200 dark:bg-surface" />
        </View>
      </View>
    </View>
  );
}

export default NotificationItem;
