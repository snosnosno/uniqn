/**
 * 채팅 타임라인 한 줄 렌더 — 서버 메시지 / 아웃박스 / "새 메시지" 구분선
 */
import React from 'react';
import { ChatOutboxBubble, ChatServerBubble, ChatUnreadDivider } from './ChatMessageBubble';
import type { ChatTimelineItem } from '@/types/chat';

export type ChatRow = ChatTimelineItem | { type: 'divider'; key: 'divider' };

interface ChatTimelineRowProps {
  row: ChatRow;
  myUid: string | undefined;
  showSenderName: boolean;
  onRetry: (clientMessageId: string) => void;
  onDiscard: (clientMessageId: string) => void;
}

export function ChatTimelineRow({
  row,
  myUid,
  showSenderName,
  onRetry,
  onDiscard,
}: ChatTimelineRowProps) {
  if (row.type === 'divider') return <ChatUnreadDivider />;
  if (row.type === 'outbox') {
    return <ChatOutboxBubble item={row.item} onRetry={onRetry} onDiscard={onDiscard} />;
  }
  return (
    <ChatServerBubble
      message={row.message}
      isMine={!!myUid && row.message.senderId === myUid}
      showSenderName={showSenderName}
    />
  );
}

/**
 * 진입 시점 읽음 커서 뒤 첫 **상대** 메시지 앞에 구분선을 끼운다.
 * 커서가 없으면(처음 들어온 방) 구분선 없음.
 */
export function withUnreadDivider(
  items: ChatTimelineItem[],
  readCursor: string | null,
  myUid: string | undefined
): ChatRow[] {
  if (!readCursor) return items;
  const index = items.findIndex(
    (item) =>
      item.type === 'message' &&
      item.message.createdAt > readCursor &&
      item.message.senderId !== myUid
  );
  if (index <= 0) return items;
  return [...items.slice(0, index), { type: 'divider', key: 'divider' }, ...items.slice(index)];
}
