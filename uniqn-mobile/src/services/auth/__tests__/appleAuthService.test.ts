/* eslint-disable @typescript-eslint/no-require-imports */

import { ERROR_CODES, NetworkError } from '@/errors';

const mockIsAvailableAsync = jest.fn();
const mockSignInAsync = jest.fn();
const mockGenerateNonce = jest.fn();
const mockSha256 = jest.fn();
const mockWithTimeout = jest.fn();
const mockLeaveBreadcrumb = jest.fn();

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        appleLoginEnabled: true,
      },
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
}));

jest.mock('@/utils/appleAuth', () => ({
  generateNonce: (...args: unknown[]) => mockGenerateNonce(...args),
  sha256: (...args: unknown[]) => mockSha256(...args),
}));

jest.mock('@/utils/timeout', () => ({
  withTimeout: (...args: unknown[]) => mockWithTimeout(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/services/observability/sentryService', () => ({
  sentryService: {
    leaveBreadcrumb: (...args: unknown[]) => mockLeaveBreadcrumb(...args),
  },
}));

type AppleAuthServiceModule = typeof import('../appleAuthService');

function loadModule(): AppleAuthServiceModule {
  let moduleUnderTest: AppleAuthServiceModule | undefined;

  jest.isolateModules(() => {
    moduleUnderTest = require('../appleAuthService') as AppleAuthServiceModule;
  });

  return moduleUnderTest!;
}

describe('appleAuthService requestAppleAuthorization', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockIsAvailableAsync.mockResolvedValue(true);
    mockGenerateNonce.mockReturnValue('raw-nonce');
    mockSha256.mockResolvedValue('hashed-nonce');
    mockSignInAsync.mockResolvedValue({ identityToken: 'identity-token' });
    mockWithTimeout.mockImplementation((promise: Promise<unknown>) => promise);
  });

  it('wraps the native Apple prompt in a timeout', async () => {
    const credential = { identityToken: 'identity-token' };
    mockSignInAsync.mockResolvedValue(credential);

    const { requestAppleAuthorization } = loadModule();
    const result = await requestAppleAuthorization({ operation: 'login' });

    expect(mockSignInAsync).toHaveBeenCalledWith({
      requestedScopes: [],
      nonce: 'hashed-nonce',
    });
    expect(mockWithTimeout).toHaveBeenCalledTimes(1);
    expect(mockWithTimeout).toHaveBeenCalledWith(
      expect.any(Promise),
      60000,
      expect.stringContaining('Apple 로그인 응답이 지연되고 있습니다')
    );
    expect(result).toEqual({ credential, rawNonce: 'raw-nonce' });
  });

  it('preserves timeout errors from the native Apple prompt', async () => {
    const timeoutError = new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
      userMessage: 'Apple login prompt timed out.',
    });
    mockWithTimeout.mockRejectedValue(timeoutError);

    const { requestAppleAuthorization } = loadModule();

    await expect(requestAppleAuthorization({ operation: 'login' })).rejects.toBe(timeoutError);
  });
});
