import { isAppError } from '@/core/errors/AppError';

const FALLBACK = '문제가 발생했어요. 잠시 후 다시 시도해 주세요.';

/** 화면에 보여줄 한글 문구. AppError 가 아니면 원문 대신 일반 문구(서버 영문 노출 방지). */
export function toUserMessage(error: unknown): string {
  return isAppError(error) ? error.userMessage : FALLBACK;
}
