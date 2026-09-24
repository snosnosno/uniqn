/**
 * 새 채팅 화면 — 아직 방이 없는 상태
 *
 * 1) 기존 방이 있으면 그 방으로 바꾼다.
 * 2) 없으면 빈 방 + 입력창. 방은 **첫 전송 때** 열린다(빈 방 남발 방지 — 설계 §8).
 * 3) 첫 전송이 성공하면 방 화면으로 바꾼다. 열기만 성공하고 보내기가 실패하면 이 화면에 남아
 *    실패 말풍선 → 재전송(받은 방 id 로 보내기만)을 한다.
 *
 * params: postingId(필수) · seekerId(구인자가 지원자에게 걸 때) · src(계측 진입점)
 */
import React, { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { ErrorState } from '@/components/ui';
import { ChatRoomView } from '@/components/chat';
import { useChatLookup, useTrackChatOpen } from '@/hooks/chat';
import { useJobDetail } from '@/hooks/useJobDetail';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { notFound } from '@/constants/messages';

export default function NewChatScreen() {
  const params = useLocalSearchParams<{ postingId?: string; seekerId?: string; src?: string }>();
  const postingId = params.postingId ?? null;
  const seekerId = params.seekerId || null;
  const lookup = useChatLookup(postingId, seekerId);
  const { job } = useJobDetail(postingId ?? '', { enabled: !!postingId });
  // 기존 방으로 바로 넘어가면 그 화면이 센다 — 여기선 새 방을 실제로 보여 줄 때만
  useTrackChatOpen(lookup.isLoading || lookup.conversationId ? null : postingId, params.src);

  const handleSent = useCallback(
    (conversationId: string) => {
      router.replace({
        pathname: '/(app)/chat/[conversationId]',
        params: { conversationId, src: params.src ?? 'list' },
      });
    },
    [params.src]
  );

  if (lookup.conversationId) {
    return (
      <Redirect
        href={{
          pathname: '/(app)/chat/[conversationId]',
          params: { conversationId: lookup.conversationId, src: params.src ?? 'list' },
        }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="새 채팅" fallbackHref="/(app)/(tabs)/board/chat" />
      {!postingId ? (
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState title={notFound('공고')} message="채팅을 시작할 공고를 찾을 수 없어요." />
        </View>
      ) : lookup.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={SECONDARY_PALETTE[400]} />
        </View>
      ) : (
        <ChatRoomView
          conversationId={null}
          jobPostingId={postingId}
          seekerId={seekerId}
          postingTitle={job?.title ?? '공고'}
          postingStatus={job ? job.status : undefined}
          mySide={seekerId ? 'employer' : 'seeker'}
          readCursor={null}
          onPressPosting={() => router.push(`/(app)/jobs/${postingId}`)}
          onSent={handleSent}
        />
      )}
    </SafeAreaView>
  );
}
