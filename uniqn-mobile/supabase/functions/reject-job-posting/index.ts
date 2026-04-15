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

    if (user.app_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: '관리자 권한이 필요합니다' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { jobPostingId, reason } = await req.json();
    if (!jobPostingId || typeof jobPostingId !== 'string') {
      return new Response(JSON.stringify({ error: 'jobPostingId가 필요합니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return new Response(JSON.stringify({ error: '거절 사유는 10자 이상이어야 합니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: posting, error: fetchError } = await supabase
      .from('job_postings')
      .select('id, type, tournament_config')
      .eq('id', jobPostingId)
      .single();

    if (fetchError || !posting) {
      return new Response(JSON.stringify({ error: '공고를 찾을 수 없습니다' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (posting.type !== 'tournament') {
      return new Response(JSON.stringify({ error: '토너먼트 공고만 거절할 수 있습니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (posting.tournament_config?.approvalStatus !== 'pending') {
      return new Response(JSON.stringify({ error: '대기 중인 공고만 거절할 수 있습니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const updatedConfig = {
      ...posting.tournament_config,
      approvalStatus: 'rejected',
      rejectedBy: user.id,
      rejectedAt: now,
      rejectionReason: reason.trim(),
    };

    const { error: updateError } = await supabase
      .from('job_postings')
      .update({ tournament_config: updatedConfig, updated_at: now })
      .eq('id', jobPostingId);

    if (updateError) {
      return new Response(JSON.stringify({ error: '거절 처리에 실패했습니다' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobPostingId,
        rejectedBy: user.id,
        rejectedAt: now,
        reason: reason.trim(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
