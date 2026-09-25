/**
 * withUnreadDivider — "여기부터 새 메시지" 구분선 위치
 */
import type { ChatMessage, ChatTimelineItem } from '@/types/chat';
import { withUnreadDivider } from '../ChatTimelineRow';

function item(id: string, createdAt: string, senderId: string): ChatTimelineItem {
  const message: ChatMessage = {
    id,
    conversationId: 'c',
    senderId,
    senderSide: 'seeker',
    senderDisplayName: 'n',
    kind: 'text',
    body: id,
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    clientMessageId: `c-${id}`,
    createdAt,
    deletedAt: null,
  };
  return { type: 'message', key: id, message };
}

const items = [
  item('a', '2026-09-25T09:01:00Z', 'other'),
  item('b', '2026-09-25T09:02:00Z', 'me'),
  item('c', '2026-09-25T09:03:00Z', 'other'),
];

describe('withUnreadDivider', () => {
  it('읽음 커서 뒤 첫 상대 메시지 앞에 넣는다(내 메시지는 건너뛴다)', () => {
    const rows = withUnreadDivider(items, '2026-09-25T09:01:30Z', 'me');
    expect(rows.map((r) => r.key)).toEqual(['a', 'b', 'divider', 'c']);
  });

  it('커서가 없으면(처음 들어온 방) 구분선 없음', () => {
    expect(withUnreadDivider(items, null, 'me').some((r) => r.type === 'divider')).toBe(false);
  });

  it('새 메시지가 맨 앞이면 구분선을 달지 않는다(전부 새 것)', () => {
    const rows = withUnreadDivider(items, '2026-09-25T08:00:00Z', 'me');
    expect(rows.some((r) => r.type === 'divider')).toBe(false);
  });
});
