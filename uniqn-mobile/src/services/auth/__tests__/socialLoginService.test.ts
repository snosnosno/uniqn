/* eslint-disable @typescript-eslint/no-require-imports */

import { BusinessError, ERROR_CODES, NetworkError } from '@/errors';

const mockSignInWithCredential = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockUpdateProfile = jest.fn();
const mockGetFirebaseAuth = jest.fn();
const mockSyncSignOut = jest.fn();
const mockCreateOrMerge = jest.fn();
const mockGetUserProfile = jest.fn();
const mockSanitizeInput = jest.fn();
const mockTrackLogin = jest.fn();
const mockTrackSignup = jest.fn();
const mockSetUserId = jest.fn();
const mockSetUserProperties = jest.fn();
const mockRequestAppleAuthorization = jest.fn();
const mockWithTimeout = jest.fn();
const mockGetMMKVInstance = jest.fn();
const mockLeaveBreadcrumb = jest.fn();
const mockProtectAuthFlow = jest.fn();
const mockClearProtectedAuthFlow = jest.fn();

const mockMmkv = {
  set: jest.fn(),
  getString: jest.fn(),
};

const mockFirebaseAuth = { name: 'firebase-auth' };
const mockAuthUser = {
  uid: 'firebase-user',
  email: 'apple@example.com',
  getIdToken: jest.fn<Promise<string>, [boolean?]>(),
};

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Appearance: { getColorScheme: jest.fn(() => 'light') },
}));

jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((arr: Uint8Array) => arr),
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

jest.mock('react-native-css-interop', () => ({
  cssInterop: jest.fn(),
  remapProps: jest.fn(),
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: (...args: unknown[]) => mockSignInWithCredential(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
      signUp: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
      signOut: (...args: unknown[]) => mockSyncSignOut(...args),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      updateUser: (...args: unknown[]) => mockUpdateProfile(...args),
    },
  },
}));

jest.mock('@/shared/auth/protectedAuthFlow', () => ({
  protectAuthFlow: (...args: unknown[]) => mockProtectAuthFlow(...args),
  clearProtectedAuthFlow: (...args: unknown[]) => mockClearProtectedAuthFlow(...args),
}));

