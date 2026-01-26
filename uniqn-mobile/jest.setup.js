/**
 * UNIQN Mobile - Jest Setup
 *
 * @description Global test setup and mocks
 * @version 2.0.0 - Centralized Firebase/Expo mocks
 */

/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-empty-function */

// ============================================================================
// Expo Linking Mock (MUST be before any service imports)
// deepLinkService 초기화 문제 해결
// ============================================================================
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path) => `uniqn://${path || ''}`),
  parse: jest.fn((_url) => ({ path: '', queryParams: {} })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  openURL: jest.fn(() => Promise.resolve()),
  openSettings: jest.fn(() => Promise.resolve()),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { isConnectionExpensive: false },
    })
  ),
  configure: jest.fn(),
  useNetInfo: jest.fn(() => ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: { isConnectionExpensive: false },
  })),
  NetInfoStateType: {
    unknown: 'unknown',
    none: 'none',
    cellular: 'cellular',
    wifi: 'wifi',
    bluetooth: 'bluetooth',
    ethernet: 'ethernet',
    wimax: 'wimax',
    vpn: 'vpn',
    other: 'other',
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      firebaseApiKey: 'test-api-key',
      firebaseAuthDomain: 'test.firebaseapp.com',
      firebaseProjectId: 'test-project',
      firebaseStorageBucket: 'test.appspot.com',
      firebaseMessagingSenderId: '123456789',
      firebaseAppId: '1:123456789:web:abc123',
    },
  },
}));

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  Link: 'Link',
  Redirect: 'Redirect',
  Stack: {
    Screen: 'Stack.Screen',
  },
  Tabs: {
    Screen: 'Tabs.Screen',
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock NativeWind
jest.mock('nativewind', () => ({
  styled: (component) => component,
  useColorScheme: () => ({
    colorScheme: 'light',
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  }),
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      callback(null);
      return jest.fn(); // unsubscribe
    }),
  })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
}));

// ============================================================================
// Firebase Firestore Mock (with class-based Timestamp for instanceof support)
// ============================================================================

// MockTimestamp 클래스 정의 (instanceof 체크 지원)
class MockTimestamp {
  constructor(seconds, nanoseconds = 0) {
    this._seconds = seconds;
    this._nanoseconds = nanoseconds;
  }

  get seconds() {
    return this._seconds;
  }

  get nanoseconds() {
    return this._nanoseconds;
  }

  toDate() {
    return new Date(this._seconds * 1000 + this._nanoseconds / 1000000);
  }

  toMillis() {
    return this._seconds * 1000 + this._nanoseconds / 1000000;
  }

  isEqual(other) {
    return this._seconds === other._seconds && this._nanoseconds === other._nanoseconds;
  }

  static now() {
    const now = Date.now();
    return new MockTimestamp(Math.floor(now / 1000), (now % 1000) * 1000000);
  }

  static fromDate(date) {
    const ms = date.getTime();
    return new MockTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }

  static fromMillis(milliseconds) {
    return new MockTimestamp(Math.floor(milliseconds / 1000), (milliseconds % 1000) * 1000000);
  }
}

// 전역으로 MockTimestamp 노출 (테스트에서 참조 가능)
global.MockTimestamp = MockTimestamp;

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn((db, path) => ({ path })),
  collectionGroup: jest.fn((db, collectionId) => ({ collectionId })),
  doc: jest.fn((db, ...pathSegments) => ({
    id: pathSegments[pathSegments.length - 1] || 'mock-doc-id',
    path: pathSegments.join('/'),
  })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
  where: jest.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: jest.fn((field, direction = 'asc') => ({ type: 'orderBy', field, direction })),
  limit: jest.fn((n) => ({ type: 'limit', n })),
  limitToLast: jest.fn((n) => ({ type: 'limitToLast', n })),
  startAt: jest.fn((...values) => ({ type: 'startAt', values })),
  startAfter: jest.fn((...values) => ({ type: 'startAfter', values })),
  endAt: jest.fn((...values) => ({ type: 'endAt', values })),
  endBefore: jest.fn((...values) => ({ type: 'endBefore', values })),
  onSnapshot: jest.fn((query, callback) => {
    callback({ docs: [] });
    return jest.fn();
  }),
  runTransaction: jest.fn(),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  })),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  increment: jest.fn((n) => ({ _increment: n })),
  arrayUnion: jest.fn((...elements) => ({ _arrayUnion: elements })),
  arrayRemove: jest.fn((...elements) => ({ _arrayRemove: elements })),
  deleteField: jest.fn(() => ({ _deleteField: true })),
  Timestamp: MockTimestamp,
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn((storage, path) => ({ path })),
  uploadBytes: jest.fn(() => Promise.resolve({ ref: { fullPath: 'mock-path' } })),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn(),
    snapshot: { ref: { fullPath: 'mock-path' } },
  })),
  getDownloadURL: jest.fn(() => Promise.resolve('https://mock-download-url.com/file')),
  deleteObject: jest.fn(() => Promise.resolve()),
  listAll: jest.fn(() => Promise.resolve({ items: [], prefixes: [] })),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn((_functions, _name) => jest.fn(() => Promise.resolve({ data: {} }))),
  connectFunctionsEmulator: jest.fn(),
}));

// ============================================================================
// @/lib/firebase Mock (Internal Firebase Library)
// ============================================================================
jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  getFirebaseDb: jest.fn(() => ({})),
  getFirebaseAuth: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      callback(null);
      return jest.fn();
    }),
  })),
  getFirebaseStorage: jest.fn(() => ({})),
  getFirebaseFunctions: jest.fn(() => ({})),
  initializeFirebase: jest.fn(() => Promise.resolve()),
  isFirebaseInitialized: jest.fn(() => true),
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    error: null,
  })),
}));

// Mock zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (config) => config,
  createJSONStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

// Suppress console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = (...args) => {
    if (
      args[0]?.includes?.('Animated') ||
      args[0]?.includes?.('NativeWind') ||
      args[0]?.includes?.('deprecated')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    if (
      args[0]?.includes?.('Warning:') ||
      args[0]?.includes?.('act()')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// Global test utilities
global.testUtils = {
  // Wait for async operations
  flushPromises: () => new Promise((resolve) => setImmediate(resolve)),

  // Create mock user
  createMockUser: (overrides = {}) => ({
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    phoneNumber: '+821012345678',
    ...overrides,
  }),

  // Create mock staff
  createMockStaff: (overrides = {}) => ({
    id: 'staff-id-1',
    userId: 'test-user-id',
    name: '테스트 스태프',
    role: 'staff',
    email: 'staff@example.com',
    phone: '010-1234-5678',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  // Create mock job posting (v2.0 - roles[].salary 구조)
  createMockJobPosting: (overrides = {}) => ({
    id: 'job-id-1',
    title: '테스트 공고',
    description: '테스트 설명',
    location: '서울',
    defaultSalary: { type: 'daily', amount: 150000 },
    roles: [
      { role: 'dealer', count: 2, salary: { type: 'daily', amount: 150000 } },
    ],
    date: new Date().toISOString(),
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides,
  }),
};
