/**
 * 주소 → 좌표(지오코딩) — 카카오 로컬 API 프록시.
 *
 * 왜 Edge Function 인가:
 *   카카오 REST API 키는 **시크릿**이다. 클라이언트에서 직접 호출하면 번들에 실린다
 *   (`EXPO_PUBLIC_` 접두사를 안 붙여도, 값이 코드에 들어가는 순간 OTA 번들에 박힌다).
 *   그래서 키를 아는 유일한 곳은 여기다. 읽기 경로에는 키가 전혀 붙지 않는다 —
 *   좌표는 공고 저장 시점에 한 번 계산해 `job_postings.geo_lat/geo_lng` 에 적어 두고,
 *   그 뒤로는 DB 에서 읽는다.
 *
 * 계약:
 *   요청  POST { address: string }
 *   응답  200 { coordinates: { lat, lng } | null, matchedAddress?: string, reason?: string }
 *   상류 장애·무매칭은 **좌표 없음**으로 접힌다(200 + coordinates:null). 호출부는 좌표 없이
 *   저장하고 길찾기는 기존 주소 텍스트 검색으로 폴백한다 — 지오코딩이 공고 저장을 막아선 안 된다.
 *   반면 인증·입력·설정 오류는 200 으로 접지 않는다(4xx/5xx) — 그건 조용히 넘길 결함이다.
 *
 * 🔴 키는 로그·응답 어디에도 싣지 않는다. 상류 실패는 상태코드만 남긴다.
 *
 * 실측(2026-08-03, prod 실호출): '서울 강남구 테헤란로 152' → lat 37.5000242, lng 127.0365086.
 * B1 위젯이 주는 **축약형 시도 표기**('서울')도 그대로 매칭된다 — 정규화 없이 바로 넘길 수 있다.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** 카카오 로컬 API 주소 검색. 문서: dapi.kakao.com/v2/local/search/address */
const KAKAO_GEOCODE_URL = 'https://dapi.kakao.com/v2/local/search/address.json';
const UPSTREAM_TIMEOUT_MS = 5_000;
const MAX_ADDRESS_LENGTH = 300;

/**
 * 대한민국 경계 박스.
 *
 * 🔴 `20260803160000_job_postings_geocode_columns.sql` 의 `chk_job_postings_geo_bounds` 와
 *    **같은 값이어야 한다.** 여기서 걸러내지 못한 값이 DB CHECK 에 걸리면 23514 가 나고,
 *    그러면 좌표가 아니라 **공고 저장 자체가 실패한다** — 부가 기능이 본 기능을 죽이는 형태다.
 *    DB 가 최종 권위이고 여기는 그 앞의 그물이다.
 *    실측 하한 경계: 서귀포 중문 lat 33.25 / lng 126.41 — 박스 안에 여유있게 들어온다.
 */
const KOREA_BOUNDS = { minLat: 32.5, maxLat: 39.0, minLng: 124.0, maxLng: 132.5 };

