/**
 * 채팅 Repository 배럴 — 싱글톤 + 타입 재노출. 소비자는 `@/repositories/chat` 에서 import.
 * (workSchedule.ts·ops.ts 전용 모듈 관행과 동일 — 중앙 배럴 비대화 회피.)
 */
import { SupabaseChatRepository } from './supabase/ChatRepository';

export type {
  IChatRepository,
  ChatSendInput,
  ChatMessageCursor,
} from './interfaces/IChatRepository';
export { SupabaseChatRepository } from './supabase/ChatRepository';

/** 프로덕션 싱글톤 */
export const chatRepository = new SupabaseChatRepository();
