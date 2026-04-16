// =============================================================================
// process-scheduled-deletions Edge Function
// =============================================================================
// 목적: 탈퇴 예약이 만료된 계정을 영구 삭제.
//       users WHERE status='deactivated' AND deletion_scheduled_for <= now()
//       → permanently_delete_user RPC 호출 (auth.users까지 CASCADE)
//
// 호출:
//   - 자동: pg_cron 매일 02:00 KST
//   - 수동: curl -X POST <fn_url> -H "Authorization: Bearer <service_role_key>"
//
// 인증: service_role 키 전용 (cron / admin 스크립트 전용)
//
// 응답:
//   {
//     processed: number,
//     succeeded: number,
//     failed: number,
//     results: [{ userId, status: 'ok'|'error', error?: string }]
//   }
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const responseHeaders = { 'Content-Type': 'application/json' };

interface UserRow {
  id: string;
  deletion_scheduled_for: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: responseHeaders,
    });
  }

  const expectedAuth = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || authHeader !== expectedAuth) {
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

    const { data: targets, error: queryError } = await client
      .from('users')
      .select('id, deletion_scheduled_for')
      .eq('status', 'deactivated')
      .not('deletion_scheduled_for', 'is', null)
      .lte('deletion_scheduled_for', new Date().toISOString())
      .limit(100)
      .returns<UserRow[]>();

    if (queryError) {
      console.error('users query failed', queryError);
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500,
        headers: responseHeaders,
      });
    }

    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ processed: 0, succeeded: 0, failed: 0, results: [] }), {
        status: 200,
        headers: responseHeaders,
      });
    }

    let succeeded = 0;
    let failed = 0;
    const results: Array<{ userId: string; status: string; error?: string }> = [];

    for (const target of targets) {
      try {
        const { error: rpcError } = await client.rpc('permanently_delete_user', {
          p_user_id: target.id,
        });

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        succeeded++;
        results.push({ userId: target.id, status: 'ok' });
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`deletion failed for ${target.id}`, msg);
        results.push({ userId: target.id, status: 'error', error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        processed: targets.length,
        succeeded,
        failed,
        results,
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('process-scheduled-deletions error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
