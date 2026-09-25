/**
 * 채팅 사진 삭제 큐 비우기 — `chat_media_deletion_queue` → Storage API remove (설계 §4-2 M7)
 *
 * 탈퇴 익명화(S4)·보존 purge·고아 정리(S5-b)가 경로를 적재하면, 크론 EF process-scheduled-deletions 가
 * 매일 이 함수로 지운다. storage.objects 행만 SQL 로 지우면 실제 파일이 남으므로 반드시 Storage API.
 *
 * 멱등: Storage remove 는 없는 파일도 성공으로 돌려준다 → 성공한 묶음의 큐 행만 지운다.
 *       실패한 묶음은 attempts +1 · last_error 를 남기고 다음 날 다시 시도한다.
 *
 * ⚠️ Deno 비의존(클라이언트는 주입) — jest 로 검증한다.
 */

export interface QueueRow {
  bucket_id: string;
  object_name: string;
  attempts: number;
}

interface QueryError {
  message: string;
}

/** 필요한 supabase-js 표면만 — 테스트에서 가짜로 대신한다 */
export interface ChatMediaQueueClient {
  from(table: 'chat_media_deletion_queue'): {
    select(columns: string): {
      order(
        column: string,
        opts: { ascending: boolean }
      ): {
        limit(n: number): PromiseLike<{ data: QueueRow[] | null; error: QueryError | null }>;
      };
    };
    delete(): {
      eq(
        column: string,
        value: string
      ): {
        in(column: string, values: string[]): PromiseLike<{ error: QueryError | null }>;
      };
    };
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string
      ): {
        eq(column: string, value: string): PromiseLike<{ error: QueryError | null }>;
      };
    };
  };
  storage: {
    from(bucket: string): {
      remove(paths: string[]): PromiseLike<{ error: QueryError | null }>;
    };
  };
}

export interface DrainResult {
  removed: number;
  failed: number;
}

const QUEUE = 'chat_media_deletion_queue' as const;
/**
 * 한 번에 처리할 경로 수. 큐 행 삭제는 PostgREST `in` 필터라 경로가 **URL** 에 실린다
 * (경로 ≈ 114자). 100개면 약 11.5KB 로 게이트웨이 요청줄 한도에 걸릴 수 있어 20개로 묶는다(DB 리뷰 M3).
 */
export const REMOVE_CHUNK = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function markFailed(
  client: ChatMediaQueueClient,
  rows: QueueRow[],
  message: string
): Promise<void> {
  for (const row of rows) {
    await client
      .from(QUEUE)
      .update({ attempts: row.attempts + 1, last_error: message.slice(0, 500) })
      .eq('bucket_id', row.bucket_id)
      .eq('object_name', row.object_name);
  }
}

/** 큐에서 오래된 순으로 최대 limit 개를 지운다 */
export async function drainChatMediaDeletionQueue(
  client: ChatMediaQueueClient,
  limit = 500
): Promise<DrainResult> {
  const { data, error } = await client
    .from(QUEUE)
    .select('bucket_id, object_name, attempts')
    .order('enqueued_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`삭제 큐 조회 실패: ${error.message}`);

  const byBucket = new Map<string, QueueRow[]>();
  for (const row of data ?? []) {
    byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row]);
  }

  let removed = 0;
  let failed = 0;
  for (const [bucket, rows] of byBucket) {
    for (const part of chunk(rows, REMOVE_CHUNK)) {
      const names = part.map((r) => r.object_name);
      const { error: removeError } = await client.storage.from(bucket).remove(names);
      if (removeError) {
        failed += part.length;
        await markFailed(client, part, removeError.message);
        continue;
      }
      const { error: deleteError } = await client
        .from(QUEUE)
        .delete()
        .eq('bucket_id', bucket)
        .in('object_name', names);
      if (deleteError) throw new Error(`삭제 큐 정리 실패: ${deleteError.message}`);
      removed += part.length;
    }
  }
  return { removed, failed };
}
