import {
  getUserProfile,
  login,
  rollbackPhoneOnlyAccount,
  signOut,
  signUp,
} from '../authCoreService';
import { Platform } from 'react-native';
import { ERROR_CODES } from '@/errors';

import { userRepository } from '@/repositories';

const mockWebAuth = {
  currentUser: null as null | {
    uid: string;
    email?: string | null;
    getIdToken: jest.Mock<Promise<string>, [boolean?]>;
    getIdTokenResult: jest.Mock<Promise<{ claims: Record<string, unknown> }>, []>;
  },
  authStateReady: jest.fn().mockResolvedValue(undefined),
  onAuthStateChanged: jest.fn(),
};

const mockNativeAuth = {
  currentUser: null as null | {
    uid: string;
    providerData: { providerId: string }[];
  },
};

const mockFunctions = {};

const mockSignInWithEmailAndPassword = jest.fn();
const mockSendPasswordResetEmail = jest.fn();

const mockNativeSignInWithEmailAndPassword = jest.fn();
const mockNativeLinkWithCredential = jest.fn();
const mockNativeDeleteUser = jest.fn();

const mockSyncToWebAuth = jest.fn();
const mockSyncSignOut = jest.fn();
const mockProtectAuthFlow = jest.fn();
const mockClearProtectedAuthFlow = jest.fn();

