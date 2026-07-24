/* eslint-disable @typescript-eslint/no-require-imports */

import { Platform } from 'react-native';
import { BusinessError, ERROR_CODES } from '@/errors';
import { STATUS } from '@/constants';
import type { UserProfile } from '@/types';
import type { DeletionRequest } from '@/repositories';

const mockGetUser = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockSignOut = jest.fn();
const mockRequestDeletion = jest.fn();
const mockCancelDeletion = jest.fn();
const mockGetById = jest.fn();
const mockGetDeletionStatus = jest.fn();
const mockRequestAppleAuthorization = jest.fn();
const mockFunctionsInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signInWithIdToken: (...args: unknown[]) => mockSignInWithIdToken(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('@/lib/supabaseFunctions', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockFunctionsInvoke(...args),
}));

jest.mock('@/repositories', () => ({
  userRepository: {
    requestDeletion: (...args: unknown[]) => mockRequestDeletion(...args),
    cancelDeletion: (...args: unknown[]) => mockCancelDeletion(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    getDeletionStatus: (...args: unknown[]) => mockGetDeletionStatus(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../appleAuthService', () => ({
  requestAppleAuthorization: (...args: unknown[]) => mockRequestAppleAuthorization(...args),
}));

jest.mock('@/utils/date', () => ({
  toDate: jest.fn((d: unknown) => d),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

const mockCurrentUser = {
  id: 'user-123',
  email: 'tester@example.com',
  app_metadata: { providers: ['email'] },
};

const mockProfile: UserProfile = {
  uid: 'user-123',
  email: 'tester@example.com',
  role: 'staff',
  name: 'Tester',
  nickname: 'tester',
  phone: '01012345678',
  photoURL: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDeletionRequest: DeletionRequest = {
  userId: 'user-123',
  reason: 'no_longer_needed',
  reasonDetail: 'No longer needed',
  requestedAt: new Date(),
  scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  status: STATUS.DELETION_REQUEST.PENDING,
};

type AccountDeletionServiceModule = typeof import('../accountDeletionService');

function loadModule(): AccountDeletionServiceModule {
  let moduleUnderTest: AccountDeletionServiceModule | undefined;

  jest.isolateModules(() => {
    moduleUnderTest = require('../accountDeletionService') as AccountDeletionServiceModule;
  });

  return moduleUnderTest!;
}

describe('accountDeletionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOS('ios');

    mockGetUser.mockResolvedValue({ data: { user: { ...mockCurrentUser } }, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockSignInWithIdToken.mockResolvedValue({ data: {}, error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockRequestDeletion.mockResolvedValue(undefined);
    mockCancelDeletion.mockResolvedValue(undefined);
    mockGetById.mockResolvedValue(mockProfile);
    mockGetDeletionStatus.mockResolvedValue(mockDeletionRequest);
    mockRequestAppleAuthorization.mockResolvedValue({
      rawNonce: 'raw-nonce',
      credential: {
        identityToken: 'identity-token',
        authorizationCode: 'authorization-code',
      },
    });
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  afterAll(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    }
  });

  it('keeps the configured deletion reasons', () => {
    const { DELETION_REASONS } = loadModule();
    expect(DELETION_REASONS.no_longer_needed).toBeTruthy();
    expect(DELETION_REASONS.other).toBeTruthy();
  });

  it('handles password-based deletion requests', async () => {
    const { requestAccountDeletion } = loadModule();
    const result = await requestAccountDeletion('no_longer_needed', 'password123');
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    expect(mockRequestDeletion).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        reason: 'no_longer_needed',
        status: STATUS.DELETION_REQUEST.PENDING,
      })
    );
    expect(result.deletionRequest.userId).toBe('user-123');
    expect(result.appleTokenRevoked).toBe(true);
  });

  it('rejects deletion when no authenticated user exists', async () => {
    const { requestAccountDeletion } = loadModule();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requestAccountDeletion('no_longer_needed', 'password123')).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_SESSION_EXPIRED,
    });
  });

  it('maps wrong-password reauth failures to an auth error', async () => {
    const { requestAccountDeletion } = loadModule();
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid credentials' },
    });
    await expect(requestAccountDeletion('no_longer_needed', 'bad-password')).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    });
  });

  it('uses Apple reauthentication and revokes the Apple token on iOS', async () => {
    const { requestAccountDeletion } = loadModule();
    const appleUser = { ...mockCurrentUser, app_metadata: { providers: ['apple'] } };
    mockGetUser.mockResolvedValue({ data: { user: appleUser }, error: null });
    const result = await requestAccountDeletion('privacy_concerns');
    expect(mockRequestAppleAuthorization).toHaveBeenCalledWith({
      requestedScopes: [],
      operation: 'reauth',
    });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'identity-token',
      nonce: 'raw-nonce',
    });
    expect(result.appleTokenRevoked).toBe(true);
  });

  it('rethrows Apple reauth cancellation without creating a deletion request', async () => {
    const { requestAccountDeletion } = loadModule();
    const appleUser = { ...mockCurrentUser, app_metadata: { providers: ['apple'] } };
    mockGetUser.mockResolvedValue({ data: { user: appleUser }, error: null });
    mockRequestAppleAuthorization.mockRejectedValue(
      new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, { userMessage: '' })
    );
    await expect(requestAccountDeletion('privacy_concerns')).rejects.toMatchObject({
      userMessage: '',
    });
    expect(mockRequestDeletion).not.toHaveBeenCalled();
  });

  it('blocks Apple account deletion on non-iOS devices', async () => {
    const { requestAccountDeletion } = loadModule();
    setPlatformOS('android');
    const appleUser = { ...mockCurrentUser, app_metadata: { providers: ['apple'] } };
    mockGetUser.mockResolvedValue({ data: { user: appleUser }, error: null });
    await expect(requestAccountDeletion('privacy_concerns')).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    });
    expect(mockRequestAppleAuthorization).not.toHaveBeenCalled();
  });

  it('retries Apple token revocation through the shared helper', async () => {
    const { retryAppleTokenRevocation } = loadModule();
    const result = await retryAppleTokenRevocation();
    expect(mockRequestAppleAuthorization).toHaveBeenCalledWith({
      requestedScopes: [],
      operation: 'revocation',
    });
    expect(result).toBe(true);
  });

  it('keeps an Apple revocation cancel event untouched', async () => {
    const { retryAppleTokenRevocation } = loadModule();
    mockRequestAppleAuthorization.mockRejectedValue(
      new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, { userMessage: '' })
    );
    await expect(retryAppleTokenRevocation()).rejects.toMatchObject({ userMessage: '' });
  });

  it('returns false when Apple revocation does not provide an authorization code', async () => {
    const { retryAppleTokenRevocation } = loadModule();
    mockRequestAppleAuthorization.mockResolvedValue({
      rawNonce: 'raw-nonce',
      credential: { identityToken: 'identity-token', authorizationCode: undefined },
    });
    await expect(retryAppleTokenRevocation()).resolves.toBe(false);
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('returns false when Apple revocation is requested without a current user', async () => {
    const { retryAppleTokenRevocation } = loadModule();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(retryAppleTokenRevocation()).resolves.toBe(false);
    expect(mockRequestAppleAuthorization).not.toHaveBeenCalled();
  });

  it('cancels a pending deletion request', async () => {
    const { cancelAccountDeletion } = loadModule();
    await cancelAccountDeletion('user-123');
    expect(mockCancelDeletion).toHaveBeenCalledWith('user-123');
  });

  it('gets deletion status', async () => {
    const { getDeletionStatus } = loadModule();
    const result = await getDeletionStatus('user-123');
    expect(result).toEqual(mockDeletionRequest);
    expect(mockGetDeletionStatus).toHaveBeenCalledWith('user-123');
  });
});
