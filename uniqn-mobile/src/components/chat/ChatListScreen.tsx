/**
 * 채팅 목록 본체 — 소통 탭 '채팅' 칸 안에 들어간다(헤더·탭 전환은 라우트가 그린다)
 *
 * `postingId` 가 있으면 그 공고의 방만 보인다(공고 관리 타일 — 결정 D-d, 클라 필터).
 * 레퍼런스: 마켓 앱 인박스(상대 이름·미리보기·시각·안 읽음 배지).
 */
import React, { useCallback } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { EmptyState, ErrorState } from '@/components/ui';
import { ChatbubbleEllipsesOutlineIcon } from '@/components/icons';
import { useChatConversations } from '@/hooks/chat';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useTabBarBottomPadding } from '@/hooks/useTabBarBottomPadding';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { loadFailed } from '@/constants/messages';
import type { ChatConversationSummary } from '@/types/chat';
import { ChatListItem } from './ChatListItem';

interface ChatListScreenProps {
  postingId?: string | null;
}

export function ChatListScreen({ postingId = null }: ChatListScreenProps) {
  const bottomPadding = useTabBarBottomPadding();
  const { conversations, isLoading, error, hasMore, fetchMore, refetch } = useChatConversations({
    enabled: true,
    postingId,
  });
  const { refreshing, onRefresh } = useManualRefresh(refetch);

  const openRoom = useCallback(
    (conversation: ChatConversationSummary) => {
      router.push({
        pathname: '/(app)/chat/[conversationId]',
        params: {
          conversationId: conversation.conversationId,
          src: postingId ? 'posting_tile' : 'board_tab',
        },
      });
    },
    [postingId]
  );

  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <ErrorState title={loadFailed('채팅 목록')} error={error} onRetry={refetch} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {postingId ? (
        <Pressable
          onPress={() => router.setParams({ postingId: '' })}
          accessibilityRole="button"
          accessibilityLabel="공고 필터 해제, 전체 채팅 보기"
          className="border-b border-secondary-100 px-4 py-2 dark:border-surface-overlay"
        >
          <Text className="text-xs text-content-muted dark:text-secondary-400">
            이 공고의 채팅만 보는 중 · <Text className="font-sans-semibold">전체 보기</Text>
          </Text>
        </Pressable>
      ) : null}
      <FlashList
        data={conversations}
        renderItem={({ item }) => <ChatListItem conversation={item} onPress={openRoom} />}
        keyExtractor={(item) => item.conversationId}
        onEndReached={hasMore ? fetchMore : undefined}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...PTR_REFRESH_PROPS} />
        }
        testID="chat-conversation-list"
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon={<ChatbubbleEllipsesOutlineIcon size={48} color={SECONDARY_PALETTE[400]} />}
              title="아직 채팅이 없어요"
              description={
                postingId
                  ? '이 공고로 시작된 채팅이 없어요.'
                  : '공고 상세나 지원자 목록에서 채팅을 시작할 수 있어요.'
              }
            />
          )
        }
      />
    </View>
  );
}
