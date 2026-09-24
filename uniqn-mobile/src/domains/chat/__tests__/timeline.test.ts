/**
 * timeline — 과거 페이지 + 실시간 꼬리 + 아웃박스를 한 줄 타임라인으로 병합
 *
 * FlashList 2.0.2 는 inverted 가 없어 **오래된 → 최신 오름차순**으로 넘긴다.
 * 아웃박스 항목은 같은 clientMessageId 의 서버 행이 보이는 순간 사라져야 중복 말풍선이 없다.
 */
import type { ChatMessage, ChatOutboxItem } from '@/types/chat';
import { mergeChatTimeline } from '../timeline';

function msg(id: string, createdAt: string, clientMessageId = `c-${id}`): ChatMessage {
  return {
    id,
    conversationId: 'conv',
    senderId: 'u1',
    senderSide: 'seeker',
    senderDisplayName: '구직자 abcd',
    kind: 'text',
    body: id,
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    clientMessageId,
    createdAt,
    deletedAt: null,
  };
}

function outbox(
  clientMessageId: string,
  status: ChatOutboxItem['status'] = 'sending'
): ChatOutboxItem {
  return {
    clientMessageId,
    kind: 'text',
    body: clientMessageId,
    status,
    createdAtLocal: '2026-09-25T10:00:00.000Z',
  };
}

describe('mergeChatTimeline', () => {
  it('서버 메시지를 created_at 오름차순으로 정렬한다', () => {
    const pages = [[msg('b', '2026-09-25T09:02:00Z'), msg('a', '2026-09-25T09:01:00Z')]];
    const result = mergeChatTimeline(pages, [], []);
    expect(result.map((r) => r.key)).toEqual(['a', 'b']);
  });

  it('pages 와 tail 에 같은 id 가 있으면 한 번만 남긴다', () => {
    const shared = msg('b', '2026-09-25T09:02:00Z');
    const result = mergeChatTimeline(
      [[msg('a', '2026-09-25T09:01:00Z'), shared]],
      [shared, msg('c', '2026-09-25T09:03:00Z')],
      []
    );
    expect(result.map((r) => r.key)).toEqual(['a', 'b', 'c']);
  });

  it('같은 created_at 이면 id 로 순서를 고정한다', () => {
    const t = '2026-09-25T09:01:00Z';
    const result = mergeChatTimeline([[msg('y', t), msg('x', t)]], [], []);
    expect(result.map((r) => r.key)).toEqual(['x', 'y']);
  });

  it('아웃박스 항목은 서버 메시지 뒤에 붙는다', () => {
    const result = mergeChatTimeline([[msg('a', '2026-09-25T09:01:00Z')]], [], [outbox('local-1')]);
    expect(result.map((r) => r.type)).toEqual(['message', 'outbox']);
    expect(result[1]?.key).toBe('outbox:local-1');
  });

  it('서버 행에 같은 clientMessageId 가 나타나면 아웃박스 항목을 뺀다', () => {
    const result = mergeChatTimeline(
      [[msg('a', '2026-09-25T09:01:00Z', 'local-1')]],
      [],
      [outbox('local-1'), outbox('local-2', 'failed')]
    );
    expect(result.map((r) => r.key)).toEqual(['a', 'outbox:local-2']);
  });

  it('입력 배열을 변경하지 않는다', () => {
    const page = [msg('b', '2026-09-25T09:02:00Z'), msg('a', '2026-09-25T09:01:00Z')];
    const snapshot = page.map((m) => m.id);
    mergeChatTimeline([page], [], []);
    expect(page.map((m) => m.id)).toEqual(snapshot);
  });
});
