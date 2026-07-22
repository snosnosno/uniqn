/**
 * 비밀번호 재설정 경로 테스트
 *
 * 회귀 배경(2026-07-22): resetPasswordForEmail 을 redirectTo 없이 호출해
 * Supabase Site URL(기본값 http://localhost:3000)로 폴백 → 메일 링크가
 * 접속 불가 주소로 착지했다. 재설정 화면도 없어 복구 경로가 끊겨 있었다.
 */

import { resetPassword, completePasswordReset, hasRecoverySession } from '../authCoreService';
import { getPasswordResetRedirectUrl } from '@/constants/appUrl';

const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
  maskValue: jest.fn((value: string) => value),
}));

describe('비밀번호 재설정', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
  });

  describe('getPasswordResetRedirectUrl', () => {
    it('재설정 화면 경로로 끝나는 절대 URL을 만든다', () => {
      const url = getPasswordResetRedirectUrl();

      expect(url).toMatch(/^https?:\/\//);
      expect(url.endsWith('/reset-password')).toBe(true);
    });

    it('localhost 기본값으로 폴백하지 않는다', () => {
      expect(getPasswordResetRedirectUrl()).not.toContain('localhost');
    });
  });

  describe('resetPassword', () => {
    it('redirectTo 를 명시해 Site URL 폴백을 막는다', async () => {
      await resetPassword('user@example.com');

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
        redirectTo: getPasswordResetRedirectUrl(),
      });
    });

    it('Supabase 오류는 그대로 전파한다', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: new Error('smtp down') });

      await expect(resetPassword('user@example.com')).rejects.toThrow('smtp down');
    });
  });

  describe('hasRecoverySession', () => {
    it('복구 세션이 있으면 true', async () => {
      await expect(hasRecoverySession()).resolves.toBe(true);
    });

    it('링크가 이미 사용/만료돼 세션이 없으면 false', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      await expect(hasRecoverySession()).resolves.toBe(false);
    });

    it('조회 자체가 실패해도 throw 하지 않고 false', async () => {
      mockGetSession.mockRejectedValue(new Error('network down'));

      await expect(hasRecoverySession()).resolves.toBe(false);
    });
  });

  describe('completePasswordReset', () => {
    it('현재 비밀번호 없이 새 비밀번호만으로 갱신한다', async () => {
      await completePasswordReset('NewPass1!');

      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPass1!' });
    });

    it('복구 세션이 없으면 갱신을 시도하지 않는다', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      await expect(completePasswordReset('NewPass1!')).rejects.toThrow();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('갱신 오류는 그대로 전파한다', async () => {
      mockUpdateUser.mockResolvedValue({ data: null, error: new Error('weak password') });

      await expect(completePasswordReset('NewPass1!')).rejects.toThrow('weak password');
    });
  });
});
