import { describe, expect, it, vi } from 'vitest';
import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { AuthError, NetworkError } from '@/core/errors/AppError';
import {
  requestPasswordReset,
  signInWithPassword,
  signOut,
  toEntryProfile,
  updatePassword,
} from './authRepository';

type AuthErr = { status?: number; code?: string; message: string } | Error | null;

/** supabase-js 가 fetch 단절 때 실제로 돌려주는 에러(평객체 흉내가 아니라 실물). */
const fetchFailure = () => new AuthRetryableFetchError('Failed to fetch', 0);

function fakeClient(result: AuthErr) {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ error: result }),
    signOut: vi.fn().mockResolvedValue({ error: result }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: result }),
    updateUser: vi.fn().mockResolvedValue({ error: result }),
  };
  return { client: { auth } as unknown as SupabaseClient, auth };
}

describe('signOut', () => {
  it('이 기기만 로그아웃(scope local) — 폰·다른 태블릿 세션을 끊지 않는다', async () => {
    const { client, auth } = fakeClient(null);
    await signOut(client);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('signInWithPassword', () => {
  it('자격 증명 오류는 어느 쪽이 틀렸는지 말하지 않는 한 문구', async () => {
    const { client } = fakeClient({ status: 400, code: 'invalid_credentials', message: 'x' });
    await expect(signInWithPassword(client, 'a@b.c', 'p')).rejects.toMatchObject({
      userMessage: '이메일 또는 비밀번호가 올바르지 않습니다',
    });
  });

  it('네트워크 단절은 네트워크 에러', async () => {
    const { client } = fakeClient(fetchFailure());
    await expect(signInWithPassword(client, 'a@b.c', 'p')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('requestPasswordReset', () => {
  it.each([400, 422, 429])('%s 는 성공과 같게(계정 열거 방지)', async (status) => {
    const { client } = fakeClient({ status, message: 'x' });
    await expect(requestPasswordReset(client, 'a@b.c', 'http://x')).resolves.toBeUndefined();
  });

  it('재설정 링크는 ops 웹 /reset-password 로 돌아온다', async () => {
    const { client, auth } = fakeClient(null);
    await requestPasswordReset(client, 'a@b.c', 'https://ops.uniqn.app');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.c', {
      redirectTo: 'https://ops.uniqn.app/reset-password',
    });
  });

  it('전송 실패(네트워크)는 알린다', async () => {
    const { client } = fakeClient(fetchFailure());
    await expect(requestPasswordReset(client, 'a@b.c', 'http://x')).rejects.toBeInstanceOf(
      NetworkError
    );
  });
});

describe('updatePassword', () => {
  it('같은 비밀번호는 한글 안내', async () => {
    const { client } = fakeClient({ status: 422, code: 'same_password', message: 'x' });
    const err = await updatePassword(client, 'Aa1!aaaa').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).userMessage).toBe('이전과 다른 비밀번호를 입력해 주세요');
  });
});

describe('toEntryProfile', () => {
  it('알 수 없는 소셜 제공자는 null', () => {
    expect(
      toEntryProfile({
        social_provider: 'myspace',
        phone_verified: true,
        identity_verified: true,
        profile_completed: true,
      }).socialProvider
    ).toBeNull();
  });
});
