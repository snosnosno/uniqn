/**
 * 채팅방 화면 — 기존 방. 본체는 ChatRoomScreen(새 방과 공유).
 * 헤더 제목은 상대 이름(서버가 만든 표시 이름). ⋯ 메뉴 대신 헤더 오른쪽 "나가기" 하나만 둔다.
 */
import { useLocalSearchParams } from 'expo-router';
import { ChatRoomScreen } from '@/components/chat';

export default function ChatRoomRoute() {
  const { conversationId, src } = useLocalSearchParams<{ conversationId: string; src?: string }>();
  // 쿼리 키·realtime 필터·요약 대조가 서버의 소문자 uuid 와 맞도록 정규화
  return <ChatRoomScreen conversationId={conversationId?.toLowerCase() ?? null} src={src} />;
}
