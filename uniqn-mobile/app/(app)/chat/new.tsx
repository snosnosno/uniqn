/**
 * 새 채팅 화면 — 아직 방이 없는 상태에서 시작한다
 *
 * 기존 방이 있으면 그 방을, 없으면 빈 방을 **이 화면 안에서** 보여 주고, 첫 전송이 성공하면
 * 그 자리에서 방이 된다(다른 화면으로 이동하지 않는다 — 이유는 ChatRoomScreen 주석).
 * 방은 첫 전송 때 열린다(빈 방 남발 방지 — 설계 §8).
 *
 * params: postingId(필수) · seekerId(구인자가 지원자에게 걸 때) · src(계측 진입점)
 */
import { useLocalSearchParams } from 'expo-router';
import { ChatRoomScreen } from '@/components/chat';

export default function NewChatRoute() {
  const params = useLocalSearchParams<{ postingId?: string; seekerId?: string; src?: string }>();
  return (
    <ChatRoomScreen
      conversationId={null}
      postingId={params.postingId || null}
      seekerId={params.seekerId || null}
      src={params.src}
    />
  );
}
