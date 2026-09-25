/**
 * UNIQN Mobile — 앱 내 채팅 Repository (Supabase)
 *
 * 🚨 supabase 클라이언트는 Database 제네릭이 없어 rpc 이름·인자를 tsc 가 검사하지 않는다 —
 *    계약은 `__tests__/ChatRepository.test.ts` 가 S1 마이그 시그니처로 고정한다.
 * 🔑 uuid 는 전부 소문자로 보낸다. 사진 경로는 서버가 `format('%s/%s/%s.jpg', …)` 과 완전 일치로
 *    대조하므로 대문자가 섞이면 CHAT_IMAGE_INVALID 가 된다.
 * 🔑 에러: 채팅 매퍼(`mapChatRpcError`) 먼저 → 못 잡으면 `handleSupabaseError`.
 */
import { supabase } from '@/lib/supabase';
import { mapChatRpcError } from '@/errors/chat';
import { handleSupabaseError } from '@/utils/supabase';
import {
  CHAT_CONVERSATION_COLUMNS,
  CHAT_MESSAGE_COLUMNS,
  chatConversationRowSchema,
  chatListRowSchema,
  chatMessageRowSchema,
  chatSendResultSchema,
  chatUuidSchema,
} from '@/schemas/chat.schema';
import type {
  ChatConversationMeta,
  ChatConversationSummary,
  ChatMessage,
  ChatSendResult,
} from '@/types/chat';
import type {
  ChatMessageCursor,
  ChatSendInput,
  IChatRepository,
} from '../interfaces/IChatRepository';

function fail(error: unknown, operation: string, table = 'chat'): never {
  const mapped = mapChatRpcError(error);
  if (mapped) throw mapped;
  handleSupabaseError(error, { operation, table });
}

const lower = (id: string) => chatUuidSchema.parse(id);

/** PostgREST 가 timestamptz '-infinity' 를 문자열로 준다 — 읽은 적 없음 */
function toReadCursor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function parseMessages(rows: unknown): ChatMessage[] {
  return (Array.isArray(rows) ? rows : []).map((row) => chatMessageRowSchema.parse(row));
}

export class SupabaseChatRepository implements IChatRepository {
  async openConversation(jobPostingId: string, seekerId: string | null): Promise<string> {
    const { data, error } = await supabase.rpc('chat_open_conversation', {
      p_job_posting_id: lower(jobPostingId),
      p_seeker_id: seekerId ? lower(seekerId) : null,
    });
    if (error) fail(error, 'chat_open_conversation');
    return chatUuidSchema.parse(data);
  }

  async sendMessage(input: ChatSendInput): Promise<ChatSendResult> {
    const { data, error } = await supabase.rpc('chat_send_message', {
      p_conversation_id: lower(input.conversationId),
      p_kind: input.kind,
      p_body: input.body,
      p_image_path: input.imagePath ?? null,
      p_image_width: input.imageWidth ?? null,
      p_image_height: input.imageHeight ?? null,
      p_client_message_id: lower(input.clientMessageId),
    });
    if (error) fail(error, 'chat_send_message');
    return chatSendResultSchema.parse(data);
  }

  async markRead(conversationId: string, lastMessageId: string): Promise<void> {
    const { error } = await supabase.rpc('chat_mark_read', {
      p_conversation_id: lower(conversationId),
      p_last_message_id: lastMessageId,
    });
    if (error) fail(error, 'chat_mark_read');
  }

  async hideConversation(conversationId: string): Promise<void> {
    const { error } = await supabase.rpc('chat_hide_conversation', {
      p_conversation_id: lower(conversationId),
    });
    if (error) fail(error, 'chat_hide_conversation');
  }

  async listConversations(params: {
    limit: number;
    before: string | null;
  }): Promise<ChatConversationSummary[]> {
    const { data, error } = await supabase.rpc('chat_list_conversations', {
      p_limit: params.limit,
      p_before: params.before,
    });
    if (error) fail(error, 'chat_list_conversations');
    return (Array.isArray(data) ? data : []).map((row) => chatListRowSchema.parse(row));
  }

  async getUnreadTotal(): Promise<number> {
    const { data, error } = await supabase.rpc('chat_unread_total');
    if (error) fail(error, 'chat_unread_total');
    return typeof data === 'number' ? data : 0;
  }

  async getConversation(conversationId: string): Promise<ChatConversationMeta | null> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select(CHAT_CONVERSATION_COLUMNS)
      .eq('id', lower(conversationId))
      .maybeSingle();
    if (error) fail(error, 'getConversation', 'chat_conversations');
    return data ? chatConversationRowSchema.parse(data) : null;
  }

  async findConversation(jobPostingId: string, seekerId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('job_posting_id', lower(jobPostingId))
      .eq('seeker_id', lower(seekerId))
      .maybeSingle();
    if (error) fail(error, 'findConversation', 'chat_conversations');
    const id = (data as { id?: unknown } | null)?.id;
    return typeof id === 'string' ? id : null;
  }

  async getReadCursor(conversationId: string): Promise<string | null> {
    // RLS(chat_read_states_select_own)가 본인 행만 보여 준다 — user_id 필터 불필요
    const { data, error } = await supabase
      .from('chat_read_states')
      .select('last_read_at')
      .eq('conversation_id', lower(conversationId))
      .maybeSingle();
    if (error) fail(error, 'getReadCursor', 'chat_read_states');
    return toReadCursor((data as { last_read_at?: unknown } | null)?.last_read_at);
  }

  async getMessagesPage(
    conversationId: string,
    cursor: ChatMessageCursor | null,
    limit: number
  ): Promise<ChatMessage[]> {
    let query = supabase
      .from('chat_messages')
      .select(CHAT_MESSAGE_COLUMNS)
      .eq('conversation_id', lower(conversationId));
    if (cursor) {
      // 인덱스 chat_msg_conv_time_idx (conversation_id, created_at DESC, id DESC) 와 같은 순서
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);
    if (error) fail(error, 'getMessagesPage', 'chat_messages');
    return parseMessages(data);
  }

  async getMessagesAfter(
    conversationId: string,
    afterIso: string,
    limit: number
  ): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(CHAT_MESSAGE_COLUMNS)
      .eq('conversation_id', lower(conversationId))
      .gt('created_at', afterIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit);
    if (error) fail(error, 'getMessagesAfter', 'chat_messages');
    return parseMessages(data);
  }
}
