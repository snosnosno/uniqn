import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AuthContext, type AuthState } from './authContext';
import { nextAuthState } from './authState';

const RECOVERY_KEY = 'ops-web:recovery-user';

function readRecovery(): string | null {
  try {
    return sessionStorage.getItem(RECOVERY_KEY);
  } catch {
    return null;
  }
}

function writeRecovery(userId: string | null): void {
  try {
    if (userId) sessionStorage.setItem(RECOVERY_KEY, userId);
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // 저장소 접근 불가 — 새로고침 시 recovery 복원만 못 한다(재설정 화면이 만료 안내로 간다).
  }
}

/**
 * Supabase 세션을 React 상태로 올린다. `onAuthStateChange` 가 구독 즉시 INITIAL_SESSION 을
 * 보내므로 별도 getSession 호출이 필요 없다(첫 이벤트 전까지 loading). 전이 규칙 = authState.ts.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const stateRef = useRef(state);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const t = nextAuthState(stateRef.current, event, session, readRecovery());
      // 이전 계정의 데이터가 다음 계정 화면에 남지 않게 한다.
      if (t.clearCache) queryClient.clear();
      writeRecovery(t.recoveryUserId);
      stateRef.current = t.state;
      setState(t.state);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
