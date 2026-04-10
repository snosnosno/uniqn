/* eslint-disable @typescript-eslint/no-require-imports */

import { Platform } from 'react-native';
import { reauthenticateWithCredential } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFunctions } from '@/lib/firebase';
import { BusinessError, ERROR_CODES } from '@/errors';
import { STATUS } from '@/constants';
import type { FirestoreUserProfile } from '@/types';
import type { DeletionRequest, UserDataExport } from '@/repositories';
const mockGetFirebaseAuth = getFirebaseAuth as jest.MockedFunction<typeof getFirebaseAuth>;
const mockGetFirebaseFunctions = getFirebaseFunctions as jest.MockedFunction<
  typeof getFirebaseFunctions
>;
const mockReauthenticateWithCredential = reauthenticateWithCredential as jest.MockedFunction<
  typeof reauthenticateWithCredential
>;

const mockRequestDeletion = jest.fn();
const mockCancelDeletion = jest.fn();
const mockGetById = jest.fn();
const mockGetExportData = jest.fn();
const mockGetDeletionStatus = jest.fn();
const mockRequestAppleAuthorization = jest.fn();
const mockHttpsCallable = jest.fn();
const mockRevokeAppleToken = jest.fn();

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(),
  getFirebaseFunctions: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider: {
    credential: jest.fn((email: string, password: string) => ({ email, password })),
  },
  OAuthProvider: jest.fn().mockImplementation((providerId: string) => ({
    credential: ({ idToken, rawNonce }: { idToken: string; rawNonce: string }) => ({
      providerId,
      idToken,
      rawNonce,
    }),
  })),
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

