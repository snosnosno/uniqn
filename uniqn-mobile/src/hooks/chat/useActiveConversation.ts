/**
 * 채팅방 화면이 떠 있는 동안 그 방을 "보고 있는 방"으로 등록한다(S3 — 포그라운드 푸시 억제).
 * 새 방은 첫 전송 뒤에 id 가 생기므로 id 가 바뀔 때마다 다시 등록한다.
 */
import { useEffect } from 'react';
import { useChatPresenceStore } from '@/stores/chatPresenceStore';

export function useActiveConversation(conversationId: string | null): void {
  useEffect(() => {
    if (!conversationId) return;
    const { setActiveConversationId, clearActiveConversationId } = useChatPresenceStore.getState();
    setActiveConversationId(conversationId);
    return () => clearActiveConversationId(conversationId);
  }, [conversationId]);
}
