// =============================================================================
// send-system-announcement Edge Function
// =============================================================================
// 목적: 전체 사용자(또는 target_audience 필터 대상)에게 시스템 공지 발송.
//       announcements 테이블에 이미 저장된 row를 기준으로 notifications를
//       대량 INSERT → Phase 1 트리거가 자동으로 push.
//
// 권한: admin 전용
//
// 입력 (JSON body):
//   { announcementId: string (uuid) }
//
// 응답:
//   {
//     success: boolean,
//     announcementId: string,
//     successCount: number,
//     totalUsers: number,
//   }
//
// Firebase 차이:
//   - FCM multicast 생략 (Phase 1 trigger가 처리)
//   - 알림 설정 카테고리 무시: notifications INSERT만으로 전원 수신
//   - target_audience.type === 'role' 인 경우 role 필터링 지원
//   - body는 200자로 truncate (Expo payload 크기 제한 고려)
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BODY_TRUNCATE = 200;
const INSERT_CHUNK = 500;

interface RequestBody {
  announcementId?: string;
}

interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  priority: number | null;
  target_audience: { type?: string; roles?: string[] } | null;
  author_id: string | null;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function mapPriority(priorityNum: number | null): string {
  // announcements.priority는 정수 (0=normal, 1=important, 2=urgent)
  if (priorityNum === null || priorityNum <= 0) return 'normal';
  if (priorityNum === 1) return 'high';
  return 'urgent';
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

    if (user.app_metadata?.role !== 'admin') {
      return jsonResponse({ error: '관리자 권한이 필요합니다' }, 403);
    }

    const payload = (await req.json().catch(() => null)) as RequestBody | null;
    const announcementId = payload?.announcementId?.trim();
    if (!announcementId || !UUID_REGEX.test(announcementId)) {
      return jsonResponse({ error: 'announcementId는 유효한 UUID여야 합니다' }, 400);
    }

    const { data: announcement, error: fetchError } = await serviceClient
      .from('announcements')
      .select('id, title, content, priority, target_audience, author_id')
      .eq('id', announcementId)
      .single<AnnouncementRow>();

    if (fetchError || !announcement) {
      return jsonResponse({ error: '공지사항을 찾을 수 없습니다' }, 404);
    }

    // 대상 사용자 조회
    const audienceType = announcement.target_audience?.type ?? 'all';
    const audienceRoles = Array.isArray(announcement.target_audience?.roles)
      ? announcement.target_audience!.roles!
      : [];

    let userQuery = serviceClient.from('users').select('id').neq('id', user.id);
    if (audienceType === 'role' && audienceRoles.length > 0) {
      userQuery = userQuery.in('role', audienceRoles);
    }

    const { data: users, error: usersError } = await userQuery;
    if (usersError) {
      console.error('users fetch failed', usersError);
      return jsonResponse({ error: '사용자 조회 실패', detail: usersError.message }, 500);
    }

    const totalUsers = users?.length ?? 0;
    if (totalUsers === 0) {
      return jsonResponse(
        {
          success: true,
          announcementId,
          successCount: 0,
          totalUsers: 0,
          reason: 'no target users',
        },
        200
      );
    }

    const body =
      announcement.content.length > BODY_TRUNCATE
        ? announcement.content.substring(0, BODY_TRUNCATE) + '...'
        : announcement.content;
    const notifTitle = `📢 ${announcement.title}`;
    const priority = mapPriority(announcement.priority);

    // 500개씩 chunk로 INSERT (Postgres transaction 크기 보호)
    let successCount = 0;
    for (let i = 0; i < users!.length; i += INSERT_CHUNK) {
      const chunk = users!.slice(i, i + INSERT_CHUNK);
      const rows = chunk.map((u) => ({
        recipient_id: u.id,
        type: 'announcement',
        category: 'system',
        title: notifTitle,
        body,
        link: '/notices',
        data: {
          type: 'announcement',
          announcementId,
          senderId: user.id,
        },
        priority,
      }));

      const { data: inserted, error: insertError } = await serviceClient
        .from('notifications')
        .insert(rows)
        .select('id');

      if (insertError) {
        console.error(`chunk ${i} insert failed`, insertError);
        continue;
      }

      successCount += inserted?.length ?? 0;
    }

    return jsonResponse(
      {
        success: true,
        announcementId,
        successCount,
        totalUsers,
      },
      200
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('send-system-announcement error', msg);
    return jsonResponse({ error: msg }, 500);
  }
});
