/**
 * drainChatMediaDeletionQueue — 채팅 사진 삭제 큐 비우기 (설계 §4-2 M7)
 * 가짜 클라이언트로 "성공한 묶음만 큐에서 지우고, 실패한 묶음은 재시도 표시" 계약을 잠근다.
 */
import {
  drainChatMediaDeletionQueue,
  REMOVE_CHUNK,
  type ChatMediaQueueClient,
  type QueueRow,
} from '../chatMediaQueue.ts';

function makeClient(rows: QueueRow[], failBuckets: string[] = []) {
  const removed: Array<{ bucket: string; names: string[] }> = [];
  const deleted: Array<{ bucket: string; names: string[] }> = [];
  const updates: Array<{ bucket: string; name: string; values: Record<string, unknown> }> = [];

  const client: ChatMediaQueueClient = {
    from: () => ({
      select: () => ({
        order: () => ({ limit: async (n: number) => ({ data: rows.slice(0, n), error: null }) }),
      }),
      delete: () => ({
        eq: (_c: string, bucket: string) => ({
          in: async (_c2: string, names: string[]) => {
            deleted.push({ bucket, names });
            return { error: null };
          },
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: (_c: string, bucket: string) => ({
          eq: async (_c2: string, name: string) => {
            updates.push({ bucket, name, values });
            return { error: null };
          },
        }),
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        remove: async (names: string[]) => {
          removed.push({ bucket, names });
          return failBuckets.includes(bucket)
            ? { error: { message: 'storage down' } }
            : { error: null };
        },
      }),
    },
  };
  return { client, removed, deleted, updates };
}

const row = (bucket: string, i: number, attempts = 0): QueueRow => ({
  bucket_id: bucket,
  object_name: `a/b/${i}.jpg`,
  attempts,
});

describe('drainChatMediaDeletionQueue', () => {
  it('버킷별로 Storage API 로 지우고, 성공한 경로만 큐에서 뺀다', async () => {
    const rows = [row('chat-media', 1), row('chat-media-inbox', 2), row('chat-media', 3)];
    const { client, removed, deleted } = makeClient(rows);

    await expect(drainChatMediaDeletionQueue(client)).resolves.toEqual({ removed: 3, failed: 0 });
    expect(removed).toEqual([
      { bucket: 'chat-media', names: ['a/b/1.jpg', 'a/b/3.jpg'] },
      { bucket: 'chat-media-inbox', names: ['a/b/2.jpg'] },
    ]);
    expect(deleted).toEqual(removed);
  });

  it(`한 번에 ${REMOVE_CHUNK}개씩 나눠 지운다`, async () => {
    const rows = Array.from({ length: REMOVE_CHUNK + 5 }, (_, i) => row('chat-media', i));
    const { client, removed } = makeClient(rows);

    await drainChatMediaDeletionQueue(client);
    expect(removed.map((r) => r.names.length)).toEqual([REMOVE_CHUNK, 5]);
  });

  it('Storage 실패 묶음은 큐에 남기고 attempts·last_error 를 올린다(다음 날 재시도)', async () => {
    const rows = [row('chat-media', 1, 2), row('chat-media-inbox', 2)];
    const { client, deleted, updates } = makeClient(rows, ['chat-media']);

    await expect(drainChatMediaDeletionQueue(client)).resolves.toEqual({ removed: 1, failed: 1 });
    expect(deleted).toEqual([{ bucket: 'chat-media-inbox', names: ['a/b/2.jpg'] }]);
    expect(updates).toEqual([
      {
        bucket: 'chat-media',
        name: 'a/b/1.jpg',
        values: { attempts: 3, last_error: 'storage down' },
      },
    ]);
  });

  it('빈 큐면 아무것도 지우지 않는다', async () => {
    const { client, removed } = makeClient([]);
    await expect(drainChatMediaDeletionQueue(client)).resolves.toEqual({ removed: 0, failed: 0 });
    expect(removed).toEqual([]);
  });
});
