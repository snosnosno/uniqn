/**
 * UNIQN Mobile — 앱 내 채팅 서비스 (쓰기)
 *
 * 방 열기와 보내기를 **분리**해 둔다. 새 방에서 열기는 성공하고 보내기가 실패하면, 재전송은
 * 받은 방 id 로 보내기만 해야 한다(열기를 다시 부르면 새 방 한도 토큰을 또 쓴다 — 서버는 멱등이지만
 * 호출 자체를 줄인다). 두 호출을 잇는 쪽은 훅(useSendChatMessage)이다.
 *
 * clientMessageId 는 호출자가 만든다. 서비스가 새로 만들면 재전송이 멱등이 아니게 된다.
 */
import { ERROR_CODES, ValidationError } from '@/errors/AppError';
import { chatRepository } from '@/repositories/chat';
import { chatTextBodySchema } from '@/schemas/chat.schema';
import type { ChatSendResult } from '@/types/chat';

export interface SendTextInput {
  conversationId: string;
  clientMessageId: string;
  body: string;
}

export interface OpenConversationInput {
  jobPostingId: string;
  /** 구인자가 지원자에게 걸 때만. 구직자 본인이면 생략 */
  seekerId?: string | null;
}

function validateBody(body: string): string {
  const parsed = chatTextBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: parsed.error.issues[0]?.message ?? '메시지를 확인해 주세요',
    });
  }
  return parsed.data;
}

async function sendText(input: SendTextInput): Promise<ChatSendResult> {
  const body = validateBody(input.body);
  return chatRepository.sendMessage({
    conversationId: input.conversationId,
    kind: 'text',
    body,
    clientMessageId: input.clientMessageId,
  });
}

export interface SendImageInput {
  conversationId: string;
  clientMessageId: string;
  /** uploadChatImage 가 돌려준 경로 */
  imagePath: string;
  width: number;
  height: number;
}

/** 이미 올린 사진을 메시지로 보낸다(순서: 방 열기 → 업로드 → 보내기 — 설계 §4) */
async function sendImage(input: SendImageInput): Promise<ChatSendResult> {
  return chatRepository.sendMessage({
    conversationId: input.conversationId,
    kind: 'image',
    body: '',
    clientMessageId: input.clientMessageId,
    imagePath: input.imagePath,
    imageWidth: input.width,
    imageHeight: input.height,
  });
}

function openConversation(input: OpenConversationInput): Promise<string> {
  return chatRepository.openConversation(input.jobPostingId, input.seekerId ?? null);
}

function markRead(conversationId: string, lastMessageId: string): Promise<void> {
  return chatRepository.markRead(conversationId, lastMessageId);
}

function hide(conversationId: string): Promise<void> {
  return chatRepository.hideConversation(conversationId);
}

export const chatService = {
  sendText,
  sendImage,
  openConversation,
  markRead,
  hide,
} as const;
