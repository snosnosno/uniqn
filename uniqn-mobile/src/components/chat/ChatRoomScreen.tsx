/**
 * 채팅방 화면 본체 — `/chat/[conversationId]` 와 `/chat/new` 가 같이 쓴다
 *
 * 🚨 새 방은 **다른 화면으로 이동하지 않고 그 자리에서 방이 된다.** 처음엔 첫 전송 성공 뒤
 *    `router.replace('/chat/<id>')` 했는데, 웹 스택에서 나간 new 화면이 display:none 으로 남아
 *    ① 뒤로 가면 낡은 new 화면이 나오고 ② 기존 방 Redirect 경로는 뒤로 가기가 갇혔다(E2E 실측).
 *    그래서 new 화면은 받은 방 id(또는 이미 있는 방 id)를 상태로 들고 같은 ChatRoomView 에 넘긴다.
 *    아웃박스 말풍선은 서버 행이 보이는 순간 타임라인 병합이 걸러 내 깜빡임이 없다.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { ErrorState } from '@/components/ui';
import { useChatLookup, useChatRoom, useChatRoomActions, useTrackChatOpen } from '@/hooks/chat';
import { useJobDetail } from '@/hooks/useJobDetail';
import { confirmAction } from '@/utils/confirmAction';
import { loadFailed, notFound } from '@/constants/messages';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { ChatRoomView } from './ChatRoomView';

export interface ChatRoomScreenProps {
  /** 기존 방 진입이면 방 id. 새 방이면 null */
  conversationId: string | null;
  /** 새 방: 공고 id(필수) */
  postingId?: string | null;
  /** 새 방: 구인자가 지원자에게 걸 때 지원자 uid */
  seekerId?: string | null;
  /** 계측 진입점 */
  src?: string;
}

export function ChatRoomScreen(props: ChatRoomScreenProps) {
  const isNew = props.conversationId === null;
  const [openedId, setOpenedId] = useState<string | null>(null);
  const lookup = useChatLookup(isNew ? (props.postingId ?? null) : null, props.seekerId ?? null);
  const id = props.conversationId ?? openedId ?? lookup.conversationId;

  const { meta, summary, mySide, readCursor, isLoading, error } = useChatRoom(id);
  const { hide, isHiding } = useChatRoomActions(id);

  const jobPostingId = meta?.jobPostingId ?? props.postingId ?? null;
  // 방 메타가 없을 때(새 방)만 공고를 따로 읽어 카드 제목·상태를 채운다
  const { job } = useJobDetail(jobPostingId ?? '', { enabled: !!jobPostingId && !meta });
  useTrackChatOpen(lookup.isLoading || isLoading ? null : jobPostingId, props.src);

  const title =
    summary?.counterpartName ??
    (meta ? (mySide === 'seeker' ? meta.employerDisplayName : meta.seekerDisplayName) : '새 채팅');

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

  const header = (
    <StackHeader
      title={title}
      fallbackHref="/(app)/(tabs)/board/chat"
      rightAction={
        meta ? (
          <Pressable
            onPress={handleLeave}
            disabled={isHiding}
            accessibilityRole="button"
            accessibilityLabel="채팅방 나가기"
            hitSlop={8}
          >
            <Text className="text-sm text-content-secondary dark:text-secondary-300">나가기</Text>
          </Pressable>
        ) : undefined
      }
    />
  );

  let body: React.ReactNode;
  if (!jobPostingId && !isLoading && !lookup.isLoading) {
    body = (
      <ErrorState
        title={notFound(isNew ? '공고' : '채팅방')}
        message={
          isNew ? '채팅을 시작할 공고를 찾을 수 없어요.' : '나갔거나 참여할 수 없는 채팅방이에요.'
        }
      />
    );
  } else if (error) {
    body = <ErrorState title={loadFailed('채팅방')} error={error} />;
  } else if (!jobPostingId || lookup.isLoading || (!isNew && isLoading)) {
    // 새 방에서 첫 전송으로 id 가 생길 때는 스피너로 바꾸지 않는다 — ChatRoomView 를 갈아 끼우면
    // 아웃박스(방금 보낸 말풍선)가 사라졌다 다시 나타나고 입력창 포커스도 잃는다.
    body = <ActivityIndicator color={SECONDARY_PALETTE[400]} />;
  } else {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        {header}
        <ChatRoomView
          conversationId={id}
          jobPostingId={jobPostingId}
          seekerId={props.seekerId ?? null}
          postingTitle={meta?.postingTitle ?? job?.title ?? '공고'}
          postingStatus={summary ? summary.postingStatus : job ? job.status : undefined}
          mySide={mySide ?? (props.seekerId ? 'employer' : 'seeker')}
          readCursor={readCursor}
          onPressPosting={() => router.push(`/(app)/jobs/${jobPostingId}`)}
          onSent={isNew ? setOpenedId : undefined}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      {header}
      <View className="flex-1 items-center justify-center p-4">{body}</View>
    </SafeAreaView>
  );
}
