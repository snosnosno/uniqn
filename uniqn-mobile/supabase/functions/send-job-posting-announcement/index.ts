// =============================================================================
// send-job-posting-announcement Edge Function
// =============================================================================
// 목적: 구인공고 공지사항을 특정 스태프들에게 일괄 전송.
//       notifications 테이블에 대상 인원 수만큼 INSERT → Phase 1 트리거가
//       자동으로 push 발송.
//
// 권한: admin 또는 employer
//
// 입력 (JSON body):
//   {
//     jobPostingId: string (uuid),
//     title: string (max 50),
//     message: string (max 500),
//     targetStaffIds: string[] (max 1000),
//     jobPostingTitle?: string (optional, 미제공 시 DB에서 조회)
//   }
//
// 응답:
//   {
//     success: boolean,
//     successCount: number,
//     failedCount: number,
//     totalTargets: number,
//   }
//
// Firebase 차이:
//   - FCM multicast 생략 (Phase 1 trigger가 처리)
//   - jobPostingAnnouncements 추적 테이블 없음 (필요 시 후속 PR)
//   - 카테고리 비활성화 무시: notifications INSERT만으로 전원 수신
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const MAX_TITLE_LEN = 50;
const MAX_MESSAGE_LEN = 500;
const MAX_TARGETS = 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RequestBody {
  jobPostingId?: string;
  title?: string;
  message?: string;
  targetStaffIds?: string[];
  jobPostingTitle?: string;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: '인증이 필요합니다' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: '인증 실패' }, 401);
    }

    const role = user.app_metadata?.role;
    if (role !== 'admin' && role !== 'employer') {
      return jsonResponse({ error: '관리자 또는 구인자 권한이 필요합니다' }, 403);
    }

    const payload = (await req.json().catch(() => null)) as RequestBody | null;
    if (!payload) {
      return jsonResponse({ error: '잘못된 JSON 본문입니다' }, 400);
    }

    const jobPostingId = payload.jobPostingId?.trim();
    if (!jobPostingId || !UUID_REGEX.test(jobPostingId)) {
      return jsonResponse({ error: 'jobPostingId는 유효한 UUID여야 합니다' }, 400);
    }

    const title = payload.title?.trim();
    if (!title) {
      return jsonResponse({ error: '공지 제목이 필요합니다' }, 400);
    }
    if (title.length > MAX_TITLE_LEN) {
      return jsonResponse({ error: `공지 제목은 ${MAX_TITLE_LEN}자 이하여야 합니다` }, 400);
    }

    const message = payload.message?.trim();
    if (!message) {
      return jsonResponse({ error: '공지 내용이 필요합니다' }, 400);
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return jsonResponse({ error: `공지 내용은 ${MAX_MESSAGE_LEN}자 이하여야 합니다` }, 400);
    }

    const targetStaffIds = Array.isArray(payload.targetStaffIds)
      ? payload.targetStaffIds.filter(
          (id): id is string => typeof id === 'string' && UUID_REGEX.test(id)
        )
      : [];
    if (targetStaffIds.length === 0) {
      return jsonResponse({ error: '대상 스태프가 필요합니다' }, 400);
    }
    if (targetStaffIds.length > MAX_TARGETS) {
      return jsonResponse({ error: `한 번에 최대 ${MAX_TARGETS}명에게만 전송할 수 있습니다` }, 400);
    }
    const uniqueTargets = [...new Set(targetStaffIds)];

    // 공고 검증 (employer인 경우 본인 공고만 허용)
    const { data: posting, error: postingError } = await serviceClient
      .from('job_postings')
      .select('id, title, owner_id')
      .eq('id', jobPostingId)
      .single();

    if (postingError || !posting) {
      return jsonResponse({ error: '공고를 찾을 수 없습니다' }, 404);
    }

    if (role === 'employer' && posting.owner_id !== user.id) {
      return jsonResponse({ error: '본인 공고에만 공지를 보낼 수 있습니다' }, 403);
    }

    const actualJobPostingTitle = payload.jobPostingTitle?.trim() || posting.title || '공고';
    const notificationTitle = `📢 [${actualJobPostingTitle}] ${title}`;

    // notifications 일괄 INSERT
    const rows = uniqueTargets.map((staffId) => ({
      recipient_id: staffId,
      type: 'announcement',
      category: 'system',
      title: notificationTitle,
      body: message,
      link: `/jobs/${jobPostingId}`,
      data: {
        type: 'announcement',
        jobPostingId,
        jobPostingTitle: actualJobPostingTitle,
        senderId: user.id,
      },
      priority: 'high',
    }));

    const { data: inserted, error: insertError } = await serviceClient
      .from('notifications')
      .insert(rows)
      .select('id');

    if (insertError) {
      console.error('notifications insert failed', insertError);
      return jsonResponse({ error: '알림 INSERT 실패', detail: insertError.message }, 500);
    }

    return jsonResponse(
      {
        success: true,
        successCount: inserted?.length ?? 0,
        failedCount: uniqueTargets.length - (inserted?.length ?? 0),
        totalTargets: uniqueTargets.length,
      },
      200
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('send-job-posting-announcement error', msg);
    return jsonResponse({ error: msg }, 500);
  }
});