const mockHttpsCallable = jest.fn();
const mockTrackLogin = jest.fn();
const mockTrackSignup = jest.fn();
const mockTrackLogout = jest.fn();
const mockSetUserId = jest.fn();
const mockSetUserProperties = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
      signUp: jest.fn(),
      signOut: (...args: unknown[]) => mockSyncSignOut(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    functions: {
      invoke: (...args: unknown[]) => mockHttpsCallable(...args),
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

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

describe('authCoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebAuth.currentUser = null;
    mockWebAuth.authStateReady.mockResolvedValue(undefined);
    mockWebAuth.onAuthStateChanged.mockImplementation(() => () => undefined);
    mockNativeAuth.currentUser = null;
    mockSyncToWebAuth.mockResolvedValue(undefined);
    mockSyncSignOut.mockResolvedValue(undefined);
    mockNativeDeleteUser.mockResolvedValue(undefined);
    mockUserRepository.markAsOrphan.mockResolvedValue(undefined);
  });

  it('logs in with native and web auth on native platforms', async () => {
    const webUser = {
      uid: 'user-1',
      email: 'test@example.com',
      getIdToken: jest.fn().mockResolvedValue('token'),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
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

    mockNativeAuth.currentUser = { uid: 'user-1', providerData: [] };
    mockWebAuth.currentUser = webUser;
    mockNativeSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'user-1' } });
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: webUser });
    mockUserRepository.getById.mockResolvedValue(profile as never);

    await expect(login({ email: 'test@example.com', password: 'Password123!' })).resolves.toEqual({
      user: webUser,
      profile,
    });
    expect(mockNativeSignInWithEmailAndPassword).toHaveBeenCalled();
    expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
    expect(webUser.getIdToken).toHaveBeenCalledWith(true);
    expect(mockTrackLogin).toHaveBeenCalledWith('email');
  });

  it('keeps the web login session when the immediate forced token refresh fails', async () => {
    const originalPlatform = Platform.OS;
    const webUser = {
      uid: 'user-web',
      email: 'web@example.com',
      getIdToken: jest.fn().mockRejectedValue(new Error('auth/network-request-failed')),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };
    const profile = {
      uid: 'user-web',
      email: 'web@example.com',
      name: 'Web User',
      role: 'staff',
      phoneVerified: true,
      createdAt: new Date() as never,
      updatedAt: new Date() as never,
    };

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      mockWebAuth.currentUser = webUser;
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: webUser });
      mockUserRepository.getById.mockResolvedValue(profile as never);

      await expect(login({ email: 'web@example.com', password: 'Password123!' })).resolves.toEqual({
        user: webUser,
        profile,
      });

      expect(webUser.getIdTokenResult).toHaveBeenCalledTimes(1);
      expect(webUser.getIdToken).toHaveBeenCalledWith(true);
      expect(mockSyncSignOut).not.toHaveBeenCalled();
      expect(mockTrackLogin).toHaveBeenCalledWith('email');
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('waits for the web auth session before loading the profile after login', async () => {
    const originalPlatform = Platform.OS;
    const webUser = {
      uid: 'user-wait',
      email: 'wait@example.com',
      getIdToken: jest.fn().mockResolvedValue('token'),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
    };
    const profile = {
      uid: 'user-wait',
      email: 'wait@example.com',
      name: 'Wait User',
      role: 'staff',
      phoneVerified: true,
      createdAt: new Date() as never,
      updatedAt: new Date() as never,
    };

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      mockWebAuth.currentUser = null;
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: webUser });
      mockWebAuth.authStateReady.mockImplementation(async () => {
        mockWebAuth.currentUser = webUser;
      });
      mockWebAuth.onAuthStateChanged.mockImplementation(
        (callback: (user: typeof webUser) => void) => {
          callback(webUser);
          return () => undefined;
        }
      );
      mockUserRepository.getById.mockResolvedValue(profile as never);

      await expect(login({ email: 'wait@example.com', password: 'Password123!' })).resolves.toEqual(
        {
          user: webUser,
          profile,
        }
      );

      expect(mockWebAuth.authStateReady).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.getById).toHaveBeenCalledWith('user-wait');
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('signs up a phone-verified native user through verifyAndSaveProfile', async () => {
    const nativeUser = { uid: 'user-1', providerData: [] };
    const webUser = {
      uid: 'user-1',
      email: 'new@example.com',
      getIdToken: jest.fn().mockResolvedValue('token'),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
    };
    const callable = jest.fn().mockResolvedValue({ data: { success: true, uid: 'user-1' } });
    const profile = {
      uid: 'user-1',
      email: 'new@example.com',
      name: 'User',
      role: 'staff',
      phoneVerified: true,
      createdAt: new Date() as never,
      updatedAt: new Date() as never,
    };

    mockNativeAuth.currentUser = nativeUser;
    mockWebAuth.currentUser = webUser;
    mockNativeLinkWithCredential.mockResolvedValue(undefined);
    mockHttpsCallable.mockReturnValue(callable);
    mockUserRepository.getById.mockResolvedValue(profile as never);

    await expect(
      signUp({
        email: 'new@example.com',
        password: 'Password123!',
        name: 'User',
        birthDate: '19900101',
        gender: 'male',
        verifiedPhone: '01012345678',
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: false,
      } as never)
    ).resolves.toEqual({
      user: webUser,
      profile,
    });

    expect(mockNativeLinkWithCredential).toHaveBeenCalled();
    expect(mockSyncToWebAuth).toHaveBeenCalledWith('new@example.com', 'Password123!');
    expect(mockHttpsCallable).toHaveBeenCalledWith(mockFunctions, 'verifyAndSaveProfile');
    expect(callable).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        name: 'User',
        mode: 'signup',
      })
    );
    expect(webUser.getIdToken).toHaveBeenCalledWith(true);
    expect(mockTrackSignup).toHaveBeenCalledWith('email');
  });

  it('re-syncs the Web SDK session when it disappears after verifyAndSaveProfile', async () => {
    const nativeUser = { uid: 'user-1', providerData: [] };
    const webUser = {
      uid: 'user-1',
      email: 'new@example.com',
      getIdToken: jest.fn().mockResolvedValue('token'),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
    };
    const callable = jest.fn().mockImplementation(async () => {
      mockWebAuth.currentUser = null;
      return { data: { success: true, uid: 'user-1' } };
    });
    const profile = {
      uid: 'user-1',
      email: 'new@example.com',
      name: 'User',
      role: 'staff',
      phoneVerified: true,
      createdAt: new Date() as never,
      updatedAt: new Date() as never,
    };

    mockNativeAuth.currentUser = nativeUser;
    mockNativeLinkWithCredential.mockResolvedValue(undefined);
    mockSyncToWebAuth.mockImplementation(async () => {
      mockWebAuth.currentUser = webUser;
    });
    mockHttpsCallable.mockReturnValue(callable);
    mockUserRepository.getById.mockResolvedValue(profile as never);

    await expect(
      signUp({
        email: 'new@example.com',
        password: 'Password123!',
        name: 'User',
        birthDate: '19900101',
        gender: 'male',
        verifiedPhone: '01012345678',
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: false,
      } as never)
    ).resolves.toEqual({
      user: webUser,
      profile,
    });

    expect(mockSyncToWebAuth).toHaveBeenCalledTimes(2);
    expect(webUser.getIdToken).toHaveBeenCalledWith(true);
  });

  it('does not roll back the account when session restore fails after verifyAndSaveProfile succeeds', async () => {
    const nativeUser = { uid: 'user-1', providerData: [] };
    const webUser = {
      uid: 'user-1',
      email: 'new@example.com',
      getIdToken: jest.fn().mockResolvedValue('token'),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
    };
    const callable = jest.fn().mockImplementation(async () => {
      mockWebAuth.currentUser = null;
      return { data: { success: true, uid: 'user-1' } };
    });

    mockNativeAuth.currentUser = nativeUser;
    mockNativeLinkWithCredential.mockResolvedValue(undefined);
    mockSyncToWebAuth
      .mockImplementationOnce(async () => {
        mockWebAuth.currentUser = webUser;
      })
      .mockRejectedValueOnce(new Error('web session restore failed'));
    mockHttpsCallable.mockReturnValue(callable);

    await expect(
      signUp({
        email: 'new@example.com',
        password: 'Password123!',
        name: 'User',
        birthDate: '19900101',
        gender: 'male',
        verifiedPhone: '01012345678',
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: false,
      } as never)
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_SESSION_EXPIRED,
    });

    expect(mockNativeDeleteUser).not.toHaveBeenCalled();
    expect(mockUserRepository.markAsOrphan).not.toHaveBeenCalled();
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('rolls back the phone-only account when verifyAndSaveProfile fails', async () => {
    const nativeUser = { uid: 'user-1', providerData: [] };
    const webUser = {
      uid: 'user-1',
      email: 'new@example.com',
      getIdToken: jest.fn().mockResolvedValue('token'),
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
    };
    const callable = jest.fn().mockRejectedValue(new Error('cf failed'));

    mockNativeAuth.currentUser = nativeUser;
    mockNativeLinkWithCredential.mockResolvedValue(undefined);
    mockSyncToWebAuth.mockImplementation(async () => {
      mockWebAuth.currentUser = webUser;
    });
    mockHttpsCallable.mockReturnValue(callable);

    await expect(
      signUp({
        email: 'new@example.com',
        password: 'Password123!',
        name: 'User',
        birthDate: '19900101',
        gender: 'male',
        verifiedPhone: '01012345678',
        termsAgreed: true,
        privacyAgreed: true,
        marketingAgreed: false,
      } as never)
    ).rejects.toThrow();

    expect(mockNativeDeleteUser).toHaveBeenCalledWith(nativeUser);
    expect(mockSyncSignOut).toHaveBeenCalled();
  });

  it('restores the Web SDK session before marking an orphan account during rollback', async () => {
    mockNativeAuth.currentUser = {
      uid: 'user-rollback',
      providerData: [{ providerId: 'password' }],
    };
    mockNativeDeleteUser.mockRejectedValue(new Error('native delete failed'));
    mockWebAuth.currentUser = null;
    mockSyncToWebAuth.mockImplementation(async () => {
      mockWebAuth.currentUser = {
        uid: 'user-rollback',
        providerData: [{ providerId: 'password' }],
      } as never;
    });

    await expect(
      rollbackPhoneOnlyAccount('user-rollback', 'native_signup_rollback_failed', '01012345678')
    ).resolves.toBeUndefined();

    expect(mockSyncToWebAuth).toHaveBeenCalledWith('rollback@example.com', 'Password123!');
    expect(mockUserRepository.markAsOrphan).toHaveBeenCalledWith(
      'user-rollback',
      'native_signup_rollback_failed',
      '01012345678',
      Platform.OS
    );
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('fails rollback when it cannot delete or mark the account', async () => {
    mockNativeAuth.currentUser = {
      uid: 'user-rollback',
      providerData: [{ providerId: 'password' }],
    };
    mockNativeDeleteUser.mockRejectedValue(new Error('native delete failed'));
    mockWebAuth.currentUser = null;

    await expect(
      rollbackPhoneOnlyAccount('user-rollback', 'native_signup_rollback_failed', '01012345678')
    ).rejects.toMatchObject({
      code: ERROR_CODES.UNKNOWN,
    });

    expect(mockUserRepository.markAsOrphan).not.toHaveBeenCalled();
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('signs out and clears session side effects', async () => {
    await expect(signOut()).resolves.toBeUndefined();
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
    expect(mockTrackLogout).toHaveBeenCalledTimes(1);
    expect(mockSetUserId).toHaveBeenCalledWith(null);
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
    mockUserRepository.getById.mockResolvedValue(profile as never);

    await expect(getUserProfile('user-1')).resolves.toEqual(profile);
    expect(mockUserRepository.getById).toHaveBeenCalledWith('user-1');
  });
});
