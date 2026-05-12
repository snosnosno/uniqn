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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

    // C1 fix — caller binding 강제. mandatory token (위에서 검증) + customData
    // 일치 모두 필수. mismatch면 PII 노출 차단.
    {
      const actualToken = extractBindingToken(verification.customData);
      if (!isBindingMatch(expectedBindingToken, actualToken)) {
        console.warn('[caller-binding] verify-portone-identity mismatch', {
          hasActual: actualToken !== undefined,
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
