/**
 * UNIQN Mobile — 앱 내 채팅 스키마
 *
 * - 입력: 텍스트 본문(1~1000자 + XSS), uuid(소문자 정규화 — 사진 경로가 서버에서 완전 일치해야 한다)
 * - 외부 경계: 서버 행(snake_case) → camelCase. 모양이 틀린 행은 조용히 쓰지 않고 거부한다.
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_REPORT_DETAIL_MAX_LENGTH,
  CHAT_REPORT_REASONS,
} from '@/constants/chat';

export const chatTextBodySchema = z
  .string()
  .trim()
  .min(1, { message: '메시지를 입력해 주세요' })
  .max(CHAT_MESSAGE_MAX_LENGTH, {
    message: `메시지는 ${CHAT_MESSAGE_MAX_LENGTH}자까지 보낼 수 있어요`,
  })
  .refine(xssValidation, {
    // 서버 check_xss_fields 와 같은 기준 — 정상 문장이 걸리면 표현을 바꿔 보내도록 안내
    message: '보낼 수 없는 표현이 들어 있어요. 꺾쇠(<, >)나 스크립트 형태를 빼고 보내 주세요',
  });

export const chatUuidSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, {
    message: '잘못된 식별자예요',
  });

const isoString = z.string().min(1);

/** (S4) 메시지 신고 입력 — 설명은 선택(비면 null), 500자 + XSS */
export const chatReportInputSchema = z.object({
  messageId: chatUuidSchema,
  reason: z.enum(CHAT_REPORT_REASONS, { message: '신고 사유를 골라 주세요' }),
  detail: z
    .string()
    .trim()
    .max(CHAT_REPORT_DETAIL_MAX_LENGTH, {
      message: `설명은 ${CHAT_REPORT_DETAIL_MAX_LENGTH}자까지 쓸 수 있어요`,
    })
    .refine(xssValidation, {
      message: '쓸 수 없는 표현이 들어 있어요. 꺾쇠(<, >)나 스크립트 형태를 빼 주세요',
    })
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const chatListRowSchema = z
  .object({
    conversation_id: z.string(),
    job_posting_id: z.string(),
    posting_title: z.string(),
    posting_status: z.string().nullable(),
    counterpart_name: z.string(),
    my_side: z.enum(['seeker', 'employer']),
    last_message_at: isoString,
    last_message_preview: z.string().nullable(),
    unread_count: z.number().int().min(0),
    blocked: z.boolean(),
  })
  .transform((r) => ({
    conversationId: r.conversation_id,
    jobPostingId: r.job_posting_id,
    postingTitle: r.posting_title,
    postingStatus: r.posting_status,
    counterpartName: r.counterpart_name,
    mySide: r.my_side,
    lastMessageAt: r.last_message_at,
    lastMessagePreview: r.last_message_preview,
    unreadCount: r.unread_count,
    blocked: r.blocked,
  }));

export const chatConversationRowSchema = z
  .object({
    id: z.string(),
    job_posting_id: z.string(),
    seeker_id: z.string().nullable(),
    seeker_display_name: z.string(),
    employer_display_name: z.string(),
    posting_title: z.string(),
    last_message_at: isoString.nullable(),
  })
  .transform((r) => ({
    id: r.id,
    jobPostingId: r.job_posting_id,
    seekerId: r.seeker_id,
    seekerDisplayName: r.seeker_display_name,
    employerDisplayName: r.employer_display_name,
    postingTitle: r.posting_title,
    lastMessageAt: r.last_message_at,
  }));

export const chatMessageRowSchema = z
  .object({
    id: z.string(),
    conversation_id: z.string(),
    sender_id: z.string().nullable(),
    sender_side: z.enum(['seeker', 'employer', 'system']),
    sender_display_name: z.string(),
    kind: z.enum(['text', 'image', 'announcement', 'system']),
    body: z.string(),
    image_path: z.string().nullable(),
    image_width: z.number().int().nullable(),
    image_height: z.number().int().nullable(),
    client_message_id: z.string(),
    created_at: isoString,
    deleted_at: isoString.nullable(),
  })
  .transform((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderSide: r.sender_side,
    senderDisplayName: r.sender_display_name,
    kind: r.kind,
    body: r.body,
    imagePath: r.image_path,
    imageWidth: r.image_width,
    imageHeight: r.image_height,
    clientMessageId: r.client_message_id,
    createdAt: r.created_at,
    deletedAt: r.deleted_at,
  }));

/** `chat_send_message` 반환 jsonb */
export const chatSendResultSchema = z.object({
  messageId: z.string(),
  createdAt: isoString,
  deduped: z.boolean(),
});

/** (S4 M1) 정화 EF 성공 응답 — 서버가 다시 잰 크기(1~2048) */
export const chatSanitizedImageSchema = z.object({
  path: z.string().min(1),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

/** (S4) `chat_blocks` 한 행 중 클라가 읽는 컬럼(GRANT 된 것만) */
export const chatBlockRowSchema = z.object({
  blocked_by_side: z.enum(['seeker', 'employer']),
});

/** `chat_messages` SELECT 컬럼(행 파서와 1:1) */
export const CHAT_MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, sender_side, sender_display_name, kind, body, image_path, image_width, image_height, client_message_id, created_at, deleted_at';

/** `chat_conversations` SELECT 컬럼(행 파서와 1:1) */
export const CHAT_CONVERSATION_COLUMNS =
  'id, job_posting_id, seeker_id, seeker_display_name, employer_display_name, posting_title, last_message_at';
