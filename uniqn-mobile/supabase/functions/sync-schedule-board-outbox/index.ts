// =============================================================================
// T-B9: sync-schedule-board-outbox Edge Function
// =============================================================================
// 목적: schedule_board_sync_outbox 테이블의 pending 행을 처리. 각 행에 대해
//       sync_schedule_board(p_job_posting_id) PL/pgSQL RPC를 호출하여 board sync
//       자체는 단일 트랜잭션으로 race-free 실행. 본 함수는 polling + retry +
//       status 전이만 책임짐.
//
// 호출 방식:
//   - 수동: curl -X POST <function_url> (admin/cron)
//   - 자동: Supabase scheduled function (cron) — 30초 주기 권장
//
// 인증: Authorization 헤더 검증. service_role 키 필요 (cron은 자동 첨부).
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 10;
const MAX_RETRY = 3;
const SLACK_WEBHOOK = Deno.env.get('SLACK_OUTBOX_ALERT_WEBHOOK');

interface OutboxRow {
  id: string;
  job_posting_id: string;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ProcessResult {
  id: string;
  job_posting_id: string;
  outcome: 'success' | 'retry' | 'failed_retry_limit';
  error?: string;
  retry_count?: number;
}

async function fetchPending(client: SupabaseClient): Promise<OutboxRow[]> {
  const { data, error } = await client
    .from('schedule_board_sync_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    throw new Error(`outbox fetch failed: ${error.message}`);
  }
  return (data ?? []) as OutboxRow[];
}

async function markProcessing(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from('schedule_board_sync_outbox')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending'); // optimistic — 이미 다른 worker가 처리 중이면 no-op
  if (error) throw new Error(`mark processing failed: ${error.message}`);
}

async function applySync(client: SupabaseClient, jobPostingId: string): Promise<void> {
  // 핵심: sync_schedule_board RPC가 board_posts + board_memberships를
  // 단일 PostgreSQL 트랜잭션으로 처리. race-free root resolution.
  const { data, error } = await client.rpc('sync_schedule_board', {
    p_job_posting_id: jobPostingId,
  });

  if (error) {
    throw new Error(`sync_schedule_board RPC failed: ${error.message}`);
  }

  const result = data as { success?: boolean; archived?: boolean; error?: string } | null;
  if (!result?.success) {
    throw new Error(`sync_schedule_board returned non-success: ${JSON.stringify(result)}`);
  }
}

async function markSuccess(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from('schedule_board_sync_outbox')
    .update({
      status: 'success',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(`mark success failed: ${error.message}`);
}

async function markRetryOrFailed(
  client: SupabaseClient,
  id: string,
  currentRetryCount: number,
  errorMessage: string
): Promise<'retry' | 'failed_retry_limit'> {
  const nextRetryCount = currentRetryCount + 1;
  const reachedLimit = nextRetryCount > MAX_RETRY;
  const nextStatus = reachedLimit ? 'failed_retry_limit' : 'pending';

  const { error } = await client
    .from('schedule_board_sync_outbox')
    .update({
      status: nextStatus,
      retry_count: nextRetryCount,
      error_message: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`mark retry failed: ${error.message}`);
  return reachedLimit ? 'failed_retry_limit' : 'retry';
}

// T-B11: failed_retry_limit 행 발생 시 Slack 알림.
// SLACK_OUTBOX_ALERT_WEBHOOK 환경변수 미설정 시 silent skip — 시스템은 정상 동작.
async function sendSlackAlert(failed: ProcessResult[]): Promise<void> {
  if (!SLACK_WEBHOOK || failed.length === 0) return;

  const lines = failed.map(
    (r) => `• \`${r.id}\` (job_posting=${r.job_posting_id}): ${r.error ?? 'unknown'}`
  );
  const text = [
    `:rotating_light: *outbox failed_retry_limit* (${failed.length}건)`,
    ...lines,
    `_check: SELECT * FROM schedule_board_sync_outbox WHERE status = 'failed_retry_limit';_`,
  ].join('\n');

  try {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error('slack alert failed', err);
  }
}

async function processRow(client: SupabaseClient, row: OutboxRow): Promise<ProcessResult> {
  try {
    await markProcessing(client, row.id);
    await applySync(client, row.job_posting_id);
    await markSuccess(client, row.id);
    return { id: row.id, job_posting_id: row.job_posting_id, outcome: 'success' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const outcome = await markRetryOrFailed(client, row.id, row.retry_count, message);
    return {
      id: row.id,
      job_posting_id: row.job_posting_id,
      outcome,
      error: message,
      retry_count: row.retry_count + 1,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 인증: Authorization 헤더 확인 (cron 또는 admin only)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const pending = await fetchPending(client);
    if (pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0, success: 0, retried: 0, failed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 직렬 처리 — race 방지 + retry 카운터 정확성
    const results: ProcessResult[] = [];
    for (const row of pending) {
      const result = await processRow(client, row);
      results.push(result);
    }

    const summary = {
      processed: results.length,
      success: results.filter((r) => r.outcome === 'success').length,
      retried: results.filter((r) => r.outcome === 'retry').length,
      failed: results.filter((r) => r.outcome === 'failed_retry_limit').length,
      results,
    };

    // T-B11: failed_retry_limit 행 발생 시 Slack 알림 (webhook 미설정 시 silent)
    const failedRows = results.filter((r) => r.outcome === 'failed_retry_limit');
    if (failedRows.length > 0) {
      await sendSlackAlert(failedRows);
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('sync-schedule-board-outbox error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
