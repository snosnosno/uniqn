import { getUserProfile, login, signOut, signUp } from '../authCoreService';

import { userRepository } from '@/repositories';

const mockWebAuth = {
  currentUser: null as null | {
    uid: string;
    email?: string | null;
    getIdToken: jest.Mock<Promise<string>, [boolean?]>;
  },
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
const mockLinkWithCredential = jest.fn();
const mockReauthenticateWithCredential = jest.fn();
const mockWebDeleteUser = jest.fn();
const mockWebUnlink = jest.fn();

const mockNativeSignInWithEmailAndPassword = jest.fn();
const mockNativeLinkWithCredential = jest.fn();
const mockNativeDeleteUser = jest.fn();
const mockNativeUnlink = jest.fn();

const mockSyncToWebAuth = jest.fn();
const mockSyncSignOut = jest.fn();

const mockHttpsCallable = jest.fn();
const mockTrackLogin = jest.fn();
const mockTrackSignup = jest.fn();
const mockTrackLogout = jest.fn();
const mockSetUserId = jest.fn();
const mockSetUserProperties = jest.fn();

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  EmailAuthProvider: {
    credential: jest.fn((email: string, password: string) => ({ email, password })),
  },
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticateWithCredential(...args),
  deleteUser: (...args: unknown[]) => mockWebDeleteUser(...args),
  unlink: (...args: unknown[]) => mockWebUnlink(...args),
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => mockWebAuth),
  getFirebaseFunctions: jest.fn(() => mockFunctions),
}));

jest.mock('@/lib/nativeAuth', () => ({
  getNativeAuth: jest.fn(() => mockNativeAuth),
  nativeSignInWithEmailAndPassword: (...args: unknown[]) =>
    mockNativeSignInWithEmailAndPassword(...args),
  nativeLinkWithCredential: (...args: unknown[]) => mockNativeLinkWithCredential(...args),
  nativeDeleteUser: (...args: unknown[]) => mockNativeDeleteUser(...args),
  NativeEmailAuthProvider: {
    credential: jest.fn((email: string, password: string) => ({ email, password })),
  },
  nativeUnlink: (...args: unknown[]) => mockNativeUnlink(...args),
}));

jest.mock('@/lib/authBridge', () => ({
  syncToWebAuth: (...args: unknown[]) => mockSyncToWebAuth(...args),
  syncSignOut: (...args: unknown[]) => mockSyncSignOut(...args),
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

jest.mock('@/services/observability', () => ({
  checkLoginAttempts: jest.fn(async () => undefined),
  incrementLoginAttempts: jest.fn(async () => undefined),
  resetLoginAttempts: jest.fn(async () => undefined),
  trackLogin: (...args: unknown[]) => mockTrackLogin(...args),
  trackSignup: (...args: unknown[]) => mockTrackSignup(...args),
  trackLogout: (...args: unknown[]) => mockTrackLogout(...args),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
}));

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

describe('authCoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebAuth.currentUser = null;
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

  it('signs up a phone-verified native user through verifyAndSaveProfile', async () => {
    const nativeUser = { uid: 'user-1', providerData: [] };
    const webUser = {
      uid: 'user-1',
      email: 'new@example.com',
      getIdToken: jest.fn().mockResolvedValue('token'),
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

  it('rolls back the phone-only account when verifyAndSaveProfile fails', async () => {
    const nativeUser = { uid: 'user-1', providerData: [] };
    const callable = jest.fn().mockRejectedValue(new Error('cf failed'));

    mockNativeAuth.currentUser = nativeUser;
    mockNativeLinkWithCredential.mockResolvedValue(undefined);
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
