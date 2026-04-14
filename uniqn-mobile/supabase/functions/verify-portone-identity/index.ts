import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeBirthDate(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/-/g, '');
  if (!/^\d{8}$/.test(cleaned)) return undefined;
  return cleaned;
}

function normalizeGender(value?: string): 'male' | 'female' | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (upper === 'MALE') return 'male';
  if (upper === 'FEMALE') return 'female';
  return undefined;
}

async function createDeterministicHash(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return encodeHex(new Uint8Array(signature));
}

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

    const { identityVerificationId } = await req.json();
    if (
      !identityVerificationId ||
      typeof identityVerificationId !== 'string' ||
      identityVerificationId.length > 200
    ) {
      return json({ error: 'identityVerificationId가 필요합니다' }, 400);
    }

    // PortOne API 호출
    const portoneSecret = Deno.env.get('PORTONE_API_SECRET');
    if (!portoneSecret) {
      return json({ error: 'PortOne 설정 오류' }, 500);
    }

    const portoneRes = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
      { headers: { Authorization: `PortOne ${portoneSecret}` } }
    );

    if (!portoneRes.ok) {
      return json({ error: '본인인증 정보 조회 실패' }, 400);
    }

    const verification = await portoneRes.json();
    if (verification.status !== 'VERIFIED') {
      return json({ error: '본인인증이 완료되지 않았습니다' }, 400);
    }

    const identityData = verification.verifiedCustomer || {};
    const normalizedBirthDate = normalizeBirthDate(identityData.birthDate);
    const normalizedGender = normalizeGender(identityData.gender);
    const phone = identityData.phoneNumber;

    // 전화번호 정규화 (E.164)
    let normalizedPhone: string | undefined;
    if (phone) {
      const cleaned = phone.replace(/[^\d+]/g, '');
      if (cleaned.startsWith('+82')) normalizedPhone = cleaned;
      else if (cleaned.startsWith('010') || cleaned.startsWith('011'))
        normalizedPhone = '+82' + cleaned.substring(1);
      else normalizedPhone = cleaned;
    }

    // CI 해시
    let ciHash: string | undefined;
    const ci = identityData.ci;
    if (ci) {
      ciHash = await createDeterministicHash(ci, portoneSecret);
    }

    // 중복 검사 (Supabase)
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

    return json({
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
        gender: normalizedGender,
        phoneNumber: normalizedPhone,
        ciHash,
        isForeigner: identityData.isForeigner ?? false,
      },
    });
  } catch (error) {
    console.error('PortOne identity verification error:', error);
    return json({ error: error instanceof Error ? error.message : '알 수 없는 오류' }, 500);
  }
});
