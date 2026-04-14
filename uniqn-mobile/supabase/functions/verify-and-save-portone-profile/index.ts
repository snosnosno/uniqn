import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts';
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TERMS_VERSION = '1.0.0';
const MIN_SIGNUP_AGE = 14;
const XSS_PATTERN = /<script|javascript:|on\w+=|<iframe|<object|<embed|<link\s|data:/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function hasXSS(text: string): boolean {
  return XSS_PATTERN.test(text);
}

function validateAge(birthDate: string): boolean {
  if (!/^\d{8}$/.test(birthDate)) return false;
  const year = parseInt(birthDate.substring(0, 4));
  const month = parseInt(birthDate.substring(4, 6)) - 1;
  const day = parseInt(birthDate.substring(6, 8));
  const birth = new Date(year, month, day);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= MIN_SIGNUP_AGE;
}

function toE164(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+82')) return cleaned;
  if (cleaned.startsWith('010') || cleaned.startsWith('011')) return '+82' + cleaned.substring(1);
  return cleaned;
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
    if (!authHeader) return json({ error: '인증이 필요합니다' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: '인증 실패' }, 401);

    const body = await req.json();
    const {
      identityVerificationId,
      nickname,
      region,
      experienceYears,
      career,
      note,
      termsAgreed,
      privacyAgreed,
      marketingAgreed,
      email,
      mode,
    } = body;

    if (!mode || !['signup', 'social'].includes(mode))
      return json({ error: 'mode가 필요합니다' }, 400);
    if (!termsAgreed || !privacyAgreed) return json({ error: '약관 동의가 필요합니다' }, 400);
    if (
      !identityVerificationId ||
      typeof identityVerificationId !== 'string' ||
      identityVerificationId.length > 200
    ) {
      return json({ error: 'identityVerificationId가 필요합니다' }, 400);
    }
    if (
      nickname &&
      (typeof nickname !== 'string' ||
        nickname.trim().length < 2 ||
        nickname.trim().length > 15 ||
        hasXSS(nickname))
    ) {
      return json({ error: '닉네임은 2-15자이며 특수문자를 포함할 수 없습니다' }, 400);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: '이메일 형식이 올바르지 않습니다' }, 400);
    if (
      experienceYears !== undefined &&
      (typeof experienceYears !== 'number' || experienceYears < 0 || experienceYears > 50)
    ) {
      return json({ error: '경력 연수는 0-50이어야 합니다' }, 400);
    }
    for (const [field, value] of Object.entries({ region, career, note })) {
      if (value && typeof value === 'string' && hasXSS(value)) {
        return json({ error: `${field}에 위험한 문자열이 포함되어 있습니다` }, 400);
      }
    }

    const portoneSecret = Deno.env.get('PORTONE_API_SECRET');
    if (!portoneSecret) return json({ error: 'PortOne 설정 오류' }, 500);

    const portoneRes = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
      { headers: { Authorization: `PortOne ${portoneSecret}` } }
    );
    if (!portoneRes.ok) return json({ error: '본인인증 정보 조회 실패' }, 400);

    const verification = await portoneRes.json();
    if (verification.status !== 'VERIFIED')
      return json({ error: '본인인증이 완료되지 않았습니다' }, 400);

    const identityData = verification.verifiedCustomer || {};
    const verifiedName = identityData.name;
    const rawBirthDate = identityData.birthDate?.replace(/-/g, '');
    const normalizedGender =
      identityData.gender?.toUpperCase() === 'MALE'
        ? 'male'
        : identityData.gender?.toUpperCase() === 'FEMALE'
          ? 'female'
          : undefined;
    const phone = identityData.phoneNumber;

    if (!verifiedName || !rawBirthDate || !normalizedGender || !phone) {
      return json({ error: '본인인증 데이터가 불완전합니다' }, 400);
    }
    if (!validateAge(rawBirthDate))
      return json({ error: `${MIN_SIGNUP_AGE}세 이상만 가입할 수 있습니다` }, 400);

    const phoneE164 = toE164(phone);
    let ciHash: string | undefined;
    if (identityData.ci) {
      ciHash = await createDeterministicHash(identityData.ci, portoneSecret);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const [phoneCheck, nickCheck, ciCheck] = await Promise.all([
      supabase.from('users').select('id').eq('phone', phoneE164).neq('id', user.id).limit(1),
      nickname
        ? supabase
            .from('users')
            .select('id')
            .eq('nickname', nickname.trim())
            .neq('id', user.id)
            .limit(1)
        : { data: [] },
      ciHash
        ? supabase
            .from('users')
            .select('id')
            .eq('identity_ci_hash', ciHash)
            .neq('id', user.id)
            .limit(1)
        : { data: [] },
    ]);

    if (phoneCheck.data && phoneCheck.data.length > 0)
      return json({ error: '이미 등록된 전화번호입니다' }, 409);
    if (nickCheck.data && nickCheck.data.length > 0)
      return json({ error: '이미 사용 중인 닉네임입니다' }, 409);
    if (ciCheck.data && ciCheck.data.length > 0)
      return json({ error: '이미 인증된 신원입니다' }, 409);

    // 기존 프로필 확인 (handle_new_user 트리거로 status='active' 자동 설정되므로 profile_completed로 판단)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, profile_completed')
      .eq('id', user.id)
      .single();
    if (existingUser?.profile_completed === true)
      return json({ error: '이미 프로필이 완료된 계정입니다' }, 409);

    const now = new Date().toISOString();
    const trimmedNickname = nickname?.trim() || null;

    const profileData: Record<string, unknown> = {
      id: user.id,
      name: verifiedName,
      birth_date: rawBirthDate,
      gender: normalizedGender,
      phone: phoneE164,
      role: 'staff',
      status: 'active',
      phone_verified: true,
      identity_verified: true,
      identity_provider: 'portone_inicis',
      identity_ci_hash: ciHash || null,
      identity_data: {
        provider: 'portone',
        channel: 'inicis_unified',
        identityVerificationId,
        verifiedAt: verification.verifiedAt || now,
        name: verifiedName,
        birthDate: rawBirthDate,
        gender: normalizedGender,
        phoneNumber: phoneE164,
        isForeigner: identityData.isForeigner ?? false,
      },
      profile_completed: Boolean(trimmedNickname),
      is_active: true,
      updated_at: now,
    };
    if (trimmedNickname) profileData.nickname = trimmedNickname;
    if (email) profileData.email = email;
    if (region) profileData.region = region;
    if (experienceYears !== undefined) profileData.experience_years = experienceYears;
    if (career) profileData.career = career;
    if (note) profileData.note = note;

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(profileData, { onConflict: 'id' });
    if (upsertError) {
      console.error('Profile upsert failed:', upsertError);
      return json({ error: '프로필 저장에 실패했습니다' }, 500);
    }

    await supabase.from('user_consents').upsert(
      {
        user_id: user.id,
        version: TERMS_VERSION,
        terms_of_service: true,
        privacy_policy: true,
        marketing: marketingAgreed ?? false,
        agreed_at: now,
      },
      { onConflict: 'user_id' }
    );

    await supabase.auth.admin
      .updateUserById(user.id, {
        app_metadata: { role: 'staff' },
        user_metadata: { display_name: verifiedName },
        phone: phoneE164,
      })
      .catch((e) => console.warn('Auth metadata update failed:', e));

    return json({
      success: true,
      uid: user.id,
      role: 'staff',
      profileCompleted: Boolean(trimmedNickname),
      identityVerified: true,
    });
  } catch (error) {
    console.error('PortOne profile verification error:', error);
    return json({ error: error instanceof Error ? error.message : '알 수 없는 오류' }, 500);
  }
});
