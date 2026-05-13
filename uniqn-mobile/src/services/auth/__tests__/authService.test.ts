import {
  getUserProfile,
  login,
  rollbackPhoneOnlyAccount,
  signOut,
  signUp,
} from '../authCoreService';
import { Platform } from 'react-native';

import { userRepository } from '@/repositories';

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
    markAsOrphan: jest.fn(),
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

jest.mock('@/utils/recaptcha', () => ({
  getRecaptchaToken: jest.fn(async () => undefined),
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

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
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
    mockUserRepository.markAsOrphan.mockResolvedValue(undefined);
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

  it('rollback marks orphan and signs out without throwing', async () => {
    await expect(
      rollbackPhoneOnlyAccount('user-rollback', 'native_signup_rollback_failed', '01012345678')
    ).resolves.toBeUndefined();

    expect(mockUserRepository.markAsOrphan).toHaveBeenCalledWith(
      'user-rollback',
      'native_signup_rollback_failed',
      '01012345678',
      Platform.OS
    );
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('rollback does not throw when markAsOrphan fails', async () => {
    mockUserRepository.markAsOrphan.mockRejectedValue(new Error('mark failed'));

    await expect(
      rollbackPhoneOnlyAccount('user-rollback', 'native_signup_rollback_failed', '01012345678')
    ).resolves.toBeUndefined();

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
