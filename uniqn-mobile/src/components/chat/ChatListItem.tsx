/**
 * 채팅 목록 한 행 — 상대 이름 · 공고 제목 · 마지막 메시지 미리보기 · 시각 · 안 읽음 배지
 *
 * 이름은 서버가 만든 표시 이름(닉네임 우선, 없으면 "구직자 xxxx"/"<업장명> 담당자")을 그대로 쓴다.
 */
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { formatRelative } from '@/utils/formatters/date';
import type { ChatConversationSummary } from '@/types/chat';

interface ChatListItemProps {
  conversation: ChatConversationSummary;
  onPress: (conversation: ChatConversationSummary) => void;
}

export const ChatListItem = memo(function ChatListItem({
  conversation,
  onPress,
}: ChatListItemProps) {
  const hasUnread = conversation.unreadCount > 0;
  const time = formatRelative(conversation.lastMessageAt);

  return (
    <Pressable
      onPress={() => onPress(conversation)}
      accessibilityRole="button"
      accessibilityLabel={`${conversation.counterpartName}, ${conversation.postingTitle}${
        hasUnread ? `, 안 읽은 메시지 ${conversation.unreadCount}개` : ''
      }`}
      className="flex-row items-center border-b border-secondary-100 bg-surface-page px-4 py-3 active:bg-secondary-50 dark:border-surface-overlay dark:bg-surface dark:active:bg-surface-elevated"
    >
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center">
          <Text
            numberOfLines={1}
            className={`min-w-0 flex-shrink text-base text-content-primary dark:text-secondary-100 ${
              hasUnread ? 'font-sans-bold' : 'font-sans-semibold'
            }`}
          >
            {conversation.counterpartName}
          </Text>
          <Text className="ml-2 text-xs text-content-muted dark:text-secondary-400">{time}</Text>
        </View>
        <Text
          numberOfLines={1}
          className="mt-0.5 text-xs text-content-muted dark:text-secondary-400"
        >
          {conversation.postingTitle}
        </Text>
        <Text
          numberOfLines={1}
          className={`mt-1 text-sm ${
            hasUnread
              ? 'text-content-primary dark:text-secondary-100'
              : 'text-content-secondary dark:text-secondary-300'
          }`}
        >
          {conversation.lastMessagePreview ?? ''}
        </Text>
      </View>
      {hasUnread ? (
        <View className="ml-3">
          <NotificationBadge count={conversation.unreadCount} />
        </View>
      ) : null}
    </Pressable>
  );
});
