/**
 * 채팅방 화면 — 기존 방
 *
 * 헤더 제목은 상대 이름(서버가 만든 표시 이름). ⋯ 메뉴 대신 헤더 오른쪽 "나가기" 하나만 둔다.
 */
import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { ErrorState } from '@/components/ui';
import { ChatRoomView } from '@/components/chat';
import { useChatRoom, useChatRoomActions, useTrackChatOpen } from '@/hooks/chat';
import { confirmAction } from '@/utils/confirmAction';
import { loadFailed, notFound } from '@/constants/messages';

export default function ChatRoomScreen() {
  const { conversationId, src } = useLocalSearchParams<{ conversationId: string; src?: string }>();
  const id = conversationId ?? null;
  const { meta, summary, mySide, readCursor, isLoading, error } = useChatRoom(id);
  const { hide, isHiding } = useChatRoomActions(id);
  useTrackChatOpen(meta?.jobPostingId ?? null, src);

  const counterpartName =
    summary?.counterpartName ??
    (meta ? (mySide === 'seeker' ? meta.employerDisplayName : meta.seekerDisplayName) : '채팅');

  const handleLeave = useCallback(() => {
    confirmAction({
      title: '채팅방 나가기',
      message: '목록에서 이 채팅이 사라져요. 상대가 새 메시지를 보내면 다시 나타나요.',
      confirmText: '나가기',
      destructive: true,
      onConfirm: async () => {
        await hide();
        router.back();
      },
    });
  }, [hide]);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title={counterpartName}
        fallbackHref="/(app)/(tabs)/board/chat"
        rightAction={
          <Pressable
            onPress={handleLeave}
            disabled={isHiding || !meta}
            accessibilityRole="button"
            accessibilityLabel="채팅방 나가기"
            hitSlop={8}
          >
            <Text className="text-sm text-content-secondary dark:text-secondary-300">나가기</Text>
          </Pressable>
        }
      />
      {error ? (
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState title={loadFailed('채팅방')} error={error} />
        </View>
      ) : !isLoading && !meta ? (
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState title={notFound('채팅방')} message="나갔거나 참여할 수 없는 채팅방이에요." />
        </View>
      ) : meta ? (
        <ChatRoomView
          conversationId={meta.id}
          jobPostingId={meta.jobPostingId}
          seekerId={null}
          postingTitle={meta.postingTitle}
          postingStatus={summary ? summary.postingStatus : undefined}
          mySide={mySide}
          readCursor={readCursor}
          onPressPosting={() => router.push(`/(app)/jobs/${meta.jobPostingId}`)}
        />
      ) : null}
    </SafeAreaView>
  );
}
