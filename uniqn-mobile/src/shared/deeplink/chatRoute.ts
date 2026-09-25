import type { DeepLinkRoute } from './types';

/** 채팅방 id — 서버는 소문자 정규 uuid 로 쓴다. 대소문자는 받아 주고 소문자로 정규화한다 */
const CHAT_CONVERSATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 방 id → 채팅방 라우트. uuid 가 아니거나 없으면 채팅 목록.
 * 딥링크 파서(`/chat/{id}`)와 알림 매핑(data.conversationId)이 같은 규칙을 쓰게 하는 단일 소스다.
 */
export function toChatRoute(conversationId?: string | null): DeepLinkRoute {
  return conversationId && CHAT_CONVERSATION_ID_PATTERN.test(conversationId)
    ? { name: 'chat', params: { conversationId: conversationId.toLowerCase() } }
    : { name: 'chat/list' };
}
