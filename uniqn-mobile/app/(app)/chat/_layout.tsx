/**
 * 채팅 스택 — 플래그 가드
 *
 * 플래그 OFF 면 방·새 방 화면 대신 안내만 보인다. 서버가 다크라 열어 둘 이유가 없고,
 * 딥링크·웹 URL 직접 입력도 여기서 막힌다. (ops 는 직접 라우트를 열어 두지만 채팅은 다르다.)
 */
import { Stack } from 'expo-router';
import { ChatUnavailable } from '@/components/chat';
import { useChatEnabled } from '@/hooks/chat';

export default function ChatLayout() {
  const { enabled, isLoading } = useChatEnabled();

  if (!enabled) {
    // 로딩 중에도 닫힌 쪽으로 — 잠깐 비어 보이는 게 권한 오류를 보는 것보다 낫다
    return isLoading ? null : <ChatUnavailable />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
