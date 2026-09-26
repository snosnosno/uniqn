/**
 * withUnreadDivider — "여기부터 새 메시지" 구분선 위치
 * senderNameRowKeys — 상대 말풍선 이름을 달 줄(묶음의 첫 말풍선)
 */
import type { ChatMessage, ChatTimelineItem } from '@/types/chat';
import { senderNameRowKeys, withUnreadDivider, type ChatRow } from '../ChatTimelineRow';

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

describe('senderNameRowKeys', () => {
  const t = (n: number) => `2026-09-25T09:0${n}:00Z`;

  it('같은 사람이 연달아 보내면 첫 말풍선에만 이름 — 양쪽 화면 공통', () => {
    const rows: ChatRow[] = [
      item('a1', t(1), 'seekerA'),
      item('a2', t(2), 'seekerA'),
      item('m1', t(3), 'me'),
      item('a3', t(4), 'seekerA'),
    ];
    expect([...senderNameRowKeys(rows, 'me')]).toEqual(['a1', 'a3']);
  });

  it('상대 쪽 발신자가 바뀌면 다시 단다(구인자 측 여러 명)', () => {
    const rows: ChatRow[] = [
      item('o1', t(1), 'owner'),
      item('e1', t(2), 'editor'),
      item('o2', t(3), 'owner'),
    ];
    expect([...senderNameRowKeys(rows, 'me')]).toEqual(['o1', 'e1', 'o2']);
  });

  it('탈퇴자(senderId null) 말풍선엔 매번 단다 — 서로 다른 탈퇴자를 한 묶음으로 합치지 않는다', () => {
    const gone = (id: string, n: number): ChatRow => {
      const base = item(id, t(n), 'x');
      return base.type === 'message'
        ? { ...base, message: { ...base.message, senderId: null } }
        : base;
    };
    const rows: ChatRow[] = [gone('g1', 1), gone('g2', 2), item('a1', t(3), 'seekerA')];
    expect([...senderNameRowKeys(rows, 'me')]).toEqual(['g1', 'g2', 'a1']);
  });

  it('구분선·안내 줄 뒤 첫 말풍선엔 다시 단다, 내 메시지엔 달지 않는다', () => {
    const base = item('n1', t(2), 'system');
    const notice: ChatRow =
      base.type === 'message' ? { ...base, message: { ...base.message, kind: 'system' } } : base;
    const rows: ChatRow[] = [
      item('a1', t(1), 'seekerA'),
      { type: 'divider', key: 'divider' },
      item('a2', t(3), 'seekerA'),
      notice,
      item('a3', t(4), 'seekerA'),
      item('m1', t(5), 'me'),
    ];
    expect([...senderNameRowKeys(rows, 'me')]).toEqual(['a1', 'a2', 'a3']);
  });
});
