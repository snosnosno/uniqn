import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  corsHeaders,
  createCiHash,
  idpError,
  isVerificationRecent,
  jsonResponse,
  logDiDiagnostic,
  normalizeBirthDate,
  normalizeGender,
  toE164,
} from '../_shared/idp-binding.ts';
import { extractBindingToken, isBindingMatch } from '../_shared/portone-caller-binding.ts';

// A8: anon caller rate-limit (defense-in-depth, per-instance best-effort).
// PortOne 호출은 비용/쿼터를 가지므로 가벼운 차단으로 비정상 폭증 방지.
// Edge function 인스턴스 간 공유 X — 분산 공격엔 한계가 있으나 단일 IP 봇 제한엔 충분.
const RATE_LIMIT_MAX = 20; // requests per window (IP 식별 가능)
// IP 헤더 누락 시 'unknown' 공유 bucket — 정상 사용자 부작용 방지를 위해 더 보수적 limit 적용
const RATE_LIMIT_MAX_NO_IP = 5;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const NO_IP_KEY = '__no_ip__';
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PRUNE_INTERVAL_MS = 5 * 60_000;
let lastPruneAt = Date.now();

function pruneExpired(now: number) {
  if (now - lastPruneAt < RATE_LIMIT_PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) rateLimitMap.delete(key);
  }
}

function extractClientKey(req: Request): string {
  // Supabase/Deno edge proxy 통상 x-forwarded-for / x-real-ip 헤더 제공.
  // 첫 번째 IP만 사용(체인 위조 방지). 빈 경우 __no_ip__ 공유 bucket → 보수적 limit.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.slice(0, 64);
  return NO_IP_KEY;
}

function checkRateLimit(req: Request): boolean {
  const now = Date.now();
  pruneExpired(now);
  const key = extractClientKey(req);
  const limit = key === NO_IP_KEY ? RATE_LIMIT_MAX_NO_IP : RATE_LIMIT_MAX;
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // A8: rate limit 우선 — 본문 파싱 / PortOne API 호출 비용 방어
  if (!checkRateLimit(req)) {
    return idpError('IV_RATE_LIMITED');
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();

    const { identityVerificationId, expectedBindingToken } = await req.json();
    if (
      !identityVerificationId ||
      typeof identityVerificationId !== 'string' ||
      identityVerificationId.length > 200
    ) {
      return jsonResponse({ error: 'identityVerificationId가 필요합니다' }, 400);
    }
    // C1 fix — expectedBindingToken은 mandatory. anon caller가 leaked
    // verificationId만으로 신원 데이터 + duplicate flags를 harvest하는 PII
    // oracle 경로를 차단한다. legacy 호환 경로 제거.
    // A10: 정확 64자 hex (32 bytes random) 만 허용 — generateBindingToken 출력 형식
    if (
      !expectedBindingToken ||
      typeof expectedBindingToken !== 'string' ||
      !/^[0-9a-f]{64}$/.test(expectedBindingToken)
    ) {
      return idpError('IV_BINDING_MISMATCH');
    }

    const portoneSecret = Deno.env.get('PORTONE_API_SECRET');
    if (!portoneSecret) {
      return jsonResponse({ error: 'PortOne 설정 오류' }, 500);
    }

    const portoneRes = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
      { headers: { Authorization: `PortOne ${portoneSecret}` } }
    );

    if (!portoneRes.ok) {
      return idpError('PORTONE_FETCH_FAILED');
    }

    const verification = await portoneRes.json();
    if (verification.status !== 'VERIFIED') {
      return idpError('PORTONE_NOT_VERIFIED');
    }
    if (!isVerificationRecent(verification.verifiedAt)) {
      return idpError('IV_TIMESTAMP_EXPIRED');
    }

    // C1 fix — caller binding (graceful skip 모드).
    // expectedBindingToken format 검증(위 line 95-101)으로 1차 caller 의 identity 보호.
    // 2차 customData round-trip 검증은 PortOne 응답에 customData 가 있을 때만 적용.
    //
    // 2026-05-16 운영 데이터로 확인: PortOne 이니시스 통합인증은 verification.customData 를
    // echo 하지 않음 → mandatory 검증 시 prod 본인인증 0/4일 100% 차단 사고 발생.
    // PortOne 본인인증 API 의 customData echo 동작은 결제(payment) 흐름과 다름.
    // 향후 PortOne 이 echo 시작하면 아래 else if 분기가 자동 활성화.
    {
      const customDataRaw: unknown = (verification as { customData?: unknown }).customData;
      const actualToken = extractBindingToken(customDataRaw);
      if (actualToken === undefined) {
        console.info(
          '[caller-binding] customData not echoed by PortOne - skip (expected behavior)',
          {
            customDataType: typeof customDataRaw,
            customDataLength: typeof customDataRaw === 'string' ? customDataRaw.length : null,
          }
        );
      } else if (!isBindingMatch(expectedBindingToken, actualToken)) {
        // customData 가 있는데 token 불일치 — 실제 caller 위조 의심
        console.warn('[caller-binding] verify-portone-identity mismatch (echo path)', {
          hasActual: true,
        });
        return idpError('IV_BINDING_MISMATCH');
      }
    }

    const identityData = verification.verifiedCustomer || {};
    logDiDiagnostic(identityData, 'verify-portone-identity');
    const normalizedBirthDate = normalizeBirthDate(identityData.birthDate);
    const gender = normalizeGender(identityData.gender);
    const phone = identityData.phoneNumber;

    const normalizedPhone = phone ? toE164(phone) : undefined;

    let ciHash: string | undefined;
    const ci = identityData.ci;
    if (ci) {
      // A6: IDENTITY_HASH_PEPPER 사용 — PortOne secret 분리
      ciHash = await createCiHash(ci, Deno.env.get('IDENTITY_HASH_PEPPER'));
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let hasDuplicatePhone = false;
    let hasDuplicateIdentity = false;

    const queries = [];
    if (normalizedPhone) {
      queries.push(
        supabase
          .from('users')
          .select('id')
          .eq('phone', normalizedPhone)
          .limit(2)
          .then(({ data }) => {
            const others = user ? (data || []).filter((u) => u.id !== user.id) : data || [];
            hasDuplicatePhone = others.length > 0;
          })
      );
    }
    if (ciHash) {
      queries.push(
        supabase
          .from('users')
          .select('id')
          .eq('identity_ci_hash', ciHash)
          .limit(2)
          .then(({ data }) => {
            const others = user ? (data || []).filter((u) => u.id !== user.id) : data || [];
            hasDuplicateIdentity = others.length > 0;
          })
      );
    }
    await Promise.all(queries);

    return jsonResponse({
      success: true,
      identityVerified: true,
      phoneVerified: Boolean(normalizedPhone),
      hasDuplicatePhone,
      hasDuplicateIdentity,
      identity: {
        provider: 'portone',
        channel: 'inicis_unified',
        identityVerificationId,
        verifiedAt: verification.verifiedAt || new Date().toISOString(),
        name: identityData.name,
        birthDate: normalizedBirthDate,
        gender,
        phoneNumber: normalizedPhone,
        ciHash,
        isForeigner: identityData.isForeigner ?? false,
      },
    });
  } catch (error) {
    console.error('PortOne identity verification error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : '알 수 없는 오류' }, 500);
  }
});
