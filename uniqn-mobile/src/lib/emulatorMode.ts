import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const WEB_EMULATOR_OVERRIDE_QUERY_KEY = 'emulator';
export const WEB_EMULATOR_OVERRIDE_STORAGE_KEY = 'uniqn_use_emulator';

export interface FirebaseEmulatorConfig {
  authUrl: string;
  firestore: {
    host: string;
    port: number;
  };
  functions: {
    host: string;
    port: number;
  };
  storage: {
    host: string;
    port: number;
  };
}

const LOCAL_FIREBASE_EMULATOR_CONFIG: FirebaseEmulatorConfig = {
  authUrl: 'http://localhost:9099',
  firestore: {
    host: 'localhost',
    port: 8080,
  },
  functions: {
    host: 'localhost',
    port: 5001,
  },
  storage: {
    host: 'localhost',
    port: 9199,
  },
};

const TRUE_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_FLAG_VALUES = new Set(['0', 'false', 'no', 'off']);

function normalizeBooleanFlag(value: string | null | undefined): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (TRUE_FLAG_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_FLAG_VALUES.has(normalized)) {
    return false;
  }

  return null;
}

function isLocalWebHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();

  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '127.0.0.1' ||
    normalizedHostname === '0.0.0.0' ||
    normalizedHostname === '::1' ||
    normalizedHostname === '[::1]' ||
    normalizedHostname.endsWith('.localhost') ||
    normalizedHostname.endsWith('.local')
  );
}

function isLocalWebOrigin(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  return isLocalWebHostname(window.location.hostname);
}

function clearWebRuntimeEmulatorOverride(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(WEB_EMULATOR_OVERRIDE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures on locked-down browsers.
  }
}

function persistWebRuntimeEmulatorOverride(value: boolean): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(WEB_EMULATOR_OVERRIDE_STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Ignore storage persistence failures on locked-down browsers.
  }
}

function readWebRuntimeEmulatorOverride(): boolean | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  if (!isLocalWebOrigin()) {
    clearWebRuntimeEmulatorOverride();
    return null;
  }

  try {
    const queryOverride = normalizeBooleanFlag(
      new URL(window.location.href).searchParams.get(WEB_EMULATOR_OVERRIDE_QUERY_KEY)
    );

    if (queryOverride !== null) {
      persistWebRuntimeEmulatorOverride(queryOverride);
      return queryOverride;
    }
  } catch {
    // Ignore malformed URLs and continue to the storage fallback.
  }

  try {
    return normalizeBooleanFlag(window.localStorage.getItem(WEB_EMULATOR_OVERRIDE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readConfiguredEmulatorFlag(): boolean {
  const configuredFlag = Constants.expoConfig?.extra?.useEmulator;

  if (typeof configuredFlag === 'boolean') {
    return configuredFlag;
  }

  return process.env.EXPO_PUBLIC_USE_EMULATOR === 'true';
}

export function shouldUseFirebaseEmulator(): boolean {
  if (Platform.OS === 'web' && !isLocalWebOrigin()) {
    clearWebRuntimeEmulatorOverride();
    return false;
  }

  const runtimeOverride = readWebRuntimeEmulatorOverride();

  if (runtimeOverride !== null) {
    return runtimeOverride;
  }

  return readConfiguredEmulatorFlag();
}

export function shouldUseLocalWebAuthStateStorage(): boolean {
  return Platform.OS === 'web' && shouldUseFirebaseEmulator();
}

export function getFirebaseEmulatorConfig(): FirebaseEmulatorConfig | null {
  return shouldUseFirebaseEmulator() ? LOCAL_FIREBASE_EMULATOR_CONFIG : null;
}
