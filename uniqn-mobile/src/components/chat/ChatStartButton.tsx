/**
 * "채팅하기" 진입 버튼 — 공고 상세·WorkTab 확정 카드·지원자 행 공용
 *
 * 플래그 OFF 면 아무것도 그리지 않는다(진입점 비노출 — 서버 다크 동안).
 * 높이를 더 쓰지 않도록 기본은 작은 outline 버튼(기존 행 옆에 나란히 둔다).
 */
import React, { memo } from 'react';
import { Pressable, Text } from 'react-native';
import { ChatbubbleEllipsesOutlineIcon } from '@/components/icons';
import { useChatEntry, type OpenChatParams } from '@/hooks/chat';
import { PRIMARY_COLORS } from '@/constants/colors';

interface ChatStartButtonProps extends OpenChatParams {
  label?: string;
  /** compact = 아이콘+짧은 글자(행 안), full = 넓은 버튼 */
  variant?: 'compact' | 'full';
  testID?: string;
}

export const ChatStartButton = memo(function ChatStartButton({
  label = '채팅하기',
  variant = 'compact',
  testID = 'chat-start-button',
  ...params
}: ChatStartButtonProps) {
  const { enabled, openChat } = useChatEntry();
  if (!enabled) return null;

  const isFull = variant === 'full';
  return (
    <Pressable
      onPress={() => openChat(params)}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={6}
      className={`flex-row items-center justify-center rounded-lg border border-primary-500 active:bg-primary-50 dark:border-primary-400 dark:active:bg-primary-900/20 ${
        isFull ? 'px-4 py-3' : 'px-3 py-1.5'
      }`}
    >
      <ChatbubbleEllipsesOutlineIcon size={isFull ? 18 : 14} color={PRIMARY_COLORS[500]} />
      <Text
        className={`ml-1.5 font-sans-semibold text-primary-600 dark:text-primary-400 ${
          isFull ? 'text-base' : 'text-xs'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
});
