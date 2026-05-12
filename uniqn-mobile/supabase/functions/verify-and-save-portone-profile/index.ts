import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  corsHeaders,
  createDeterministicHash,
  idpError,
  isVerificationRecent,
  jsonResponse,
  logDiDiagnostic,
  normalizeBirthDate,
  normalizeGender,
  toE164,
  validateAge,
} from '../_shared/idp-binding.ts';
import { extractBindingToken, isBindingMatch } from '../_shared/portone-caller-binding.ts';

const TERMS_VERSION = '1.0.0';
const MIN_SIGNUP_AGE = 14;
const XSS_PATTERN = /<script|javascript:|on\w+=|<iframe|<object|<embed|<link\s|data:/i;

function hasXSS(text: string): boolean {
  return XSS_PATTERN.test(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return idpError('AUTH_REQUIRED');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return idpError('AUTH_FAILED');

    const body = await req.json();
    const {
      identityVerificationId,
      expectedBindingToken,
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

    if (!mode || !['signup', 'social', 'reverify'].includes(mode))
      return jsonResponse({ error: 'mode가 필요합니다' }, 400);
    // reverify 는 기존 동의 유지 — 약관 재확인 스킵
    if (mode !== 'reverify' && (!termsAgreed || !privacyAgreed))
      return jsonResponse({ error: '약관 동의가 필요합니다' }, 400);
    if (
      !identityVerificationId ||
      typeof identityVerificationId !== 'string' ||
      identityVerificationId.length > 200
    ) {
      return jsonResponse({ error: 'identityVerificationId가 필요합니다' }, 400);
    }
    // C1 fix — expectedBindingToken mandatory. AUTH layer 위에 추가 caller
    // identity layer로 token 일치까지 강제 (defense in depth).
    if (
      !expectedBindingToken ||
      typeof expectedBindingToken !== 'string' ||
      expectedBindingToken.length === 0 ||
      expectedBindingToken.length > 200
    ) {
      return idpError('IV_BINDING_MISMATCH');
    }
    if (
      nickname &&
      (typeof nickname !== 'string' ||
        nickname.trim().length < 2 ||
        nickname.trim().length > 15 ||
        hasXSS(nickname))
    ) {
      return jsonResponse({ error: '닉네임은 2-15자이며 특수문자를 포함할 수 없습니다' }, 400);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return jsonResponse({ error: '이메일 형식이 올바르지 않습니다' }, 400);
    if (
      experienceYears !== undefined &&
      (typeof experienceYears !== 'number' || experienceYears < 0 || experienceYears > 50)
    ) {
      return jsonResponse({ error: '경력 연수는 0-50이어야 합니다' }, 400);
    }
    for (const [field, value] of Object.entries({ region, career, note })) {
      if (value && typeof value === 'string' && hasXSS(value)) {
        return jsonResponse({ error: `${field}에 위험한 문자열이 포함되어 있습니다` }, 400);
      }
    }

    const portoneSecret = Deno.env.get('PORTONE_API_SECRET');
    if (!portoneSecret) return jsonResponse({ error: 'PortOne 설정 오류' }, 500);

    const portoneRes = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
      { headers: { Authorization: `PortOne ${portoneSecret}` } }
    );
    if (!portoneRes.ok) return idpError('PORTONE_FETCH_FAILED');

    const verification = await portoneRes.json();
    if (verification.status !== 'VERIFIED') return idpError('PORTONE_NOT_VERIFIED');
    if (!isVerificationRecent(verification.verifiedAt)) return idpError('IV_TIMESTAMP_EXPIRED');

    // C1 fix — caller binding 강제. mandatory token (위에서 검증) + customData
    // 일치 모두 필수. defense in depth (AUTH + binding).
    {
      const actualToken = extractBindingToken(verification.customData);
      if (!isBindingMatch(expectedBindingToken, actualToken)) {
        console.warn('[caller-binding] verify-and-save-portone-profile mismatch', {
          uid: user.id,
          hasActual: actualToken !== undefined,
        });
        return idpError('IV_BINDING_MISMATCH');
      }
    }

    const identityData = verification.verifiedCustomer || {};
    logDiDiagnostic(identityData, 'verify-and-save-portone-profile');
    const verifiedName = identityData.name;
    const rawBirthDate = normalizeBirthDate(identityData.birthDate);
    const gender = normalizeGender(identityData.gender);
    const phone = identityData.phoneNumber;

    if (!verifiedName || !rawBirthDate || !gender || !phone) {
      return idpError('PORTONE_INCOMPLETE');
    }
    if (!validateAge(rawBirthDate, MIN_SIGNUP_AGE)) return idpError('PORTONE_AGE_RESTRICTED');

    const phoneE164 = toE164(phone);
    let ciHash: string | undefined;
    if (identityData.ci) {
      ciHash = await createDeterministicHash(identityData.ci, portoneSecret);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // C5 fix — duplicate / profile_completed 검사를 멱등성 INSERT 전에 수행.
    // 그렇지 않으면 benign 실패(중복 phone/CI 등)가 멱등성 레코드를 영구로
    // 남겨서 사용자가 같은 verification으로 재시도 못 함.
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

    if (phoneCheck.data && phoneCheck.data.length > 0) return idpError('IV_DUPLICATE_PHONE');
    if (nickCheck.data && nickCheck.data.length > 0) return idpError('IV_DUPLICATE_NICKNAME');
    if (ciCheck.data && ciCheck.data.length > 0) return idpError('IV_DUPLICATE_CI');

    // 기존 프로필 확인 (handle_new_user 트리거로 status='active' 자동 설정되므로 profile_completed로 판단)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, profile_completed, identity_verified')
      .eq('id', user.id)
      .single();
    // reverify: 이미 완성된 프로필이라도 본인인증만 갱신 허용
    if (mode !== 'reverify' && existingUser?.profile_completed === true)
      return idpError('PROFILE_ALREADY_COMPLETED');
    // reverify 진입 audit (identity_verified=false 또는 null 에서 재인증)
    if (mode === 'reverify') {
      console.info('[reverify] entered', {
        uid: user.id,
        prevIdentityVerified: existingUser?.identity_verified ?? null,
      });
    }

    // P1 — verification_id 멱등성 검사 (모든 validation 통과 후 처음 1회만 처리).
    // PRIMARY KEY 위반(23505)이면 이미 다른 호출에서 처리 완료 → 차단.
    const { error: idempotencyError } = await supabase
      .from('processed_identity_verifications')
      .insert({
        verification_id: identityVerificationId,
        user_id: user.id,
        function_name: 'verify-and-save-portone-profile',
      });
    if (idempotencyError) {
      if (idempotencyError.code === '23505') {
        console.warn('[idempotency] verification_id already processed', {
          uid: user.id,
        });
        return idpError('IV_ALREADY_PROCESSED');
      }
      console.error('Idempotency insert failed:', idempotencyError);
      return jsonResponse({ error: '멱등성 검사 실패' }, 500);
    }

    const now = new Date().toISOString();
    const trimmedNickname = nickname?.trim() || null;

    // reverify: 본인인증 핵심 필드만 갱신 (nickname/region/career/note/email/role 등 미변경)
    // signup/social: 기존 동작 유지 — 전체 프로필 upsert
    const identityFields = {
      name: verifiedName,
      birth_date: rawBirthDate,
      gender,
      phone: phoneE164,
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
        gender,
        phoneNumber: phoneE164,
        isForeigner: identityData.isForeigner ?? false,
      },
      updated_at: now,
    };

    const profileData: Record<string, unknown> =
      mode === 'reverify'
        ? identityFields
        : {
            id: user.id,
            ...identityFields,
            role: 'staff',
            status: 'active',
            profile_completed: Boolean(trimmedNickname),
            is_active: true,
          };
    if (mode !== 'reverify') {
      if (trimmedNickname) profileData.nickname = trimmedNickname;
      if (email) profileData.email = email;
      if (region) profileData.region = region;
      if (experienceYears !== undefined) profileData.experience_years = experienceYears;
      if (career) profileData.career = career;
      if (note) profileData.note = note;
    }

    const { error: upsertError } =
      mode === 'reverify'
        ? await supabase.from('users').update(profileData).eq('id', user.id)
        : await supabase.from('users').upsert(profileData, { onConflict: 'id' });
    if (upsertError) {
      // C6 fix — rollback DELETE 결과 명시적 처리. 실패 시 dangling row가
      // 다음 재시도를 영구 차단하므로 logger.error로 visible하게 알림.
      const { error: rollbackError } = await supabase
        .from('processed_identity_verifications')
        .delete()
        .eq('verification_id', identityVerificationId);
      if (rollbackError) {
        console.error('[CRITICAL] idempotency rollback failed — dangling row may block retry', {
          uid: user.id,
          verificationId: identityVerificationId,
          rollbackError,
          upsertError,
        });
      } else {
        console.error('Profile upsert failed, idempotency rolled back:', upsertError);
      }
      return jsonResponse({ error: '프로필 저장에 실패했습니다' }, 500);
    }

    // reverify: 기존 동의 유지, user_consents 미변경. signup/social 만 동의 기록.
    if (mode !== 'reverify') {
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
    }

    // reverify: role/app_metadata 미변경 — phone 만 갱신
    const authUpdatePayload =
      mode === 'reverify'
        ? { phone: phoneE164, user_metadata: { display_name: verifiedName } }
        : {
            app_metadata: { role: 'staff' },
            user_metadata: { display_name: verifiedName },
            phone: phoneE164,
          };
    await supabase.auth.admin
      .updateUserById(user.id, authUpdatePayload)
      .catch((e) => console.warn('Auth metadata update failed:', e));

    return jsonResponse({
      success: true,
      uid: user.id,
      role: 'staff',
      profileCompleted:
        mode === 'reverify' ? Boolean(existingUser?.profile_completed) : Boolean(trimmedNickname),
      identityVerified: true,
    });
  } catch (error) {
    console.error('PortOne profile verification error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : '알 수 없는 오류' }, 500);
  }
});