// 사용자당 분당 호출 상한(인스턴스 로컬, best-effort).
// 공고 저장 1회 = 호출 1회다. 20 이면 정상 사용은 절대 닿지 않고, 스크립트로 쿼터를
// 태우려는 시도는 눈에 띄게 느려진다. 인스턴스 간 공유가 아니라 분산 남용엔 한계가 있다
// (verify-portone-identity 와 같은 한계·같은 이유로 수용).
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_PRUNE_INTERVAL_MS = 5 * 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let lastPruneAt = Date.now();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  if (now - lastPruneAt >= RATE_LIMIT_PRUNE_INTERVAL_MS) {
    lastPruneAt = now;
    for (const [key, entry] of rateLimitMap.entries()) {
      if (entry.resetAt < now) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

/**
 * 카카오 응답 한 건 → 좌표.
 *
 * `x`=경도, `y`=위도이고 **문자열로** 온다(실측: `"127.036508620542"`). 이름이 직관과
 * 반대라 뒤집어 쓰기 쉬운 자리다 — x/y 를 그대로 lat/lng 에 넣으면 지구 반대편을 가리킨다.
 */
function toCoordinates(document: unknown): { lat: number; lng: number } | null {
  if (!document || typeof document !== 'object') return null;
  const { x, y } = document as { x?: unknown; y?: unknown };
  const lng = typeof x === 'string' ? Number.parseFloat(x) : typeof x === 'number' ? x : NaN;
  const lat = typeof y === 'string' ? Number.parseFloat(y) : typeof y === 'number' ? y : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < KOREA_BOUNDS.minLat || lat > KOREA_BOUNDS.maxLat) return null;
  if (lng < KOREA_BOUNDS.minLng || lng > KOREA_BOUNDS.maxLng) return null;

  return { lat, lng };
}

function matchedAddressOf(document: unknown): string | undefined {
  if (!document || typeof document !== 'object') return undefined;
  const doc = document as {
    road_address?: { address_name?: unknown } | null;
    address?: { address_name?: unknown } | null;
    address_name?: unknown;
  };
  const candidates = [doc.road_address?.address_name, doc.address?.address_name, doc.address_name];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: '인증이 필요합니다', code: 'GEO_UNAUTHENTICATED' }, 401);
    }

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
      return jsonResponse({ error: '인증 실패', code: 'GEO_UNAUTHENTICATED' }, 401);
    }

    // 쿼터 방어는 **본문 파싱·상류 호출보다 먼저**. 뒤에 두면 방어하려던 비용을 이미 치른 뒤가 된다.
    if (!checkRateLimit(user.id)) {
      return jsonResponse(
        { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.', code: 'GEO_RATE_LIMITED' },
        429
      );
    }

    let address: unknown;
    try {
      ({ address } = await req.json());
    } catch {
      return jsonResponse({ error: '요청 본문이 올바르지 않습니다', code: 'GEO_BAD_REQUEST' }, 400);
    }
    if (typeof address !== 'string') {
      return jsonResponse({ error: '주소가 필요합니다', code: 'GEO_BAD_REQUEST' }, 400);
    }
    const query = address.trim();
    if (!query || query.length > MAX_ADDRESS_LENGTH) {
      return jsonResponse({ error: '주소가 필요합니다', code: 'GEO_BAD_REQUEST' }, 400);
    }

    const restKey = Deno.env.get('KAKAO_REST_API_KEY');
    if (!restKey) {
      // 설정 누락은 조용히 넘기지 않는다 — 좌표가 영영 안 붙는 상태를 무증상으로 만든다.
      console.error('[geocode-address] KAKAO_REST_API_KEY 미설정');
      return jsonResponse(
        { error: '지오코딩이 설정되지 않았습니다', code: 'GEO_CONFIG_MISSING' },
        500
      );
    }

    const url = `${KAKAO_GEOCODE_URL}?query=${encodeURIComponent(query)}&size=1`;
    let upstream: Response;
    try {
      upstream = await fetch(url, {
        headers: { Authorization: `KakaoAK ${restKey}` },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      // 타임아웃·네트워크 실패 — 좌표 없음으로 접는다(저장을 막지 않는다).
      console.warn('[geocode-address] 상류 호출 실패', {
        name: error instanceof Error ? error.name : 'unknown',
      });
      return jsonResponse({ coordinates: null, reason: 'upstream_unreachable' });
    }

    if (!upstream.ok) {
      // 🔴 상류 본문을 그대로 흘리지 않는다 — 키·계정 정보가 섞여 나올 수 있다.
      console.warn('[geocode-address] 상류 비정상 응답', { status: upstream.status });
      return jsonResponse({ coordinates: null, reason: 'upstream_error' });
    }

    const payload = (await upstream.json()) as { documents?: unknown[] };
    const first = Array.isArray(payload.documents) ? payload.documents[0] : undefined;
    const coordinates = toCoordinates(first);
    if (!coordinates) {
      return jsonResponse({ coordinates: null, reason: 'no_match' });
    }

    const matchedAddress = matchedAddressOf(first);
    return jsonResponse({
      coordinates,
      ...(matchedAddress ? { matchedAddress } : {}),
    });
  } catch (error) {
    console.error('[geocode-address] 처리 실패', {
      name: error instanceof Error ? error.name : 'unknown',
    });
    return jsonResponse({ error: '지오코딩에 실패했습니다', code: 'GEO_INTERNAL' }, 500);
  }
});
