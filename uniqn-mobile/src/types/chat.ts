/**
 * UNIQN Mobile — 앱 내 채팅 타입
 *
 * @description 서버 계약은 `supabase/migrations/20260925100000_chat_schema_and_rpcs.sql`(S1).
 * 행은 snake_case 로 오고, Repository 가 zod 로 검증하며 camelCase 로 바꾼다.
 */

/** 대화 참여 쪽. `system` 은 발신자 전용(서버 생성 메시지) */
export type ChatSide = 'seeker' | 'employer';
export type ChatSenderSide = ChatSide | 'system';

/** 메시지 종류 — 클라가 보낼 수 있는 것은 text·image 뿐 */
export type ChatMessageKind = 'text' | 'image' | 'announcement' | 'system';
export type ChatSendKind = 'text' | 'image';

/** 목록 RPC `chat_list_conversations` 한 행(10컬럼) */
export interface ChatConversationSummary {
  conversationId: string;
  jobPostingId: string;
  postingTitle: string;
  /** 공고가 hard-delete 되면 null */
  postingStatus: string | null;
  counterpartName: string;
  mySide: ChatSide;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  /** 99 캡 */
  unreadCount: number;
  /** S4 차단 자리 — S1 은 항상 false */
  blocked: boolean;
}

/** `chat_conversations` 한 행(RLS SELECT) */
export interface ChatConversationMeta {
  id: string;
  jobPostingId: string;
  seekerId: string | null;
  seekerDisplayName: string;
  employerDisplayName: string;
  postingTitle: string;
  lastMessageAt: string | null;
}

/** `chat_messages` 한 행(RLS SELECT) */
export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderSide: ChatSenderSide;
  senderDisplayName: string;
  kind: ChatMessageKind;
  body: string;
  imagePath: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  clientMessageId: string;
  createdAt: string;
  deletedAt: string | null;
}

/** `chat_send_message` 반환 */
export interface ChatSendResult {
  messageId: string;
  createdAt: string;
  deduped: boolean;
}

/** 아직 서버에 없는 내 메시지(낙관적 표시·재전송용 — 방 화면 로컬 상태) */
export interface ChatOutboxItem {
  clientMessageId: string;
  kind: ChatSendKind;
  body: string;
  /** sent = 서버가 받았지만 아직 꼬리 조회에 안 잡힘(타임라인 병합이 서버 행을 보면 뺀다) */
  status: 'sending' | 'failed' | 'sent';
  errorMessage?: string;
  createdAtLocal: string;
}

/** 타임라인 한 줄 — 서버 메시지 또는 아웃박스 항목 */
export type ChatTimelineItem =
  | { type: 'message'; key: string; message: ChatMessage }
  | { type: 'outbox'; key: string; item: ChatOutboxItem };

/** `chat_open` 계측 method — 어느 진입점에서 방을 열었나 */
export type ChatOpenMethod =
  | 'job_detail'
  | 'work_tab'
  | 'applicants'
  | 'posting_tile'
  | 'board_tab'
  | 'list';
