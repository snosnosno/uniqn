// =============================================================================
// poll-push-receipts Edge Function (감사 push-02)
// =============================================================================
// 목적: Expo push **receipt** 를 회수해 push_tickets 에 기록하고, 죽은 토큰을 정리한다.
//
// 왜 필요한가:
//   send 응답의 ticket 은 "Expo 가 접수했다"일 뿐 **전달 보증이 아니다**.
//   실제 전달 실패(DeviceNotRegistered / MessageTooBig / MessageRateExceeded 등)는
//   receipt 로만 드러난다. 종전에는 ticket 을 저장조차 하지 않아 receipts 폴링이
//   구조적으로 불가능했고, DB 쪽 전달 관측이 0이었다.
//
// 호출 방식: pg_cron 잡 poll-push-receipts 가 15분마다 POST (마이그 20260809150000)
// 인증: service_role 키 필수
//
// ⚠️ Expo 권고 — ticket 발급 직후에는 receipt 가 준비되지 않는다. 최소 15분 지난 것만 집는다.
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { Expo, ExpoPushReceipt } from 'npm:expo-server-sdk@3.14.0';

const responseHeaders = { 'Content-Type': 'application/json' };

/** ticket 발급 후 이 시간이 지나야 receipt 를 조회한다(Expo 권고). */
const RECEIPT_MIN_AGE_MINUTES = 15;
/** 한 번의 크론 실행이 처리할 상한. 넘치면 다음 실행이 이어받는다(조용한 절단 아님 — 응답에 남긴다). */
const MAX_TICKETS_PER_RUN = 1000;

interface PendingTicketRow {
  id: string;
  token: string;
  expo_ticket_id: string;
}

async function fetchPendingTickets(client: SupabaseClient): Promise<PendingTicketRow[]> {
  const cutoff = new Date(Date.now() - RECEIPT_MIN_AGE_MINUTES * 60_000).toISOString();

  const { data, error } = await client
    .from('push_tickets')
    .select('id, token, expo_ticket_id')
    .eq('status', 'ok')
    .is('receipt_checked_at', null)
    .not('expo_ticket_id', 'is', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_TICKETS_PER_RUN);

  if (error) throw new Error(`push_tickets fetch failed: ${error.message}`);
  return (data ?? []) as PendingTicketRow[];
}

async function markChecked(
  client: SupabaseClient,
  rowId: string,
  receipt: ExpoPushReceipt | null
): Promise<void> {
  const now = new Date().toISOString();
  const patch =
    receipt === null
      ? // Expo 가 아직 영수증을 안 만들었거나 만료됐다. 무한 재조회를 막기 위해 확인 시각만 남긴다.
        { receipt_checked_at: now, receipt_status: null }
      : {
          receipt_checked_at: now,
          receipt_status: receipt.status,
          receipt_error_code: receipt.status === 'error' ? (receipt.details?.error ?? null) : null,
        };

  const { error } = await client.from('push_tickets').update(patch).eq('id', rowId);
  if (error) console.error(`push_tickets update failed (${rowId})`, error.message);
}

async function removeInvalidToken(client: SupabaseClient, token: string): Promise<void> {
  const { error } = await client.from('fcm_tokens').delete().eq('token', token);
  if (error) console.error('remove invalid token failed', error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: responseHeaders,
    });
  }

  const expectedAuth = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`;
  if (req.headers.get('Authorization') !== expectedAuth) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: responseHeaders,
    });
  }

  try {
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const expo = new Expo();

    const pending = await fetchPendingTickets(client);
    if (pending.length === 0) {
      return new Response(JSON.stringify({ checked: 0, reason: 'no pending tickets' }), {
        status: 200,
        headers: responseHeaders,
      });
    }

    const byTicketId = new Map<string, PendingTicketRow>();
    for (const row of pending) byTicketId.set(row.expo_ticket_id, row);

    const chunks = expo.chunkPushNotificationReceiptIds([...byTicketId.keys()]);

    let okCount = 0;
    let errorCount = 0;
    let removedTokens = 0;
    let unresolved = 0;

    for (const chunk of chunks) {
      let receipts: Record<string, ExpoPushReceipt> | null = null;
      try {
        receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      } catch (err) {
        // 이 chunk 는 다음 크론 실행이 다시 집는다(receipt_checked_at 을 안 찍으므로).
        console.error('getPushNotificationReceiptsAsync failed', err);
        continue;
      }

      for (const ticketId of chunk) {
        const row = byTicketId.get(ticketId);
        if (!row) continue;

        const receipt = receipts[ticketId] ?? null;
        await markChecked(client, row.id, receipt);

        if (receipt === null) {
          unresolved++;
          continue;
        }
        if (receipt.status === 'ok') {
          okCount++;
          continue;
        }

        errorCount++;
        const errorCode = receipt.details?.error;
        // 전달 실패 중 "이 기기는 더 이상 없다"만 토큰 정리 대상이다.
        // MessageRateExceeded 같은 일시 오류로 토큰을 지우면 멀쩡한 사용자가 푸시를 잃는다.
        if (errorCode === 'DeviceNotRegistered') {
          await removeInvalidToken(client, row.token);
          removedTokens++;
          console.warn(`removed token via receipt: ${row.token.substring(0, 20)}...`);
        } else {
          console.error(`push receipt error (${errorCode}): ${receipt.message ?? ''}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        checked: pending.length,
        delivered: okCount,
        failed: errorCount,
        unresolved,
        removedTokens,
        // 상한에 걸렸으면 남은 분량이 있다는 뜻 — 다음 실행이 이어받는다.
        truncated: pending.length === MAX_TICKETS_PER_RUN,
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('poll-push-receipts error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
