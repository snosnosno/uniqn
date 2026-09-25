/**
 * /chat → 소통 탭의 '채팅' 칸으로 (결정 D-c — 목록은 탭 안에 산다)
 * `?postingId=` 는 그대로 넘긴다(공고 관리 타일·S3 딥링크 호환).
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ChatIndexRedirect() {
  const { postingId } = useLocalSearchParams<{ postingId?: string }>();
  return (
    <Redirect
      href={{
        pathname: '/(app)/(tabs)/board/chat',
        params: postingId ? { postingId } : {},
      }}
    />
  );
}
