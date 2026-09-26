/**
 * 채팅 타임라인 한 줄 렌더 — 서버 메시지 / 아웃박스 / "새 메시지" 구분선
 */
import React from 'react';
import { ChatOutboxBubble, ChatServerBubble, ChatUnreadDivider } from './ChatMessageBubble';
import { isChatNoticeMessage } from '@/domains/chat';
import type { ChatMessage, ChatTimelineItem } from '@/types/chat';

export type ChatRow = ChatTimelineItem | { type: 'divider'; key: 'divider' };

interface ChatTimelineRowProps {
  row: ChatRow;
  myUid: string | undefined;
  showSenderName: boolean;
  onRetry: (clientMessageId: string) => void;
  onDiscard: (clientMessageId: string) => void;
  /** (S4) 이 메시지를 신고할 수 있으면 길게 누를 때 부른다 — 판정은 호출자 */
  onLongPressMessage?: (message: ChatMessage) => void;
  canReport?: (message: ChatMessage) => boolean;
}

export function ChatTimelineRow({
  row,
  myUid,
  showSenderName,
  onRetry,
  onDiscard,
  onLongPressMessage,
  canReport,
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
      onLongPress={onLongPressMessage && canReport?.(row.message) ? onLongPressMessage : undefined}
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

/**
 * 상대 말풍선 위에 이름을 달 줄의 key 모음 — 양쪽 화면 공통(카톡식).
 * 같은 사람이 연달아 보내면 묶음의 첫 말풍선에만 단다. 내 메시지·아웃박스·안내 줄·구분선을
 * 만나면 묶음이 끊긴다(구분선 뒤 첫 말풍선엔 다시 단다).
 * 탈퇴자(senderId null — FK SET NULL)는 누가 누군지 모르므로 매 말풍선에 단다. 그래서 "묶음 없음"
 * 표시는 null 이 아니라 undefined 로 둔다(null 과 겹치면 탈퇴자 첫 말풍선에 이름이 안 달린다).
 */
export function senderNameRowKeys(rows: ChatRow[], myUid: string | undefined): Set<string> {
  const keys = new Set<string>();
  let prevSender: string | undefined;
  for (const row of rows) {
    if (row.type !== 'message' || isChatNoticeMessage(row.message)) {
      prevSender = undefined;
      continue;
    }
    const { senderId } = row.message;
    const isMine = !!myUid && senderId === myUid;
    if (!isMine && (senderId === null || senderId !== prevSender)) keys.add(row.key);
    prevSender = isMine || senderId === null ? undefined : senderId;
  }
  return keys;
}