jest.mock('@/repositories', () => ({
  userRepository: {
    requestDeletion: (...args: unknown[]) => mockRequestDeletion(...args),
    cancelDeletion: (...args: unknown[]) => mockCancelDeletion(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    getExportData: (...args: unknown[]) => mockGetExportData(...args),
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

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

const mockCurrentUser = {
  uid: 'user-123',
  email: 'tester@example.com',
  providerData: [{ providerId: 'password' }],
};

const mockAuth = {
  currentUser: mockCurrentUser,
};

const mockFunctions = { name: 'functions' };

const mockProfile: FirestoreUserProfile = {
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

const mockExportData: UserDataExport = {
  profile: mockProfile,
  applications: [],
  workLogs: [],
  exportedAt: new Date().toISOString(),
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

    mockCurrentUser.providerData = [{ providerId: 'password' }];
    mockCurrentUser.email = 'tester@example.com';

    mockGetFirebaseAuth.mockReturnValue(mockAuth as ReturnType<typeof getFirebaseAuth>);
    mockGetFirebaseFunctions.mockReturnValue(
      mockFunctions as unknown as ReturnType<typeof getFirebaseFunctions>
    );
    mockReauthenticateWithCredential.mockResolvedValue(undefined as never);
    mockRequestDeletion.mockResolvedValue(undefined);
    mockCancelDeletion.mockResolvedValue(undefined);
    mockGetById.mockResolvedValue(mockProfile);
    mockGetExportData.mockResolvedValue(mockExportData);
    mockGetDeletionStatus.mockResolvedValue(mockDeletionRequest);
    mockRequestAppleAuthorization.mockResolvedValue({
      rawNonce: 'raw-nonce',
      credential: {
        identityToken: 'identity-token',
        authorizationCode: 'authorization-code',
      },
    });
    mockHttpsCallable.mockReturnValue(mockRevokeAppleToken);
    mockRevokeAppleToken.mockResolvedValue({ data: { success: true } });
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

    expect(mockReauthenticateWithCredential).toHaveBeenCalledTimes(1);
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

    mockGetFirebaseAuth.mockReturnValue({
      currentUser: null,
    } as ReturnType<typeof getFirebaseAuth>);

    await expect(requestAccountDeletion('no_longer_needed', 'password123')).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_SESSION_EXPIRED,
    });
  });

  it('maps wrong-password reauth failures to an auth error', async () => {
    const { requestAccountDeletion } = loadModule();

    const wrongPasswordError = new Error('Wrong password');
    (wrongPasswordError as { code?: string }).code = 'auth/wrong-password';
    mockReauthenticateWithCredential.mockRejectedValue(wrongPasswordError);

    await expect(requestAccountDeletion('no_longer_needed', 'bad-password')).rejects.toMatchObject({
      name: 'AuthError',
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    });
  });

  it('uses Apple reauthentication and revokes the Apple token on iOS', async () => {
    const { requestAccountDeletion } = loadModule();

    mockCurrentUser.providerData = [{ providerId: 'apple.com' }];

    const result = await requestAccountDeletion('privacy_concerns');

    expect(mockRequestAppleAuthorization).toHaveBeenCalledWith({
      requestedScopes: [],
      operation: 'reauth',
    });
    expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(
      mockCurrentUser,
      expect.objectContaining({
        providerId: 'apple.com',
        idToken: 'identity-token',
        rawNonce: 'raw-nonce',
      })
    );
    expect(result.appleTokenRevoked).toBe(true);
  });

  it('rethrows Apple reauth cancellation without creating a deletion request', async () => {
    const { requestAccountDeletion } = loadModule();

    mockCurrentUser.providerData = [{ providerId: 'apple.com' }];
    mockRequestAppleAuthorization.mockRejectedValue(
      new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '',
      })
    );

    await expect(requestAccountDeletion('privacy_concerns')).rejects.toMatchObject({
      userMessage: '',
    });
    expect(mockRequestDeletion).not.toHaveBeenCalled();
  });

  it('blocks Apple account deletion on non-iOS devices', async () => {
    const { requestAccountDeletion } = loadModule();

    setPlatformOS('android');
    mockCurrentUser.providerData = [{ providerId: 'apple.com' }];

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
      new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '',
      })
    );

    await expect(retryAppleTokenRevocation()).rejects.toMatchObject({
      userMessage: '',
    });
  });

  it('returns false when Apple revocation does not provide an authorization code', async () => {
    const { retryAppleTokenRevocation } = loadModule();

    mockRequestAppleAuthorization.mockResolvedValue({
      rawNonce: 'raw-nonce',
      credential: {
        identityToken: 'identity-token',
        authorizationCode: undefined,
      },
    });

    await expect(retryAppleTokenRevocation()).resolves.toBe(false);
    expect(mockRevokeAppleToken).not.toHaveBeenCalled();
  });

  it('returns false when Apple revocation is requested without a current user', async () => {
    const { retryAppleTokenRevocation } = loadModule();

    mockGetFirebaseAuth.mockReturnValue({
      currentUser: null,
    } as ReturnType<typeof getFirebaseAuth>);

    await expect(retryAppleTokenRevocation()).resolves.toBe(false);
    expect(mockRequestAppleAuthorization).not.toHaveBeenCalled();
  });

  it('delegates cancelAccountDeletion to the repository', async () => {
    const { cancelAccountDeletion } = loadModule();

    await cancelAccountDeletion('user-123');

    expect(mockCancelDeletion).toHaveBeenCalledWith('user-123');
  });

  it('delegates getMyData to the repository', async () => {
    const { getMyData } = loadModule();

    const result = await getMyData('user-123');

    expect(mockGetById).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(mockProfile);
  });

  it('delegates exportMyData to the repository', async () => {
    const { exportMyData } = loadModule();

    const result = await exportMyData('user-123');

    expect(mockGetExportData).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(mockExportData);
  });

  it('delegates getDeletionStatus to the repository', async () => {
    const { getDeletionStatus } = loadModule();

    const result = await getDeletionStatus('user-123');

    expect(mockGetDeletionStatus).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(mockDeletionRequest);
  });
});
