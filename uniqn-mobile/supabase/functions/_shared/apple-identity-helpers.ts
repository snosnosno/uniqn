/**
 * Pure TypeScript helpers for Apple identity sub matching.
 *
 * Deno deploy 환경(jose 의존)을 분리해 jest에서 단위 테스트 가능하도록 둔 헬퍼.
 * JWKS signature 검증은 `apple-jwks.ts`(jose, Deno-only)에서 수행.
 */

export interface AppleIdentity {
  provider: string;
  identity_data?: { sub?: string } | null;
}

export function extractAppleSubFromIdentities(
  identities: ReadonlyArray<AppleIdentity> | null | undefined
): string | undefined {
  if (!identities) return undefined;
  const apple = identities.find((i) => i.provider === 'apple');
  const sub = apple?.identity_data?.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub : undefined;
}

export function isSubMatch(tokenSub: string, identitySub: string | undefined): boolean {
  return typeof identitySub === 'string' && identitySub.length > 0 && tokenSub === identitySub;
}