jest.mock('@/repositories', () => ({
  userRepository: {
    createOrMerge: (...args: unknown[]) => mockCreateOrMerge(...args),
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

jest.mock('@/services/observability/sentryService', () => ({
  sentryService: {
    leaveBreadcrumb: (...args: unknown[]) => mockLeaveBreadcrumb(...args),
  },
}));

jest.mock('@/utils/security', () => ({
  sanitizeInput: (...args: unknown[]) => mockSanitizeInput(...args),
}));

jest.mock('@/services/observability/analyticsService', () => ({
  trackLogin: (...args: unknown[]) => mockTrackLogin(...args),
  trackSignup: (...args: unknown[]) => mockTrackSignup(...args),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
}));

jest.mock('../userProfileService', () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
}));

jest.mock('../authTypes', () => ({
  callVerifyAndSaveProfile: jest.fn(),
}));

jest.mock('../appleAuthService', () => ({
  requestAppleAuthorization: (...args: unknown[]) => mockRequestAppleAuthorization(...args),
}));

jest.mock('@/utils/timeout', () => ({
  withTimeout: (...args: unknown[]) => mockWithTimeout(...args),
}));

jest.mock('@/lib/mmkvStorage', () => ({
  getMMKVInstance: (...args: unknown[]) => mockGetMMKVInstance(...args),
}));

type SocialLoginServiceModule = typeof import('../socialLoginService');

function loadModule(): SocialLoginServiceModule {
  let moduleUnderTest: SocialLoginServiceModule | undefined;

  jest.isolateModules(() => {
    moduleUnderTest = require('../socialLoginService') as SocialLoginServiceModule;
  });

  return moduleUnderTest!;
}

describe('socialLoginService signInWithApple', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useRealTimers();

    (global as typeof global & { __DEV__?: boolean }).__DEV__ = false;

    mockGetFirebaseAuth.mockReturnValue(mockFirebaseAuth);
    mockSyncSignOut.mockResolvedValue(undefined);
    mockWithTimeout.mockImplementation((promise: Promise<unknown>) => promise);
    mockSanitizeInput.mockImplementation((value: string) => value);
    mockGetMMKVInstance.mockReturnValue(mockMmkv);
    mockMmkv.getString.mockReturnValue(undefined);
    mockAuthUser.getIdToken.mockResolvedValue('token');
    mockSignInWithCredential.mockResolvedValue({ user: mockAuthUser });
    mockRequestAppleAuthorization.mockResolvedValue({
      rawNonce: 'raw-nonce',
      credential: {
        identityToken: 'identity-token',
        user: 'apple-user',
        fullName: null,
      },
    });
    mockGetUserProfile.mockResolvedValue({
      uid: 'firebase-user',
      email: 'apple@example.com',
      role: 'staff',
      socialProvider: 'apple',
      phoneVerified: true,
      isActive: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns an existing verified Apple profile', async () => {
    const { signInWithApple } = loadModule();

    const result = await signInWithApple();

    expect(mockRequestAppleAuthorization).toHaveBeenCalledWith({
      requestedScopes: ['FULL_NAME', 'EMAIL'],
      operation: 'login',
    });
    expect(mockSignInWithCredential).toHaveBeenCalledWith(
      mockFirebaseAuth,
      expect.objectContaining({
        providerId: 'apple.com',
        idToken: 'identity-token',
        rawNonce: 'raw-nonce',
      })
    );
    expect(mockTrackLogin).toHaveBeenCalledWith('apple');
    expect(result.profile.phoneVerified).toBe(true);
  });

  it('returns an incomplete existing profile without recreating it', async () => {
    mockGetUserProfile.mockResolvedValue({
      uid: 'firebase-user',
      email: 'apple@example.com',
      role: 'staff',
      socialProvider: 'apple',
      phoneVerified: false,
      isActive: true,
    });

    const { signInWithApple } = loadModule();

    const result = await signInWithApple();

    expect(result.profile.phoneVerified).toBe(false);
    expect(mockCreateOrMerge).not.toHaveBeenCalled();
    expect(mockTrackLogin).not.toHaveBeenCalled();
  });

  it('creates a minimal profile for a new Apple user', async () => {
    mockGetUserProfile.mockResolvedValue(null);

    const { signInWithApple } = loadModule();

    const result = await signInWithApple();

    expect(mockCreateOrMerge).toHaveBeenCalledWith(
      'firebase-user',
      expect.objectContaining({
        uid: 'firebase-user',
        email: 'apple@example.com',
        status: 'active',
        socialProvider: 'apple',
        phoneVerified: false,
        profileCompleted: false,
        isActive: true,
      })
    );
    expect(result.profile.socialProvider).toBe('apple');
    expect(result.profile.phoneVerified).toBe(false);
  });

  it('retries profile creation once after a timeout and completes the Apple login flow', async () => {
    jest.useFakeTimers();

    const networkError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple profile creation timed out.',
    });

    mockGetUserProfile.mockResolvedValue(null);
    mockWithTimeout
      .mockResolvedValueOnce({ user: mockAuthUser })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('token');

    const { signInWithApple } = loadModule();
    const signInPromise = signInWithApple();

    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(3000);

    const result = await signInPromise;

    expect(mockCreateOrMerge).toHaveBeenCalledTimes(2);
    expect(result.profile.socialProvider).toBe('apple');
    expect(result.profile.phoneVerified).toBe(false);
  });

  it('continues the Apple login flow when the profile becomes visible after a timed out write', async () => {
    jest.useFakeTimers();

    const networkError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple profile creation timed out.',
    });

    mockGetUserProfile.mockResolvedValue(null);
    mockWithTimeout
      .mockResolvedValueOnce({ user: mockAuthUser })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        uid: 'firebase-user',
        email: 'apple@example.com',
        role: 'staff',
        socialProvider: 'apple',
        phoneVerified: false,
        isActive: true,
      })
      .mockResolvedValueOnce('token');

    const { signInWithApple } = loadModule();
    const signInPromise = signInWithApple();

    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1000);

    const result = await signInPromise;

    expect(mockCreateOrMerge).toHaveBeenCalledTimes(1);
    expect(result.profile.socialProvider).toBe('apple');
    expect(result.profile.phoneVerified).toBe(false);
  });

  it('falls back to the social signup flow when profile creation keeps timing out', async () => {
    jest.useFakeTimers();

    const networkError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple profile creation timed out.',
    });

    mockGetUserProfile.mockResolvedValue(null);
    mockWithTimeout
      .mockResolvedValueOnce({ user: mockAuthUser })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('token');

    const { signInWithApple } = loadModule();
    const signInPromise = signInWithApple();

    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5000);

    const result = await signInPromise;

    expect(mockCreateOrMerge).toHaveBeenCalledTimes(2);
    expect(mockSyncSignOut).not.toHaveBeenCalled();
    expect(mockProtectAuthFlow).toHaveBeenNthCalledWith(1, 'firebase-user', 'apple_login');
    expect(mockProtectAuthFlow).toHaveBeenNthCalledWith(
      2,
      'firebase-user',
      'social_signup',
      15 * 60 * 1000
    );
    expect(mockClearProtectedAuthFlow).not.toHaveBeenCalled();
    expect(result.profile.socialProvider).toBe('apple');
    expect(result.profile.phoneVerified).toBe(false);
  });

  it('rethrows a cancel event without signing out', async () => {
    mockRequestAppleAuthorization.mockRejectedValue(
      new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '',
      })
    );

    const { signInWithApple } = loadModule();

    await expect(signInWithApple()).rejects.toMatchObject({
      userMessage: '',
    });
    expect(mockSyncSignOut).not.toHaveBeenCalled();
  });

  it('keeps the invalid credential error when Apple does not return an identity token', async () => {
    mockRequestAppleAuthorization.mockResolvedValue({
      rawNonce: 'raw-nonce',
      credential: {
        identityToken: null,
        user: 'apple-user',
        fullName: null,
      },
    });

    const { signInWithApple } = loadModule();

    await expect(signInWithApple()).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    });
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('surfaces account-conflict errors with the dedicated Apple error code', async () => {
    const conflictError = new Error('Account exists');
    (conflictError as { code?: string }).code = 'auth/account-exists-with-different-credential';
    mockSignInWithCredential.mockRejectedValue(conflictError);

    const { signInWithApple } = loadModule();

    await expect(signInWithApple()).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL,
    });
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('maps operation-not-allowed to an Apple-disabled auth error', async () => {
    const disabledError = new Error('Provider disabled');
    (disabledError as { code?: string }).code = 'auth/operation-not-allowed';
    mockSignInWithCredential.mockRejectedValue(disabledError);

    const { signInWithApple } = loadModule();

    await expect(signInWithApple()).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    });
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('retries once after a Firebase timeout and preserves the network error', async () => {
    jest.useFakeTimers();

    const networkError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple login is taking longer than expected.',
    });

    mockWithTimeout.mockRejectedValueOnce(networkError).mockRejectedValueOnce(networkError);

    const { signInWithApple } = loadModule();
    const signInPromise = signInWithApple();
    const handledRejection = expect(signInPromise).rejects.toBe(networkError);

    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1000);

    await handledRejection;
    expect(mockWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('surfaces a timed out profile lookup instead of hanging', async () => {
    const networkError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple profile lookup timed out.',
    });

    mockGetUserProfile.mockImplementation(() => new Promise(() => undefined));
    mockWithTimeout
      .mockResolvedValueOnce({ user: mockAuthUser })
      .mockRejectedValueOnce(networkError);

    const { signInWithApple } = loadModule();

    await expect(signInWithApple()).rejects.toBe(networkError);
    expect(mockWithTimeout).toHaveBeenCalledTimes(2);
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });

  it('surfaces a timed out token refresh for an existing Apple user', async () => {
    const networkError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple token refresh timed out.',
    });

    mockWithTimeout
      .mockResolvedValueOnce({ user: mockAuthUser })
      .mockResolvedValueOnce({
        uid: 'firebase-user',
        email: 'apple@example.com',
        role: 'staff',
        socialProvider: 'apple',
        phoneVerified: true,
        isActive: true,
      })
      .mockRejectedValueOnce(networkError);

    const { signInWithApple } = loadModule();

    await expect(signInWithApple()).rejects.toBe(networkError);
    expect(mockTrackLogin).not.toHaveBeenCalled();
    expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
  });
});
