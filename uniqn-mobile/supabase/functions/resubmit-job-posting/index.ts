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

    const { jobPostingId } = await req.json();
    if (!jobPostingId || typeof jobPostingId !== 'string') {
      return new Response(JSON.stringify({ error: 'jobPostingId가 필요합니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: posting, error: fetchError } = await supabase
      .from('job_postings')
      .select('id, type, owner_id, tournament_config')
      .eq('id', jobPostingId)
      .single();

    if (fetchError || !posting) {
      return new Response(JSON.stringify({ error: '공고를 찾을 수 없습니다' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (posting.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: '본인의 공고만 재제출할 수 있습니다' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (posting.type !== 'tournament') {
      return new Response(JSON.stringify({ error: '토너먼트 공고만 재제출할 수 있습니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (posting.tournament_config?.approvalStatus !== 'rejected') {
      return new Response(JSON.stringify({ error: '거절된 공고만 재제출할 수 있습니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const updatedConfig = {
      ...posting.tournament_config,
      approvalStatus: 'pending',
      resubmittedAt: now,
    };
    // 거절 관련 필드 제거
    delete updatedConfig.rejectedBy;
    delete updatedConfig.rejectedAt;
    delete updatedConfig.rejectionReason;

    const { error: updateError } = await supabase
      .from('job_postings')
      .update({ tournament_config: updatedConfig, updated_at: now })
      .eq('id', jobPostingId);

    if (updateError) {
      return new Response(JSON.stringify({ error: '재제출 처리에 실패했습니다' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, jobPostingId, resubmittedAt: now }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
