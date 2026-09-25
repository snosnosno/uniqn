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
  ChatSafetyState,
  ChatSanitizedImage,
  ChatSendKind,
  ChatSendResult,
} from '@/types/chat';
import type { ChatReportReason } from '@/constants/chat';

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

/** (S4) 메시지 신고 입력 — 서비스가 검증을 마친 값 */
export interface ChatReportInput {
  messageId: string;
  reason: ChatReportReason;
  detail: string | null;
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

  /** (S2b→S4 M1) 사진을 접수 창구(inbox)에 올린다 — 같은 경로가 이미 있으면(재전송) 성공으로 본다 */
  uploadImage(path: string, bytes: ArrayBuffer): Promise<void>;
  /** (S4 M1) 정화 EF — inbox 의 사진을 걸러 chat-media 로 옮긴다(멱등) */
  sanitizeImage(path: string): Promise<ChatSanitizedImage>;
  /** (S2b) 사진 서명 URL */
  createSignedImageUrl(path: string, expiresInSec: number): Promise<string>;

  /** (S4) 내 알림 끄기/켜기 */
  setMuted(conversationId: string, muted: boolean): Promise<void>;
  /** (S4) 방 단위 차단(이미 차단이면 no-op) */
  block(conversationId: string): Promise<void>;
  /** (S4) 차단 해제 — 막은 쪽만 */
  unblock(conversationId: string): Promise<void>;
  /** (S4) 메시지 신고 → report id */
  reportMessage(input: ChatReportInput): Promise<string>;
  /** (S4) 방 안전 상태(차단 행 + 내 뮤트) */
  getSafetyState(conversationId: string): Promise<ChatSafetyState>;
}
