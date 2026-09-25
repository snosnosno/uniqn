/**
 * outbox 리듀서 — 실패·재전송 상태 전이
 */
import type { ChatOutboxItem } from '@/types/chat';
import { chatOutboxReducer } from '../outbox';

const item: ChatOutboxItem = {
  clientMessageId: 'c1',
  kind: 'text',
  body: '안녕',
  status: 'sending',
  createdAtLocal: '2026-09-25T09:00:00.000Z',
};

describe('chatOutboxReducer', () => {
  it('enqueue 는 같은 clientMessageId 를 두 번 넣지 않는다', () => {
    const once = chatOutboxReducer([], { type: 'enqueue', item });
    const twice = chatOutboxReducer(once, { type: 'enqueue', item });
    expect(twice).toHaveLength(1);
  });

  it('실패 → 재전송 → 성공, clientMessageId 는 끝까지 같다', () => {
    let state = chatOutboxReducer([], { type: 'enqueue', item });
    state = chatOutboxReducer(state, {
      type: 'markFailed',
      clientMessageId: 'c1',
      errorMessage: '네트워크',
    });
    expect(state[0]).toMatchObject({ status: 'failed', errorMessage: '네트워크' });

    state = chatOutboxReducer(state, { type: 'retry', clientMessageId: 'c1' });
    expect(state[0]).toMatchObject({ clientMessageId: 'c1', status: 'sending' });
    expect(state[0]?.errorMessage).toBeUndefined();

    state = chatOutboxReducer(state, { type: 'markSent', clientMessageId: 'c1' });
    expect(state[0]).toMatchObject({ clientMessageId: 'c1', status: 'sent' });
  });

  it('상태를 변경하지 않고 새 배열을 만든다', () => {
    const before = [item];
    const after = chatOutboxReducer(before, { type: 'markSent', clientMessageId: 'c1' });
    expect(after).not.toBe(before);
    expect(before[0]?.status).toBe('sending');
  });

  it('remove 는 해당 항목만 뺀다', () => {
    const state = chatOutboxReducer([item, { ...item, clientMessageId: 'c2' }], {
      type: 'remove',
      clientMessageId: 'c1',
    });
    expect(state.map((i) => i.clientMessageId)).toEqual(['c2']);
  });

  it('setStage 는 사진 진행 단계만 바꾸고 나머지는 보존한다', () => {
    const photo = {
      ...item,
      kind: 'image' as const,
      image: { localUri: 'file:///a', width: 1, height: 1 },
    };
    const state = chatOutboxReducer([photo], {
      type: 'setStage',
      clientMessageId: 'c1',
      stage: 'uploading',
    });
    expect(state[0]).toMatchObject({ stage: 'uploading', status: 'sending', image: photo.image });
  });
});
