import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** recovery = 비밀번호 재설정 링크로 들어온 세션(PASSWORD_RECOVERY). */
  | { status: 'signedIn'; session: Session; recovery: boolean };

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 는 <AuthProvider> 안에서만 쓸 수 있습니다');
  return value;
}
