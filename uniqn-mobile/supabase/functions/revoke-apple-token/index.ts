import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.3/index.ts';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: '인증 실패' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { authorizationCode } = await req.json();
    if (!authorizationCode || typeof authorizationCode !== 'string') {
      return new Response(JSON.stringify({ error: 'authorizationCode가 필요합니다' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('APPLE_CLIENT_ID')!;

    // Step 1: authorization_code → refresh_token 교환
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
      return new Response(JSON.stringify({ success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenResponse.json();
    const revokeToken = tokenData.refresh_token || tokenData.access_token;
    const tokenTypeHint = tokenData.refresh_token ? 'refresh_token' : 'access_token';

    if (!revokeToken) {
      console.warn('No token received from Apple');
      return new Response(JSON.stringify({ success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ success: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Apple token revoked successfully for user:', user.id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Apple token revocation error:', error);
    return new Response(JSON.stringify({ success: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
