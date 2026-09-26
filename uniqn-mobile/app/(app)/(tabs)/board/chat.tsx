/**
 * 소통 탭 — '채팅' 칸 (결정 D-c: 새 탭·헤더 아이콘 대신 소통 탭 안에 둔다)
 *
 * 정적 세그먼트라 `[boardType]` 보다 우선한다. 플래그 OFF 면 일정 칸으로 돌려보낸다.
 * `?postingId=` 가 있으면 그 공고의 채팅만(공고 관리 타일).
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { BoardTabBar, type BoardTabKey } from '@/components/board/BoardTabBar';
import { ChatListScreen } from '@/components/chat';
import { useChatEnabled, useChatUnreadTotal } from '@/hooks/chat';

function navigateToTab(tab: BoardTabKey) {
  if (tab === 'chat') return;
  router.replace(`/(app)/(tabs)/board/${tab}`);
}

export default function BoardChatScreen() {
  const { enabled, isLoading } = useChatEnabled();
  const chatUnread = useChatUnreadTotal(enabled);
  const { postingId } = useLocalSearchParams<{ postingId?: string }>();

  if (!enabled && !isLoading) {
    return <Redirect href="/(app)/(tabs)/board/schedule" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader title="소통" />
      <BoardTabBar activeTab="chat" onTabPress={navigateToTab} showChat chatUnread={chatUnread} />
      {enabled ? <ChatListScreen postingId={postingId || null} /> : null}
    </SafeAreaView>
  );
}
