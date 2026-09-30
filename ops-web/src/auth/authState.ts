/**
 * Supabase 인증 이벤트 → 앱 인증 상태 전이(순수 함수). AuthProvider 가 쓴다.
 *
 * recovery(재설정 링크 세션)는 비밀번호를 바꿀 때까지 유지해야 한다 — 새로고침하면 이벤트가
 * PASSWORD_RECOVERY 가 아니라 INITIAL_SESSION 으로 들어오므로 `storedRecoveryUserId`(sessionStorage)로 복원한다.
 */
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { AuthState } from './authContext';

export interface Transition {
  state: AuthState;
  /** 다른 계정으로 바뀌었거나 로그아웃 — 이전 계정 캐시를 비워야 한다. */
  clearCache: boolean;
  /** sessionStorage 에 남길 recovery 사용자 id(null 이면 지운다). */
  recoveryUserId: string | null;
}

export function nextAuthState(
  prev: AuthState,
  event: AuthChangeEvent,
  session: Session | null,
  storedRecoveryUserId: string | null
): Transition {
  const prevUserId = prev.status === 'signedIn' ? prev.session.user.id : null;

  if (!session) {
    return {
      state: { status: 'signedOut' },
      clearCache: prevUserId !== null || event === 'SIGNED_OUT',
      recoveryUserId: null,
    };
  }

  const userId = session.user.id;
  const switched = prevUserId !== null && prevUserId !== userId;

  let recovery: boolean;
  if (event === 'PASSWORD_RECOVERY') recovery = true;
  else if (event === 'USER_UPDATED') recovery = false;
  // SIGNED_IN 은 탭 복귀 때 같은 사용자로도 다시 온다 — 계정이 바뀐 경우에만 푼다.
  else if (switched) recovery = false;
  else if (prev.status === 'signedIn') recovery = prev.recovery;
  else recovery = storedRecoveryUserId === userId; // INITIAL_SESSION(새로고침) 복원

  return {
    state: { status: 'signedIn', session, recovery },
    clearCache: switched,
    recoveryUserId: recovery ? userId : null,
  };
}
