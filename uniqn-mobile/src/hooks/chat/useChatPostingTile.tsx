/**
 * 공고 관리 화면의 '채팅' 타일 — 이 공고로 시작된 채팅만 보는 목록으로 보낸다(결정 D-d)
 *
 * 공고 관리 화면 파일이 이미 800줄 상한을 넘어서, 타일 항목은 여기서 만들어 넘긴다.
 * 배지 = 이 공고 방들의 안 읽음 합계(전체 목록 캐시를 공고로 거른 값 — 30건 페이지 밖은 빠진다).
 */
import React, { useMemo } from 'react';
import { router } from 'expo-router';
import { ChatbubbleEllipsesOutlineIcon } from '@/components/icons';
import type { ActionTileItem } from '@/components/ui/ActionTileGrid';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { useChatEnabled } from './useChatEnabled';
import { useChatConversations } from './useChatConversations';

export function useChatPostingTile(postingId: string): ActionTileItem & { visible: boolean } {
  const { enabled } = useChatEnabled();
  const { conversations } = useChatConversations({ enabled, postingId });
  const unread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  return {
    key: 'chat',
    visible: enabled,
    icon: <ChatbubbleEllipsesOutlineIcon size={18} color={SECONDARY_PALETTE[500]} />,
    title: '채팅',
    description:
      conversations.length > 0
        ? `이 공고로 시작된 채팅 ${conversations.length}개를 봅니다.`
        : '이 공고로 시작된 채팅을 봅니다.',
    badge: unread > 0 ? { label: `안 읽음 ${unread}`, variant: 'error' } : undefined,
    onPress: () => router.push({ pathname: '/(app)/(tabs)/board/chat', params: { postingId } }),
    testID: 'job-posting-chat',
  };
}
