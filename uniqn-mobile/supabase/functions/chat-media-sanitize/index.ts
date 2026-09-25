/**
 * 채팅 사진 서버 정화 — 접수함(chat-media-inbox) → 정화 → chat-media (보안 M1)
 *
 * 비유: 접수 창구에 놓인 액자를 직원이 받아 뒷면 메모(EXIF·GPS)를 떼고 크기를 재 본 뒤 벽(chat-media)에
 *       건다. 벽에 직접 거는 문은 잠겨 있다(chat_media_can_write = false, 마이그 20260925220000).
 *
 * 계약
 *   요청  POST { path: '<방>/<나>/<client_message_id>.jpg' } (사용자 JWT)
 *   응답  200 { path, width, height }
 *         4xx/5xx { error, code } — code ∈ CHAT_IMAGE_UNAUTHENTICATED · CHAT_IMAGE_INVALID ·
 *                                        CHAT_IMAGE_NOT_FOUND · CHAT_IMAGE_TOO_LARGE · CHAT_IMAGE_RATE_LIMITED
 *   멱등: 이미 정화돼 chat-media 에 있으면(재전송) 다시 읽어 크기만 돌려준다.
 *
 * 인증: verify_jwt=false + 함수 내부 auth.getUser() — geocode-address 와 같은 이유(게이트웨이가
 *       ES256 사용자 JWT 를 401 로 거부). 경로 2세그먼트 = 호출자여야 한다.
 *       접수함 업로드 자체가 storage 정책(chat_media_can_stage — 멤버·본인 경로·차단 아님·한도)을
 *       통과한 것이므로 여기서는 소유권만 다시 확인한다.
 *
 * 🔴 사진 바이트·경로 외 개인정보는 로그에 싣지 않는다.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sanitizeJpeg } from '../_shared/jpegSanitize.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INBOX_BUCKET = 'chat-media-inbox';
const MEDIA_BUCKET = 'chat-media';
/** 버킷 한도와 같다(20260925220000) — 버킷이 먼저 막지만 방어적으로 한 번 더 */
const MAX_BYTES = 1_572_864;
const PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

// 사용자당 분당 상한(인스턴스 로컬, best-effort — geocode-address 와 같은 한계로 수용).
// 업로드 자체는 storage 정책이 10분 20장·하루 60장으로 묶는다. 이건 없는 경로를 두드리는 호출용.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    if (rateLimitMap.size > 5_000) rateLimitMap.clear();
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function reject(status: number, code: string, error: string): Response {
  return jsonResponse({ error, code }, status);
}

function isDuplicate(error: { message?: string; statusCode?: string } | null): boolean {
  if (!error) return false;
  return error.statusCode === '409' || /already exists|duplicate/i.test(error.message ?? '');
}

type AdminClient = ReturnType<typeof createClient>;

/** 이미 정화된 사본(재전송) — 크기만 다시 읽어 돌려준다 */
async function readExisting(admin: AdminClient, path: string): Promise<Response | null> {
  const { data } = await admin.storage.from(MEDIA_BUCKET).download(path);
  if (!data) return null;
  const result = sanitizeJpeg(new Uint8Array(await data.arrayBuffer()));
  if (!result.ok) return reject(422, 'CHAT_IMAGE_INVALID', '사진을 보낼 수 없습니다');
  return jsonResponse({ path, width: result.width, height: result.height });
}

async function sanitizeInbox(admin: AdminClient, path: string): Promise<Response> {
  const { data: blob } = await admin.storage.from(INBOX_BUCKET).download(path);
  if (!blob) {
    return (
      (await readExisting(admin, path)) ??
      reject(404, 'CHAT_IMAGE_NOT_FOUND', '사진을 찾을 수 없습니다')
    );
  }
  if (blob.size > MAX_BYTES) {
    await admin.storage.from(INBOX_BUCKET).remove([path]);
    return reject(413, 'CHAT_IMAGE_TOO_LARGE', '사진이 너무 큽니다');
  }

  const result = sanitizeJpeg(new Uint8Array(await blob.arrayBuffer()));
  if (!result.ok) {
    // 거부된 원본은 접수함에 남기지 않는다(원본 EXIF 가 서버에 머물지 않게)
    await admin.storage.from(INBOX_BUCKET).remove([path]);
    console.warn('[chat-media-sanitize] 거부', { code: result.code });
    return reject(422, 'CHAT_IMAGE_INVALID', '사진을 보낼 수 없습니다');
  }

  // upsert:false — 이미 보낸 사진을 같은 경로로 바꿔치기할 수 없게. 중복은 재전송이라 성공 취급
  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(path, result.bytes, { contentType: 'image/jpeg', upsert: false });
  if (uploadError && !isDuplicate(uploadError)) {
    console.error('[chat-media-sanitize] 기록 실패', { message: uploadError.message });
    return reject(500, 'CHAT_IMAGE_INVALID', '사진을 저장하지 못했습니다');
  }

  const { error: removeError } = await admin.storage.from(INBOX_BUCKET).remove([path]);
  if (removeError) {
    // 치명적이지 않다 — 남은 접수함 객체는 S5-b 고아 정리가 지운다
    console.warn('[chat-media-sanitize] 접수함 삭제 실패', { message: removeError.message });
  }
  // 이미 정화본이 있었다면(재전송) 방금 받은 바이트가 아니라 **저장된 객체**의 크기를 돌려준다
  // — 전송 RPC 에 싣는 가로·세로가 실제로 보일 사진과 어긋나지 않게(보안 리뷰 LOW-2)
  if (uploadError) {
    return (
      (await readExisting(admin, path)) ??
      reject(500, 'CHAT_IMAGE_INVALID', '사진을 저장하지 못했습니다')
    );
  }
  return jsonResponse({ path, width: result.width, height: result.height });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reject(405, 'CHAT_IMAGE_INVALID', 'method not allowed');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return reject(401, 'CHAT_IMAGE_UNAUTHENTICATED', '인증이 필요합니다');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return reject(401, 'CHAT_IMAGE_UNAUTHENTICATED', '인증 실패');

    if (!checkRateLimit(user.id)) {
      console.warn('[chat-media-sanitize] rate limited');
      return reject(429, 'CHAT_IMAGE_RATE_LIMITED', '요청이 너무 잦습니다');
    }

    let path: unknown;
    try {
      ({ path } = await req.json());
    } catch {
      return reject(400, 'CHAT_IMAGE_INVALID', '요청 본문이 올바르지 않습니다');
    }
    if (typeof path !== 'string' || !PATH_PATTERN.test(path)) {
      return reject(400, 'CHAT_IMAGE_INVALID', '사진 경로가 올바르지 않습니다');
    }
    if (path.split('/')[1] !== user.id.toLowerCase()) {
      return reject(403, 'CHAT_IMAGE_INVALID', '내가 올린 사진만 보낼 수 있습니다');
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    return await sanitizeInbox(admin, path);
  } catch (err) {
    console.error('[chat-media-sanitize] 오류', err instanceof Error ? err.message : String(err));
    return reject(500, 'CHAT_IMAGE_INVALID', '사진을 처리하지 못했습니다');
  }
});
