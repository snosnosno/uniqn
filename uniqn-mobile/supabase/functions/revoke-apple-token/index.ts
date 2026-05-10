import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.3/index.ts';
import { extractAppleSubFromIdentities, isSubMatch } from '../_shared/apple-identity-helpers.ts';
import { verifyAppleIdToken } from '../_shared/apple-jwks.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

async function generateAppleClientSecret(): Promise<string> {
  const privateKeyPem = Deno.env.get('APPLE_PRIVATE_KEY')!.replace(/\\n/g, '\n');
  const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256');

  const teamId = Deno.env.get('APPLE_TEAM_ID')!;
  const clientId = Deno.env.get('APPLE_CLIENT_ID')!;
  const keyId = Deno.env.get('APPLE_KEY_ID')!;

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  return jwt;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: '인증이 필요합니다' }, 401);
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
      return jsonResponse({ error: '인증 실패' }, 401);
    }

    const { authorizationCode } = await req.json();
    if (!authorizationCode || typeof authorizationCode !== 'string') {
      return jsonResponse({ error: 'authorizationCode가 필요합니다' }, 400);
    }

    const clientId = Deno.env.get('APPLE_CLIENT_ID')!;

    // Step 1: authorization_code → refresh_token / id_token 교환
    const clientSecret = await generateAppleClientSecret();

    const tokenResponse = await fetch(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.warn('Apple token exchange failed:', tokenResponse.status);
      return jsonResponse({ success: false });
    }

    const tokenData = await tokenResponse.json();

    // Step 1.5: caller binding — id_token의 sub이 현재 supabase user의 apple identity sub과 일치하는지 검증.
    // 다른 사람의 authorizationCode를 자기 계정에 묶어 revoke하는 공격을 차단.
    const idToken = tokenData.id_token;
    if (!idToken || typeof idToken !== 'string') {
      console.warn('Apple token response missing id_token — caller binding skipped');
      return jsonResponse({ success: false, code: 'APPLE_MISSING_ID_TOKEN' }, 400);
    }

    let tokenSub: string;
    try {
      tokenSub = await verifyAppleIdToken(idToken, clientId);
    } catch (e) {
      console.warn('Apple id_token verification failed:', e instanceof Error ? e.message : e);
      return jsonResponse({ success: false, code: 'APPLE_ID_TOKEN_INVALID' }, 403);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const identitySub = extractAppleSubFromIdentities(adminUser?.user?.identities ?? null);
    if (!isSubMatch(tokenSub, identitySub)) {
      console.warn('Apple sub mismatch — caller binding violation', {
        userId: user.id,
        hasIdentitySub: Boolean(identitySub),
      });
      return jsonResponse({ success: false, code: 'APPLE_SUB_MISMATCH' }, 403);
    }

    const revokeToken = tokenData.refresh_token || tokenData.access_token;
    const tokenTypeHint = tokenData.refresh_token ? 'refresh_token' : 'access_token';

    if (!revokeToken) {
      console.warn('No token received from Apple');
      return jsonResponse({ success: false });
    }

    // Step 2: 토큰 폐기
    const revokeResponse = await fetch(APPLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: revokeToken,
        token_type_hint: tokenTypeHint,
      }),
    });

    if (!revokeResponse.ok) {
      console.warn('Apple token revocation failed:', revokeResponse.status);
      return jsonResponse({ success: false });
    }

    console.log('Apple token revoked successfully for user:', user.id);
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Apple token revocation error:', error);
    return jsonResponse({ success: false });
  }
});
