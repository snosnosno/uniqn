/**
 * 채팅방 상단 고정 공고 카드 — 제목 + 상태 배지(마감·종료된 공고). 누르면 공고 상세.
 *
 * 레퍼런스: Telegram 방 상단 고정 배너. 높이를 최소로(한 줄) 두어 메시지 영역을 먹지 않게 한다.
 */
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRightIcon } from '@/components/icons';
import { chatPostingBadge } from '@/domains/chat';
import { SECONDARY_PALETTE } from '@/constants/colors';

interface ChatPostingCardProps {
  title: string;
  /** undefined = 아직 모름(목록 캐시 없음) */
  status: string | null | undefined;
  onPress?: () => void;
}

export const ChatPostingCard = memo(function ChatPostingCard({
  title,
  status,
  onPress,
}: ChatPostingCardProps) {
  const badge = chatPostingBadge(status, status !== undefined);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`공고 ${title}${badge ? `, ${badge.label}` : ''}. 공고 보기`}
      className="flex-row items-center border-b border-secondary-200 bg-surface-card px-4 py-2.5 active:bg-secondary-50 dark:border-surface-overlay dark:bg-surface-elevated dark:active:bg-surface-overlay"
    >
      <Text className="mr-2 text-xs text-content-muted dark:text-secondary-400">공고</Text>
      <Text
        numberOfLines={1}
        className="min-w-0 flex-1 text-sm font-sans-semibold text-content-primary dark:text-secondary-100"
      >
        {title}
      </Text>
      {badge ? (
        <View
          className={`ml-2 rounded-sm px-1.5 py-0.5 ${
            badge.tone === 'warning'
              ? 'bg-warning-100 dark:bg-warning-900/30'
              : 'bg-secondary-100 dark:bg-surface'
          }`}
        >
          <Text
            className={`text-xs font-sans-medium ${
              badge.tone === 'warning'
                ? 'text-warning-700 dark:text-warning-400'
                : 'text-secondary-600 dark:text-secondary-300'
            }`}
          >
            {badge.label}
          </Text>
        </View>
      ) : null}
      {onPress ? (
        <View className="ml-1">
          <ChevronRightIcon size={16} color={SECONDARY_PALETTE[400]} />
        </View>
      ) : null}
    </Pressable>
  );
});
