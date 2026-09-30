import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { AuthState } from './authContext';
import { nextAuthState } from './authState';

const session = (id: string) => ({ user: { id } }) as unknown as Session;
const signedIn = (id: string, recovery = false): AuthState => ({
  status: 'signedIn',
  session: session(id),
  recovery,
});
const loading: AuthState = { status: 'loading' };

describe('nextAuthState', () => {
  it('첫 세션(INITIAL_SESSION) 없음 → signedOut, 캐시 비울 것 없음', () => {
    const t = nextAuthState(loading, 'INITIAL_SESSION', null, null);
    expect(t.state).toEqual({ status: 'signedOut' });
    expect(t.clearCache).toBe(false);
  });

  it('PASSWORD_RECOVERY → recovery 켜고 저장', () => {
    const t = nextAuthState(loading, 'PASSWORD_RECOVERY', session('a'), null);
    expect(t.state).toMatchObject({ status: 'signedIn', recovery: true });
    expect(t.recoveryUserId).toBe('a');
  });

  it('recovery 중 TOKEN_REFRESHED 로 풀리지 않는다', () => {
    const t = nextAuthState(signedIn('a', true), 'TOKEN_REFRESHED', session('a'), 'a');
    expect(t.state).toMatchObject({ recovery: true });
  });

  it('비밀번호를 바꾸면(USER_UPDATED) recovery 해제', () => {
    const t = nextAuthState(signedIn('a', true), 'USER_UPDATED', session('a'), 'a');
    expect(t.state).toMatchObject({ recovery: false });
    expect(t.recoveryUserId).toBeNull();
  });

  it('새로고침(INITIAL_SESSION)해도 같은 사용자면 저장된 recovery 복원', () => {
    expect(nextAuthState(loading, 'INITIAL_SESSION', session('a'), 'a').state).toMatchObject({
      recovery: true,
    });
    expect(nextAuthState(loading, 'INITIAL_SESSION', session('b'), 'a').state).toMatchObject({
      recovery: false,
    });
  });

  it('recovery 중 다른 계정으로 로그인(SIGNED_IN)하면 해제 + 캐시 비움', () => {
    const t = nextAuthState(signedIn('a', true), 'SIGNED_IN', session('b'), 'a');
    expect(t.state).toMatchObject({ recovery: false });
    expect(t.clearCache).toBe(true);
  });

  it('탭 복귀로 같은 사용자 SIGNED_IN 이 다시 와도 recovery 유지', () => {
    expect(nextAuthState(signedIn('a', true), 'SIGNED_IN', session('a'), 'a').state).toMatchObject({
      recovery: true,
    });
  });

  it('로그아웃 없이 계정이 바뀌면(재설정 링크 등) 캐시 비움', () => {
    expect(nextAuthState(signedIn('a'), 'PASSWORD_RECOVERY', session('b'), null).clearCache).toBe(
      true
    );
  });

  it('로그아웃은 캐시 비움', () => {
    expect(nextAuthState(signedIn('a'), 'SIGNED_OUT', null, null).clearCache).toBe(true);
  });
});
