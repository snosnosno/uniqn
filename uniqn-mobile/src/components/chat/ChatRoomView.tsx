/**
 * 채팅방 본체 — 상단 공고 카드 + 메시지 목록 + 입력창
 *
 * `[conversationId]` 화면과 `new` 화면(아직 방 없음)이 같이 쓴다.
 * - 목록: FlashList 2.0.2 는 inverted 가 없어 오름차순 데이터 + startRenderingFromBottom.
 *   위로 스크롤하면 과거 페이지(onStartReached).
 * - 키보드: keyboard-controller 의 KeyboardAvoidingView(padding) 가 목록과 입력창을 함께 올린다.
 * - 읽음: 화면에 들어온 가장 최신 **상대** 메시지까지 mark_read(같은 id 는 한 번).
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ErrorState } from '@/components/ui';
import { mergeChatTimeline } from '@/domains/chat';
import { useChatMessages, useChatRoomActions, useSendChatMessage } from '@/hooks/chat';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAuthStore } from '@/stores/authStore';
import { loadFailed } from '@/constants/messages';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { ChatSide } from '@/types/chat';
import { ChatComposer } from './ChatComposer';
import { ChatPostingCard } from './ChatPostingCard';
import { ChatTimelineRow, withUnreadDivider, type ChatRow } from './ChatTimelineRow';

export interface ChatRoomViewProps {
  conversationId: string | null;
  jobPostingId: string;
  /** 새 방에서 구인자가 지원자에게 걸 때만 */
  seekerId: string | null;
  postingTitle: string;
  /** undefined = 모름 */
  postingStatus: string | null | undefined;
  mySide: ChatSide | null;
  readCursor: string | null;
  onPressPosting?: () => void;
  onSent?: (conversationId: string) => void;
}

const MAINTAIN_POSITION = { startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 };

export function ChatRoomView(props: ChatRoomViewProps) {
  const { conversationId, jobPostingId, seekerId, mySide, readCursor } = props;
  const uid = useAuthStore((s) => s.user?.uid);
  const { isOnline } = useNetworkStatus();
  const { messages, isLoading, error, fetchOlder } = useChatMessages(conversationId);
  const { outbox, send, retry, discard } = useSendChatMessage({
    conversationId,
    jobPostingId,
    seekerId,
    onSent: props.onSent,
  });
  const { markRead } = useChatRoomActions(conversationId);

  const rows: ChatRow[] = useMemo(
    () => withUnreadDivider(mergeChatTimeline([messages], [], outbox), readCursor, uid),
    [messages, outbox, readCursor, uid]
  );

  const latestIncomingId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m && m.senderId !== uid) return m.id;
    }
    return null;
  }, [messages, uid]);

  useEffect(() => {
    void markRead(latestIncomingId);
  }, [latestIncomingId, markRead]);

  const handleSend = useCallback((body: string) => void send(body), [send]);
  const handleRetry = useCallback((id: string) => void retry(id), [retry]);

  const renderItem = useCallback(
    ({ item }: { item: ChatRow }) => (
      <ChatTimelineRow
        row={item}
        myUid={uid}
        showSenderName={mySide === 'seeker'}
        onRetry={handleRetry}
        onDiscard={discard}
      />
    ),
    [uid, mySide, handleRetry, discard]
  );

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1" style={{ flex: 1 }}>
      <ChatPostingCard
        title={props.postingTitle}
        status={props.postingStatus}
        onPress={props.onPressPosting}
      />
      <View className="flex-1 bg-surface-page dark:bg-surface">
        {error ? (
          <ErrorState title={loadFailed('메시지')} error={error} />
        ) : isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={SECONDARY_PALETTE[400]} />
          </View>
        ) : (
          <FlashList
            data={rows}
            renderItem={renderItem}
            keyExtractor={(row) => row.key}
            getItemType={(row) => row.type}
            maintainVisibleContentPosition={MAINTAIN_POSITION}
            onStartReached={fetchOlder}
            onStartReachedThreshold={0.2}
            contentContainerStyle={{ paddingVertical: 8 }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            testID="chat-message-list"
          />
        )}
      </View>
      <ChatComposer
        onSend={handleSend}
        disabled={!isOnline}
        disabledReason={isOnline ? undefined : '오프라인에서는 메시지를 보낼 수 없어요'}
      />
    </KeyboardAvoidingView>
  );
}
