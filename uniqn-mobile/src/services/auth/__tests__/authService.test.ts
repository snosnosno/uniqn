import { getUserProfile, login, signOut, signUp } from '../authCoreService';
import { ERROR_CODES } from '@/errors';

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockGetUser = jest.fn();

const mockProtectAuthFlow = jest.fn();
const mockClearProtectedAuthFlow = jest.fn();

const mockTrackLogin = jest.fn();
const mockTrackSignup = jest.fn();
const mockTrackLogout = jest.fn();
const mockSetUserId = jest.fn();
const mockSetUserProperties = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

jest.mock('@/shared/auth/protectedAuthFlow', () => ({
  protectAuthFlow: (...args: unknown[]) => mockProtectAuthFlow(...args),
  clearProtectedAuthFlow: (...args: unknown[]) => mockClearProtectedAuthFlow(...args),
}));

jest.mock('@/repositories', () => ({
  userRepository: {
    getById: jest.fn(),
  },
}));

jest.mock('@/shared/cache/counterSyncCache', () => ({
  clearCounterSyncCache: jest.fn(),
}));

jest.mock('@/shared/realtime', () => ({
  RealtimeManager: {
    unsubscribeAll: jest.fn(),
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

jest.mock('@/utils/security', () => ({
  createClientRateLimiter: jest.fn(() => ({
    tryAcquire: jest.fn(() => true),
    getWaitTime: jest.fn(() => 0),
  })),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
  maskValue: jest.fn((value: string) => value),
}));

jest.mock('@/services/observability/analyticsService', () => ({
  trackLogin: (...args: unknown[]) => mockTrackLogin(...args),
  trackSignup: (...args: unknown[]) => mockTrackSignup(...args),
  trackLogout: (...args: unknown[]) => mockTrackLogout(...args),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
}));

jest.mock('@/services/observability/sessionService', () => ({
  checkLoginAttempts: jest.fn(async () => undefined),
  incrementLoginAttempts: jest.fn(async () => undefined),
  resetLoginAttempts: jest.fn(async () => undefined),
}));

const mockClearBiometricCredentials = jest.fn<Promise<void>, []>();
const mockClearSession = jest.fn<Promise<void>, []>();

jest.mock('../biometricService', () => ({
  clearBiometricCredentials: () => mockClearBiometricCredentials(),
}));

jest.mock('@/lib/secureStorage', () => ({
  userSessionStorage: {
    clearSession: () => mockClearSession(),
  },
}));

jest.mock('../portOneIdentityService', () => ({
  callVerifyAndSavePortOneProfile: jest.fn().mockResolvedValue(undefined),
  clearPortOneIdentityBindingToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../userProfileService', () => ({
  getUserProfile: jest.fn(),
}));

const mockUnregisterPushTokensForSignOut = jest.fn<Promise<void>, [string]>();

jest.mock('@/services/notifications', () => ({
  __esModule: true,
  unregisterPushTokensForSignOut: (...args: [string]) =>
    mockUnregisterPushTokensForSignOut(...args),
}));

const { getUserProfile: mockFetchUserProfile } = jest.requireMock('../userProfileService') as {
  getUserProfile: jest.Mock;
};
const { callVerifyAndSavePortOneProfile: mockCallVerify } = jest.requireMock(
  '../portOneIdentityService'
) as { callVerifyAndSavePortOneProfile: jest.Mock };

describe('authCoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockUnregisterPushTokensForSignOut.mockResolvedValue(undefined);
  });

  it('logs in with Supabase signInWithPassword', async () => {
    const supabaseUser = {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { name: 'User' },
      app_metadata: { providers: ['email'] },
    };
    const profile = {
      uid: 'user-1',
      email: 'test@example.com',
      name: 'User',
      role: 'staff',
      phoneVerified: true,
      createdAt: new Date() as never,
      updatedAt: new Date() as never,
    };

    mockSignInWithPassword.mockResolvedValue({
      data: { user: supabaseUser, session: { access_token: 'token' } },
      error: null,
    });
    mockFetchUserProfile.mockResolvedValue(profile);

    const result = await login({ email: 'test@example.com', password: 'Password123!' });

    expect(result).toEqual({ user: supabaseUser, profile });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Password123!',
    });
    expect(mockTrackLogin).toHaveBeenCalledWith('email');
  });

  it('throws AuthError when signInWithPassword fails', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    });

    await expect(login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow();
  });

  it('signs out lingering session when profile is missing (orphan login)', async () => {
    // signInWithPassword 는 세션을 생성하지만 public.users 프로필이 없는 orphan 계정.
    // signUp/Apple 경로처럼 잔존 세션을 정리해야 authStore 가 끌려가지 않는다.
    const supabaseUser = {
      id: 'user-orphan',
      email: 'orphan@example.com',
      user_metadata: {},
      app_metadata: { providers: ['email'] },
    };

    mockSignInWithPassword.mockResolvedValue({
      data: { user: supabaseUser, session: { access_token: 'token' } },
      error: null,
    });
    mockFetchUserProfile.mockResolvedValue(null);

    await expect(
      login({ email: 'orphan@example.com', password: 'Password123!' })
    ).rejects.toMatchObject({ code: ERROR_CODES.AUTH_USER_NOT_FOUND });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signs up with Supabase auth and edge function', async () => {
    const supabaseUser = {
      id: 'user-1',
      email: 'new@example.com',
      user_metadata: { name: 'User' },
      app_metadata: { providers: ['email'] },
    };
    const profile = {
      uid: 'user-1',
      email: 'new@example.com',
      name: 'User',
      role: 'staff',
      phoneVerified: true,
      createdAt: new Date() as never,
      updatedAt: new Date() as never,
    };

    mockSignUp.mockResolvedValue({
      data: { user: supabaseUser, session: { access_token: 'token' } },
      error: null,
    });
    mockCallVerify.mockResolvedValue(undefined);
    mockFetchUserProfile.mockResolvedValue(profile);

    const result = await signUp({
      email: 'new@example.com',
      password: 'Password123!',
      name: 'User',
      identityVerificationId: 'imp_123',
      termsAgreed: true,
      privacyAgreed: true,
      thirdPartyAgreed: true,
      marketingAgreed: false,
    } as never);

    expect(result).toEqual({ user: supabaseUser, profile });
    expect(mockSignUp).toHaveBeenCalled();
    expect(mockCallVerify).toHaveBeenCalled();
    expect(mockTrackSignup).toHaveBeenCalledWith('email');
  });

  it('recovers when email already exists (orphan) by signing in and resuming profile save', async () => {
    // 이메일 확인 OFF 환경: 중복 이메일은 하드 422 user_already_exists 로 옴
    const existingUser = {
      id: 'user-orphan',
      email: 'dup@example.com',
      user_metadata: {},
      app_metadata: { providers: ['email'] },
    };
    const profile = {
      uid: 'user-orphan',
      email: 'dup@example.com',
      name: 'Dup',
      role: 'staff',
      phoneVerified: true,
      createdAt: new Date() as never,
      updatedAt: new Date() as never,
    };

    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'user_already_exists', status: 422, message: 'User already registered' },
    });
    // 기존 orphan 계정, 입력 비번 일치 → signIn 성공 후 프로필 저장 이어서 완료
    mockSignInWithPassword.mockResolvedValue({
      data: { user: existingUser, session: { access_token: 'token' } },
      error: null,
    });
    mockCallVerify.mockResolvedValue(undefined);
    mockFetchUserProfile.mockResolvedValue(profile);

    const result = await signUp({
      email: 'dup@example.com',
      password: 'Password123!',
      name: 'Dup',
      identityVerificationId: 'imp_dup',
      termsAgreed: true,
      privacyAgreed: true,
      thirdPartyAgreed: true,
      marketingAgreed: false,
    } as never);

    expect(mockSignInWithPassword).toHaveBeenCalled();
    expect(mockCallVerify).toHaveBeenCalled();
    expect(result).toEqual({ user: existingUser, profile });
  });

  it('throws AUTH_EMAIL_ALREADY_EXISTS when email exists but password mismatches', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'user_already_exists', status: 422, message: 'User already registered' },
    });
    // 기존 계정이지만 비번 불일치 → 클라이언트 복구 불가, 로그인 안내
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    await expect(
      signUp({
        email: 'dup@example.com',
        password: 'WrongPass1!',
        name: 'Dup',
        identityVerificationId: 'imp_dup',
        termsAgreed: true,
        privacyAgreed: true,
        thirdPartyAgreed: true,
        marketingAgreed: false,
      } as never)
    ).rejects.toMatchObject({ code: ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS });

    expect(mockCallVerify).not.toHaveBeenCalled();
  });

  it('rejects signUp when identityVerificationId is missing', async () => {
    await expect(
      signUp({
        email: 'no-portone@example.com',
        password: 'Password123!',
        name: 'No PortOne',
        termsAgreed: true,
        privacyAgreed: true,
        thirdPartyAgreed: true,
        marketingAgreed: false,
      } as never)
    ).rejects.toThrow();

    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockCallVerify).not.toHaveBeenCalled();
  });

  it('cleans up on signup failure', async () => {
    const supabaseUser = {
      id: 'user-1',
      email: 'new@example.com',
      user_metadata: { name: 'User' },
      app_metadata: { providers: ['email'] },
    };

    mockSignUp.mockResolvedValue({
      data: { user: supabaseUser, session: { access_token: 'token' } },
      error: null,
    });
    mockCallVerify.mockRejectedValue(new Error('edge function failed'));

    await expect(
      signUp({
        email: 'new@example.com',
        password: 'Password123!',
        name: 'User',
        identityVerificationId: 'imp_123',
        termsAgreed: true,
        privacyAgreed: true,
        thirdPartyAgreed: true,
        marketingAgreed: false,
      } as never)
    ).rejects.toThrow();

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signs out and clears session side effects', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    await expect(signOut()).resolves.toBeUndefined();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockTrackLogout).toHaveBeenCalledTimes(1);
    expect(mockSetUserId).toHaveBeenCalledWith(null);
    // P0 #3 — 공용 디바이스 자격증명 잔존 방지
    expect(mockClearBiometricCredentials).toHaveBeenCalledTimes(1);
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it('signs out even when biometric cleanup throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockClearBiometricCredentials.mockRejectedValueOnce(new Error('SecureStore busy'));

    await expect(signOut()).resolves.toBeUndefined();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  // A3 — 로그아웃 시 서버 푸시 토큰 해제 (공용 기기 계정 간 알림 노출 방지)
  it('로그아웃 시 현재 사용자의 서버 푸시 토큰을 해제한다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    await expect(signOut()).resolves.toBeUndefined();
    expect(mockUnregisterPushTokensForSignOut).toHaveBeenCalledWith('user-1');
  });

  it('푸시 토큰 해제는 supabase 세션 종료 이전에 호출된다 (세션 유효 시점)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const callOrder: string[] = [];
    mockUnregisterPushTokensForSignOut.mockImplementationOnce(async () => {
      callOrder.push('unregisterPush');
    });
    mockSignOut.mockImplementationOnce(async () => {
      callOrder.push('supabaseSignOut');
      return { error: null };
    });

    await signOut();

    expect(callOrder).toEqual(['unregisterPush', 'supabaseSignOut']);
  });

  it('푸시 토큰 해제가 실패해도 로그아웃은 완료된다 (fail-safe)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockUnregisterPushTokensForSignOut.mockRejectedValueOnce(new Error('network down'));

    await expect(signOut()).resolves.toBeUndefined();
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockSetUserId).toHaveBeenCalledWith(null);
  });

  it('푸시 토큰 해제가 4초를 넘겨도 타임아웃 후 로그아웃을 완료한다 (느린 네트워크)', async () => {
    jest.useFakeTimers();
    try {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
      // 해제가 영원히 지연되는 상황(느린/끊긴 네트워크)을 모사 — 4초 타임아웃이 이겨야 한다.
      mockUnregisterPushTokensForSignOut.mockReturnValueOnce(new Promise<void>(() => {}));

      const signOutPromise = signOut();
      // 선행 await(getUser 등) 마이크로태스크 소진 → withTimeout 4초 타이머 스케줄
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(4000);

      await expect(signOutPromise).resolves.toBeUndefined();
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockSetUserId).toHaveBeenCalledWith(null);
    } finally {
      jest.useRealTimers();
    }
  });

  it('로그인 사용자가 없으면 푸시 토큰 해제를 시도하지 않는다', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(signOut()).resolves.toBeUndefined();
    expect(mockUnregisterPushTokensForSignOut).not.toHaveBeenCalled();
  });

  it('returns user profiles from the repository', async () => {
    const profile = {
      uid: 'user-1',
      email: 'user-1@example.com',
      name: 'User',
      role: 'staff',
      createdAt: new Date() as never,
      updatedAt: new Date() as never,
    };
    mockFetchUserProfile.mockResolvedValue(profile);

    await expect(getUserProfile('user-1')).resolves.toEqual(profile);
    expect(mockFetchUserProfile).toHaveBeenCalledWith('user-1');
  });
});
