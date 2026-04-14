import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    // 인증 헤더가 없으면 0을 반환 (graceful 캘덙)
    if (!authHeader) {
      return new Response(JSON.stringify({ unreadCount: 0 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // 세션에서 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // 인증 안된 사용자면 0을 반환 (graceful 캘덙)
    if (authError || !user) {
      return new Response(JSON.stringify({ unreadCount: 0 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // notification_counters 테이블에서 캐시된 카운터 조회
    const { data: counterRow } = await supabase
      .from('notification_counters')
      .select('unread_count')
      .eq('user_id', user.id)
      .maybeSingle();

    if (counterRow !== null) {
      return new Response(JSON.stringify({ unreadCount: counterRow.unread_count ?? 0 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 캐시 없으면 notifications 테이블에서 직접 계산
    const { data: countResult } = await supabase.rpc('get_unread_notification_count', {
      p_user_id: user.id,
    });

    const unreadCount = (countResult as number) ?? 0;

    // 계산 결과를 notification_counters에 upsert
    await supabase
      .from('notification_counters')
      .upsert({ user_id: user.id, unread_count: unreadCount, updated_at: new Date().toISOString() });

    return new Response(JSON.stringify({ unreadCount }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('initialize-unread-counter error:', err);
    // 에러 시에도 0으로 graceful 캘낙
    return new Response(JSON.stringify({ unreadCount: 0 }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
