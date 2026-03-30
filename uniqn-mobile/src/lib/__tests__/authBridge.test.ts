const mockSignOut = jest.fn();
const mockGetFirebaseAuth = jest.fn();
const mockGetNativeAuth = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock('../firebase', () => ({
  getFirebaseAuth: () => mockGetFirebaseAuth(),
}));

jest.mock('../nativeAuth', () => ({
  getNativeAuth: () => mockGetNativeAuth(),
  nativeSignOut: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  maskValue: (value: string) => value,
}));

describe('ensureDualSdkSync', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('keeps the session when native auth is restored before web auth', async () => {
    mockGetNativeAuth.mockReturnValue({
      currentUser: { uid: 'native-user' },
    });
    mockGetFirebaseAuth.mockReturnValue({
      currentUser: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ensureDualSdkSync } = require('../authBridge') as typeof import('../authBridge');

    await expect(ensureDualSdkSync()).resolves.toBeUndefined();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
