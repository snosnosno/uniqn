/**
 * Test Setup for AuthContext Testing
 *
 * Purpose: Jest Mock 설정 및 환경 초기화
 * Feature: 001-authcontext-tests
 * Created: 2025-11-06
 *
 * 사용법:
 * 테스트 파일 상단에 import하여 사용
 * ```typescript
 * import './mocks__/setup';
 * ```
 */

// Mock firebase/auth
jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
  getAuth: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  onAuthStateChanged: jest.fn(),
  setPersistence: jest.fn(),
  browserLocalPersistence: { type: 'LOCAL' },
  browserSessionPersistence: { type: 'SESSION' },
  signInWithPopup: jest.fn(),
  signInWithCustomToken: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
  reload: jest.fn(),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    providerId: 'google.com',
  })),
}));

// Mock ../../../firebase (auth instance)
jest.mock('../../../firebase', () => ({
  auth: {
    currentUser: null,
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock ../../../utils/logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock ../../../utils/sentry
jest.mock('../../../utils/sentry', () => ({
  setSentryUser: jest.fn(),
}));

// Mock ../../../utils/secureStorage
jest.mock('../../../utils/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn((key: string) => {
      return localStorage.getItem(key);
    }),
    setItem: jest.fn((key: string, value: string) => {
      localStorage.setItem(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      localStorage.removeItem(key);
    }),
    clear: jest.fn(() => {
      localStorage.clear();
    }),
  },
}));

// Mock ../../../utils/firebase-dynamic (for Kakao login)
jest.mock('../../../utils/firebase-dynamic', () => ({
  callFunctionLazy: jest.fn().mockResolvedValue({
    customToken: 'mock-custom-token',
  }),
}));

/**
 * Mock localStorage
 */
const localStorageMock: Storage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

export {};
