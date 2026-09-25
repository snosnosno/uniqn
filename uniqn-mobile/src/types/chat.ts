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
  /** (S4) 이 방이 차단 상태인가(어느 쪽이 막았든) */
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
  /** false = 다시 해도 같은 결과(사진 거부·상대 탈퇴 등) — 재전송 버튼을 숨긴다 */
  retryable?: boolean;
  createdAtLocal: string;
  /** (S2b) 사진 — 원본 로컬 uri 와 크기(말풍선 비율용). 서버에 올라가는 것은 재인코딩본이다 */
  image?: { localUri: string; width: number; height: number };
  /** (S2b) 사진 진행 단계 — status 가 sending 일 때만 의미 있음 */
  stage?: ChatOutboxStage;
}

export type ChatOutboxStage = 'preparing' | 'uploading' | 'sending';

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

/** (S4) 방 안전 상태 — `chat_blocks` 행 + 내 `chat_read_states.muted_until` */
export interface ChatSafetyState {
  /** 막은 쪽들 — 서버는 쪽별 1행(보안 리뷰 M1). 차단이 없으면 빈 배열 */
  blockedBySides: readonly ChatSide[];
  /** PostgREST 원문('infinity' 포함). 뮤트가 아니면 null */
  mutedUntil: string | null;
}

/** (S4 M1) 정화 EF 성공 응답 — 전송 RPC 에는 이 width/height 를 쓴다 */
export interface ChatSanitizedImage {
  path: string;
  width: number;
  height: number;
}
