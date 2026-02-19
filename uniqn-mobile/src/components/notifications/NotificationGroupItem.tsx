/**
 * UNIQN Mobile - NotificationGroupItem 컴포넌트
 *
 * @description 그룹화된 알림을 표시하는 카드 (펼침/접힘 UI)
 * @version 1.0.0
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { NotificationIcon } from './NotificationIcon';
import { NotificationItem } from './NotificationItem';
import {
  GroupedNotificationData,
  NotificationData,
  toDateFromTimestamp,
} from '@/types/notification';
import { formatRelativeTime } from '@/utils/date';

export interface NotificationGroupItemProps {
  /** 그룹 데이터 */
  group: GroupedNotificationData;
  /** 그룹 클릭 핸들러 (전체 읽음 처리 등) */
  onGroupPress?: (group: GroupedNotificationData) => void;
  /** 개별 알림 클릭 핸들러 */
  onNotificationPress?: (notification: NotificationData) => void;
  /** 개별 알림 삭제 핸들러 */
  onDeleteNotification?: (notificationId: string) => void;
  /** 삭제 버튼 표시 여부 */
  showDelete?: boolean;
  /** 기본 펼침 상태 */
  defaultExpanded?: boolean;
}

export const NotificationGroupItem = memo(function NotificationGroupItem({
  group,
  onGroupPress,
  onNotificationPress,
  onDeleteNotification,
  showDelete = false,
  defaultExpanded = false,
}: NotificationGroupItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 컨텍스트 정보 (공고명)
  const contextLabel = group.context.jobTitle || '';

  // 최신 알림 시간
  const latestTime = toDateFromTimestamp(group.latestCreatedAt);
  const timeAgo = latestTime ? formatRelativeTime(latestTime) : '';

  // 읽지 않은 알림 존재 여부
  const hasUnread = group.unreadCount > 0;

  // 펼침/접힘 토글
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 그룹 헤더 클릭
  const handleGroupPress = useCallback(() => {
    if (onGroupPress) {
      onGroupPress(group);
    }
    toggleExpanded();
  }, [group, onGroupPress, toggleExpanded]);

  // 접근성 라벨
  const accessibilityLabel = `${group.groupTitle}, ${contextLabel}, ${timeAgo}${hasUnread ? ', 읽지 않은 알림 있음' : ''}`;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      layout={Layout.duration(200)}
      className={`
        border-b border-gray-100 dark:border-surface
        ${hasUnread ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-white dark:bg-surface-dark'}
      `}
    >
      {/* 그룹 헤더 (항상 표시) */}
      <Pressable
        onPress={handleGroupPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={isExpanded ? '접으려면 탭하세요' : '펼치려면 탭하세요'}
        className="px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800"
      >
        <View className="flex-row items-start">
          {/* 아이콘 */}
          <NotificationIcon type={group.type} useEmoji className="mr-3" />

          {/* 컨텐츠 */}
          <View className="flex-1">
            {/* 제목 (그룹 카운트 포함) */}
            <View className="flex-row items-center">
              {hasUnread && <View className="w-2 h-2 rounded-full bg-primary-500 mr-2" />}
              <Text
                className={`text-base flex-1 ${
                  hasUnread
                    ? 'text-gray-900 dark:text-white font-semibold'
                    : 'text-gray-700 dark:text-gray-300 font-normal'
                }`}
                numberOfLines={1}
              >
                {group.groupTitle}
              </Text>
              {/* 읽지 않은 수 배지 */}
              {group.unreadCount > 0 && (
                <View className="ml-2 min-w-[20px] h-5 px-1.5 bg-error-500 rounded-full items-center justify-center">
                  <Text className="text-xs font-bold text-white">
                    {group.unreadCount > 99 ? '99+' : group.unreadCount}
                  </Text>
                </View>
              )}
            </View>

            {/* 컨텍스트 (공고명/이벤트명) */}
            {contextLabel && (
              <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5" numberOfLines={1}>
                {contextLabel}
              </Text>
            )}

            {/* 본문 (요약) */}
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1" numberOfLines={1}>
              {group.groupBody}
            </Text>

            {/* 시간 */}
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo}</Text>
          </View>

          {/* 펼침/접힘 아이콘 */}
          <View className="ml-2 items-center justify-center">
            {isExpanded ? (
              <ChevronUpIcon size={20} color="#9ca3af" />
            ) : (
              <ChevronDownIcon size={20} color="#9ca3af" />
            )}
          </View>
        </View>
      </Pressable>

      {/* 펼침 상태: 개별 알림 목록 */}
      {isExpanded && (
        <View className="bg-gray-50 dark:bg-surface/50">
          {group.notifications.map((notification, index) => (
            <View
              key={notification.id}
              className={index > 0 ? 'border-t border-gray-100 dark:border-surface-overlay/50' : ''}
            >
              <NotificationItem
                notification={notification}
                onPress={onNotificationPress}
                onDelete={onDeleteNotification}
                showDelete={showDelete}
                animated={false}
                useEmoji={false}
              />
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
});

export default NotificationGroupItem;
