/**
 * @file Apple identity helpers — Spec B caller binding (sub match).
 *
 * spec: docs/specs/apple-portone-caller-binding.md (Spec B). JWKS signature
 * 검증(`apple-jwks.ts`)은 jose / Deno 의존이라 단위 테스트 어려움.
 * 본 파일은 jose-independent helper(extractAppleSubFromIdentities, isSubMatch)만 검증.
 */
import {
  extractAppleSubFromIdentities,
  isSubMatch,
  type AppleIdentity,
} from '../../supabase/functions/_shared/apple-identity-helpers';

describe('extractAppleSubFromIdentities', () => {
  it('apple provider identity의 sub 반환', () => {
    const identities: AppleIdentity[] = [
      { provider: 'email', identity_data: { sub: 'should-not-match' } },
      { provider: 'apple', identity_data: { sub: 'apple-uuid-123' } },
    ];
    expect(extractAppleSubFromIdentities(identities)).toBe('apple-uuid-123');
  });

  it('apple identity 없음 → undefined', () => {
    const identities: AppleIdentity[] = [{ provider: 'email', identity_data: { sub: 'x' } }];
    expect(extractAppleSubFromIdentities(identities)).toBeUndefined();
  });

  it('null / undefined / empty array → undefined', () => {
    expect(extractAppleSubFromIdentities(null)).toBeUndefined();
    expect(extractAppleSubFromIdentities(undefined)).toBeUndefined();
    expect(extractAppleSubFromIdentities([])).toBeUndefined();
  });

  it('apple identity의 identity_data.sub 누락 / 빈문자열 → undefined', () => {
    expect(
      extractAppleSubFromIdentities([{ provider: 'apple', identity_data: {} }])
    ).toBeUndefined();
    expect(
      extractAppleSubFromIdentities([{ provider: 'apple', identity_data: { sub: '' } }])
    ).toBeUndefined();
    expect(
      extractAppleSubFromIdentities([{ provider: 'apple', identity_data: null }])
    ).toBeUndefined();
  });
});

describe('isSubMatch', () => {
  it('정상 동일 sub → true', () => {
    expect(isSubMatch('uuid-1', 'uuid-1')).toBe(true);
  });

  it('다른 sub → false (caller binding 위반)', () => {
    expect(isSubMatch('uuid-1', 'uuid-2')).toBe(false);
  });

  it('identitySub undefined / 빈문자열 → false (fail-closed)', () => {
    expect(isSubMatch('uuid-1', undefined)).toBe(false);
    expect(isSubMatch('uuid-1', '')).toBe(false);
  });
});
