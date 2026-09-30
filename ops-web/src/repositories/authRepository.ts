/**
 * 인증 Repository — Supabase Auth + `users` 진입 판정 4컬럼 조회.
 * 클라이언트를 주입받아 테스트에서 가짜를 넣을 수 있게 한다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthError, ERROR_CODES } from '@/core/errors/AppError';
import { handleSupabaseError } from '@/lib/supabaseUtils';
import type { EntryProfile } from '@/auth/entry';

interface EntryProfileRow {
  social_provider: string | null;
  phone_verified: boolean | null;
  identity_verified: boolean | null;
  profile_completed: boolean | null;
}

const SOCIAL_PROVIDERS = ['apple', 'google', 'kakao', 'naver'] as const;

export function toEntryProfile(row: EntryProfileRow): EntryProfile {
  const provider = SOCIAL_PROVIDERS.find((p) => p === row.social_provider) ?? null;
  return {
    socialProvider: provider,
    phoneVerified: row.phone_verified,
    identityVerified: row.identity_verified,
    profileCompleted: row.profile_completed,
  };
}

export async function fetchEntryProfile(
  client: SupabaseClient,
  userId: string
): Promise<EntryProfile | null> {
  const { data, error } = await client
    .from('users')
    .select('social_provider, phone_verified, identity_verified, profile_completed')
    .eq('id', userId)
    .maybeSingle<EntryProfileRow>();
  if (error) handleSupabaseError(error, { operation: 'fetchEntryProfile', table: 'users' });
  return data ? toEntryProfile(data) : null;
}

/**
 * 이메일 + 비밀번호 로그인. 자격 증명 오류는 어느 쪽이 틀렸는지 알려주지 않는다(계정 열거 방지).
 */
export async function signInWithPassword(
  client: SupabaseClient,
  email: string,
  password: string
): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (!error) return;
  if (error.status === 400 || error.code === 'invalid_credentials') {
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      message: error.message,
      userMessage: '이메일 또는 비밀번호가 올바르지 않습니다',
    });
  }
  handleSupabaseError(error, { operation: 'signInWithPassword' });
}

/**
 * 이 기기에서만 로그아웃한다. 🔑 auth-js 기본값은 `scope: 'global'` 이라 인자 없이 부르면
 * 사장님의 폰 앱·다른 태블릿 콘솔까지 전부 끊긴다 — 모바일 auth-F2 와 같은 계약(`authCoreService`).
 */
export async function signOut(client: SupabaseClient): Promise<void> {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) handleSupabaseError(error, { operation: 'signOut' });
}

/** 비밀번호 재설정 메일 — 링크는 ops 웹 `/reset-password` 로 돌아온다(설계 §4.1). */
export async function requestPasswordReset(
  client: SupabaseClient,
  email: string,
  origin: string
): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  // 없는 이메일이어도 같은 응답을 보여준다(계정 열거 방지) — 전송 실패만 알린다.
  // 429(재전송 주기 제한)는 **존재하는 계정에만** 나올 수 있어 성공과 같게 취급한다.
  if (error && error.status !== 400 && error.status !== 422 && error.status !== 429) {
    handleSupabaseError(error, { operation: 'requestPasswordReset' });
  }
}

export async function updatePassword(client: SupabaseClient, password: string): Promise<void> {
  const { error } = await client.auth.updateUser({ password });
  if (!error) return;
  if (error.code === 'same_password') {
    throw new AuthError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      message: error.message,
      userMessage: '이전과 다른 비밀번호를 입력해 주세요',
    });
  }
  handleSupabaseError(error, { operation: 'updatePassword' });
}
