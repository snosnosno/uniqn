// =============================================================================
// cleanup-orphan-accounts Edge Function
// =============================================================================
// 목적: auth.users 레코드는 있으나 public.users 레코드가 없는 "고아 계정"
//       을 주기적으로 정리. 회원가입 도중 롤백 실패 등으로 발생.
//
// 호출:
//   - 자동: pg_cron 매주 일요일 02:23 KST
//   - 수동: curl -X POST <fn_url> -H "Authorization: Bearer <service_role_key>"
//
// 인증: service_role 키 전용
//
// 정책:
//   - 생성 후 7일 이상 경과 + public.users 없음 → auth.users 삭제
//   - app_config.key='orphan_cleanup_state'에 last_processed_page 저장해
//     실행 간 이어가기. 새 유저는 페이지 1에 추가되므로 주기적으로 cursor reset.
//   - 실행당 최대 10 페이지(1000건) 또는 runtime 120초까지 처리.
//
// 응답:
//   {
//     scanned: number,
//     deleted: number,
//     failed: number,
//     startPage: number,
//     endPage: number,
//     resumed: boolean
//   }
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const responseHeaders = { 'Content-Type': 'application/json' };
const ORPHAN_AGE_DAYS = 7;
const PAGE_SIZE = 100;
const MAX_PAGES_PER_RUN = 10; // 실행당 최대 1000건
const RUNTIME_BUDGET_MS = 120_000; // 2분
const STATE_KEY = 'orphan_cleanup_state';

interface CleanupState {
  last_processed_page: number;
  last_run_at: string;
}

async function loadState(client: SupabaseClient): Promise<CleanupState> {
  const { data } = await client
    .from('app_config')
    .select('value')
    .eq('key', STATE_KEY)
    .maybeSingle();

  const stored = data?.value as CleanupState | undefined;
  if (!stored || typeof stored.last_processed_page !== 'number') {
    return { last_processed_page: 0, last_run_at: new Date(0).toISOString() };
  }
  return stored;
}

async function saveState(client: SupabaseClient, state: CleanupState): Promise<void> {
  const { error } = await client.from('app_config').upsert(
    {
      key: STATE_KEY,
      value: state,
      description: 'cleanup-orphan-accounts 실행 cursor',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) console.error('state save failed', error);
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();

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

    // 이전 실행 cursor 로드 — 없으면 페이지 1부터 시작
    const state = await loadState(client);
    const startPage = state.last_processed_page + 1; // 다음 페이지부터
    const cutoffMs = Date.now() - ORPHAN_AGE_DAYS * 24 * 60 * 60 * 1000;

    let scanned = 0;
    let deleted = 0;
    let failed = 0;
    let endPage = state.last_processed_page;
    let exhaustedResults = false;

    for (let offset = 0; offset < MAX_PAGES_PER_RUN; offset++) {
      // runtime budget 체크
      if (Date.now() - startedAt > RUNTIME_BUDGET_MS) {
        console.warn('runtime budget exceeded, stopping');
        break;
      }

      const page = startPage + offset;
      const { data: pageData, error: listError } = await client.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });

      if (listError) {
        console.error('listUsers failed', listError);
        break;
      }

      const users = pageData?.users ?? [];
      if (users.length === 0) {
        exhaustedResults = true;
        endPage = page;
        break;
      }

      endPage = page;
      const candidates = users.filter((u) => new Date(u.created_at).getTime() <= cutoffMs);
      scanned += candidates.length;

      if (candidates.length > 0) {
        const userIds = candidates.map((u) => u.id);
        const { data: existingProfiles, error: profileError } = await client
          .from('users')
          .select('id')
          .in('id', userIds);

        if (profileError) {
          console.error('users profile query failed', profileError);
          break;
        }

        const existingIds = new Set((existingProfiles ?? []).map((r) => r.id));
        const orphans = candidates.filter((u) => !existingIds.has(u.id));

        for (const orphan of orphans) {
          try {
            const { error: delError } = await client.auth.admin.deleteUser(orphan.id);
            if (delError) throw new Error(delError.message);
            deleted++;
          } catch (err) {
            failed++;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`orphan delete failed for ${orphan.id}`, msg);
          }
        }
      }

      if (users.length < PAGE_SIZE) {
        exhaustedResults = true;
        break;
      }
    }

    // cursor 저장: 전체 페이지 소진 시 0으로 리셋 (다음 주에 처음부터)
    const nextCursor = exhaustedResults ? 0 : endPage;
    await saveState(client, {
      last_processed_page: nextCursor,
      last_run_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        scanned,
        deleted,
        failed,
        startPage,
        endPage,
        resumed: startPage > 1,
        exhaustedResults,
        runtimeMs: Date.now() - startedAt,
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('cleanup-orphan-accounts error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
