/**
 * 앱 내 채팅 Repository 인터페이스
 *
 * 쓰기는 전부 RPC(S1 `20260925100000_chat_schema_and_rpcs.sql`), 읽기는 목록·배지 RPC +
 * RLS SELECT(메시지·방 메타·내 읽음 커서).
 */
import type {
  ChatConversationMeta,
  ChatConversationSummary,
  ChatMessage,
  ChatSendKind,
  ChatSendResult,
} from '@/types/chat';

export interface ChatSendInput {
  conversationId: string;
  kind: ChatSendKind;
  body: string;
  clientMessageId: string;
  imagePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

/** 과거 페이지 keyset 커서 — 이 메시지보다 오래된 것 */
export interface ChatMessageCursor {
  createdAt: string;
  id: string;
}

export interface IChatRepository {
  /** 방 열기(멱등). seekerId 가 null 이면 호출자 본인이 구직자 */
  openConversation(jobPostingId: string, seekerId: string | null): Promise<string>;
  sendMessage(input: ChatSendInput): Promise<ChatSendResult>;
  markRead(conversationId: string, lastMessageId: string): Promise<void>;
  hideConversation(conversationId: string): Promise<void>;
  listConversations(params: {
    limit: number;
    before: string | null;
  }): Promise<ChatConversationSummary[]>;
  getUnreadTotal(): Promise<number>;

  getConversation(conversationId: string): Promise<ChatConversationMeta | null>;
  /** (공고, 구직자) 의 기존 방 id — 없으면 null */
  findConversation(jobPostingId: string, seekerId: string): Promise<string | null>;
  /** 내 읽음 시각 — 읽은 적 없으면 null */
  getReadCursor(conversationId: string): Promise<string | null>;
  /** 최신순(내림차순) 한 페이지 */
  getMessagesPage(
    conversationId: string,
    cursor: ChatMessageCursor | null,
    limit: number
  ): Promise<ChatMessage[]>;
  /** anchor 이후 메시지 오름차순 */
  getMessagesAfter(conversationId: string, afterIso: string, limit: number): Promise<ChatMessage[]>;
}
