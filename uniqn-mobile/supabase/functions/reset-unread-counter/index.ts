import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: '인증 실패' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 카운터를 0으로 리셋 (notification_counters 테이블)
    const { error: updateError } = await supabase.from('notification_counters').upsert({
      user_id: user.id,
      unread_count: 0,
      updated_at: new Date().toISOString(),
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: '카운터 리셋 실패' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 선택적: 알림의 _batchUpdate 플래그 정리
    const body = await req.json().catch(() => ({}));
    const notificationIds = body?.notificationIds;
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      const validIds = notificationIds
        .filter((id: unknown) => typeof id === 'string' && id.length <= 128)
        .slice(0, 500);

      if (validIds.length > 0) {
        // 모든 알림을 읽음 처리
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('recipient_id', user.id)
          .in('id', validIds)
          .then(() => {});
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
