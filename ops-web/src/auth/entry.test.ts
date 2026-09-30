import { describe, expect, it } from 'vitest';
import { resolveOpsEntry, type EntryProfile } from './entry';

const complete: EntryProfile = {
  socialProvider: null,
  phoneVerified: true,
  identityVerified: true,
  profileCompleted: true,
};

describe('resolveOpsEntry — 모바일 진입 판정(getAuthenticatedEntryRoute)과 같은 결론', () => {
  it('가입을 마친 계정은 콘솔로', () => {
    expect(resolveOpsEntry(complete)).toEqual({ kind: 'ready' });
  });

  it('옛 가입자(identityVerified=null)는 통과 — false 만 막는다', () => {
    expect(resolveOpsEntry({ ...complete, identityVerified: null })).toEqual({ kind: 'ready' });
  });

  it('프로필 행이 없으면 가입 미완료', () => {
    expect(resolveOpsEntry(null)).toEqual({ kind: 'incomplete', step: 'signup' });
  });

  it('휴대폰·본인인증 둘 다 안 한 신규 = 가입 흐름', () => {
    expect(resolveOpsEntry({ ...complete, phoneVerified: false, identityVerified: false })).toEqual(
      { kind: 'incomplete', step: 'signup' }
    );
  });

  it('소셜 신규 = 가입(본인인증) 단계', () => {
    expect(
      resolveOpsEntry({ ...complete, socialProvider: 'google', phoneVerified: false })
    ).toEqual({ kind: 'incomplete', step: 'signup' });
  });

  it('본인인증만 false(옛 휴대폰 인증 사용자) = 재인증', () => {
    expect(resolveOpsEntry({ ...complete, identityVerified: false })).toEqual({
      kind: 'incomplete',
      step: 'reverify',
    });
  });

  it('닉네임 미설정 = 프로필 설정', () => {
    expect(resolveOpsEntry({ ...complete, profileCompleted: false })).toEqual({
      kind: 'incomplete',
      step: 'profile',
    });
  });
});
