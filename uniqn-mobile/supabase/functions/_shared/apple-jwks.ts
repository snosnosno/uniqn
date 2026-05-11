/**
 * Apple JWKS-based id_token verification.
 *
 * spec: docs/specs/apple-portone-caller-binding.md (Spec B — Apple JWKS sub 검증).
 *
 * Apple `https://appleid.apple.com/auth/keys` 의 JWKS를 캐시하고 jose remote JWKS
 * resolver로 id_token signature·issuer·audience 검증. payload.sub만 반환.
 *
 * Deno deploy 전용. jest 단위 테스트는 동일 디렉토리 `apple-identity-helpers.ts`
 * (Pure TS)에서 수행. 본 파일은 prod Apple user 등장 시 e2e/integration으로 검증.
 */
import * as jose from 'https://deno.land/x/jose@v5.2.3/index.ts';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

let cachedJWKS: ReturnType<typeof jose.createRemoteJWKSet> | undefined;

function getJWKS(): ReturnType<typeof jose.createRemoteJWKSet> {
  if (!cachedJWKS) {
    cachedJWKS = jose.createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  }
  return cachedJWKS;
}

/**
 * Apple id_token을 JWKS로 검증하고 sub 클레임을 반환한다.
 * signature / iss / aud / exp 모두 검증 (clockTolerance 5s — Apple/서버 시계 어긋남 보정).
 * sub 누락 시 throw.
 */
export async function verifyAppleIdToken(idToken: string, audience: string): Promise<string> {
  const { payload } = await jose.jwtVerify(idToken, getJWKS(), {
    issuer: APPLE_ISSUER,
    audience,
    clockTolerance: '5s',
  });
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Apple id_token sub claim missing');
  }
  return payload.sub;
}
