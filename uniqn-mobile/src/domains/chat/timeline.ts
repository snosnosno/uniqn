/**
 * timeline — 과거 페이지 + 실시간 꼬리 + 아웃박스 병합 (순수 함수)
 *
 * FlashList 2.0.2 에는 `inverted` 가 없어 **오래된 → 최신 오름차순**으로 넘긴다.
 * 같은 방 안의 created_at 은 서버가 잠금 뒤 clock_timestamp() 로 찍어 엄격 증가하지만,
 * 방어적으로 id 를 2차 정렬 키로 둔다.
 */
import type { ChatMessage, ChatOutboxItem, ChatTimelineItem } from '@/types/chat';

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * @param pages 과거 페이지들(각 페이지 정렬 무관)
 * @param tail 실시간 꼬리(정렬 무관)
 * @param outbox 아직 서버에 없는 내 메시지(입력 순서 유지)
 */
export function mergeChatTimeline(
  pages: readonly (readonly ChatMessage[])[],
  tail: readonly ChatMessage[],
  outbox: readonly ChatOutboxItem[]
): ChatTimelineItem[] {
  const byId = new Map<string, ChatMessage>();
  for (const page of pages) {
    for (const m of page) byId.set(m.id, m);
  }
  for (const m of tail) byId.set(m.id, m);

  const messages = [...byId.values()].sort(compareMessages);
  const delivered = new Set(messages.map((m) => m.clientMessageId));

  const serverItems: ChatTimelineItem[] = messages.map((message) => ({
    type: 'message',
    key: message.id,
    message,
  }));
  const pendingItems: ChatTimelineItem[] = outbox
    .filter((item) => !delivered.has(item.clientMessageId))
    .map((item) => ({ type: 'outbox', key: `outbox:${item.clientMessageId}`, item }));

  return [...serverItems, ...pendingItems];
}
