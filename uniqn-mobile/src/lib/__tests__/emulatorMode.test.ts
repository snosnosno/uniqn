type MockWindow = {
  location: {
    href: string;
    hostname: string;
  };
  localStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
};

function loadModule() {
  let moduleUnderTest: typeof import('../emulatorMode') | undefined;

  jest.isolateModules(() => {
    moduleUnderTest = jest.requireActual<typeof import('../emulatorMode')>('../emulatorMode');
  });

  return moduleUnderTest!;
}

function setMockWindow(href: string, storageValue: string | null = null): MockWindow {
  const hostname = new URL(href).hostname;
  const mockWindow: MockWindow = {
    location: {
      href,
      hostname,
    },
    localStorage: {
      getItem: jest.fn<string | null, [string]>(() => storageValue),
      setItem: jest.fn<void, [string, string]>(),
      removeItem: jest.fn<void, [string]>(),
    },
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: mockWindow,
  });

  return mockWindow;
}

function setConfiguredEmulatorFlag(value: boolean) {
  const expoConstants = jest.requireMock('expo-constants') as {
    expoConfig: {
      extra: {
        useEmulator: boolean;
      };
    };
  };
  expoConstants.expoConfig.extra.useEmulator = value;
}

describe('emulatorMode', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'web',
      },
    }));
    setConfiguredEmulatorFlag(false);
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('ignores stale emulator overrides on remote web origins', () => {
    const mockWindow = setMockWindow('https://uniqn.app/?emulator=true', 'true');
    const { shouldUseFirebaseEmulator, WEB_EMULATOR_OVERRIDE_STORAGE_KEY } = loadModule();

    expect(shouldUseFirebaseEmulator()).toBe(false);
    expect(mockWindow.localStorage.removeItem).toHaveBeenCalledWith(
      WEB_EMULATOR_OVERRIDE_STORAGE_KEY
    );
  });

  it('respects query overrides on localhost', () => {
    const mockWindow = setMockWindow('http://localhost:8081/?emulator=true', 'false');
    const { shouldUseFirebaseEmulator, WEB_EMULATOR_OVERRIDE_STORAGE_KEY } = loadModule();

    expect(shouldUseFirebaseEmulator()).toBe(true);
    expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith(
      WEB_EMULATOR_OVERRIDE_STORAGE_KEY,
      'true'
    );
  });

  it('persists false query overrides on localhost so later route changes stay in live mode', () => {
    const mockWindow = setMockWindow('http://localhost:4101/?emulator=false', 'true');
    const { shouldUseFirebaseEmulator, WEB_EMULATOR_OVERRIDE_STORAGE_KEY } = loadModule();

    expect(shouldUseFirebaseEmulator()).toBe(false);
    expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith(
      WEB_EMULATOR_OVERRIDE_STORAGE_KEY,
      'false'
    );
  });

  it('falls back to the configured flag on localhost when no runtime override exists', () => {
    setConfiguredEmulatorFlag(true);
    const mockWindow = setMockWindow('http://127.0.0.1:8081/', null);
    const { shouldUseFirebaseEmulator, getFirebaseEmulatorConfig } = loadModule();

    expect(shouldUseFirebaseEmulator()).toBe(true);
    expect(getFirebaseEmulatorConfig()).toEqual({
      authUrl: 'http://localhost:9099',
      firestore: { host: 'localhost', port: 8080 },
      functions: { host: 'localhost', port: 5001 },
      storage: { host: 'localhost', port: 9199 },
    });
    expect(mockWindow.localStorage.removeItem).not.toHaveBeenCalled();
  });
});
