/**
 * 채팅 안전 상태 판정 (S4) — 뮤트·차단 쪽·신고 가능 여부
 *
 * 순수 함수만 둔다. 서버 규칙과 짝:
 * - 뮤트: `chat_set_muted` 가 `muted_until` 을 'infinity' 또는 NULL 로 둔다.
 * - 차단: 쪽별 1행(`blocked_by_side`) — 한 행이라도 있으면 차단. 해제는 자기 쪽 행만.
 * - 신고: 상대 쪽 메시지만 · 탈퇴자 불가(서버가 한 번 더 거른다 — 여기는 버튼 노출 판단용).
 */
import type { ChatMessage, ChatSide } from '@/types/chat';

export type ChatBlockState = 'none' | 'mine' | 'theirs';

/** PostgREST 는 timestamptz 'infinity' 를 문자열 그대로 준다 */
export function isChatMuted(mutedUntil: string | null, now: number = Date.now()): boolean {
  if (!mutedUntil) return false;
  if (mutedUntil === 'infinity') return true;
  const until = Date.parse(mutedUntil);
  return !Number.isNaN(until) && until > now;
}

/**
 * 차단 상태. 내 쪽을 아직 모르면 'theirs' 로 본다 — 해제 버튼은 막은 쪽에만 보여야 하므로
 * 모를 때는 보이지 않는 쪽이 안전하다(해제 권한은 서버가 다시 확인한다).
 */
export function chatBlockState(
  blockedBySides: readonly ChatSide[],
  mySide: ChatSide | null
): ChatBlockState {
  if (blockedBySides.length === 0) return 'none';
  // 양쪽 모두 막았으면 'mine' — 내 것은 풀 수 있고, 풀면 상대 차단만 남아 'theirs' 가 된다
  return mySide && blockedBySides.includes(mySide) ? 'mine' : 'theirs';
}

/** 길게 눌러 신고할 수 있는 메시지인가 — 상대 쪽의 살아 있는 텍스트·사진만 */
export function isReportableMessage(message: ChatMessage, mySide: ChatSide | null): boolean {
  if (!mySide || message.deletedAt !== null || !message.senderId) return false;
  if (message.kind !== 'text' && message.kind !== 'image') return false;
  return message.senderSide !== 'system' && message.senderSide !== mySide;
}
