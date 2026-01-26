/**
 * UNIQN Mobile - Centralized Firebase Mock
 *
 * @description 모든 테스트에서 재사용할 Firebase Mock 모듈
 * @version 1.0.0
 *
 * 사용법:
 * - jest.setup.js에서 전역 mock으로 등록
 * - 개별 테스트에서 필요시 import하여 사용
 */

// ============================================================================
// MockTimestamp Class (instanceof 지원)
// ============================================================================

/**
 * Firebase Timestamp Mock
 *
 * instanceof 체크를 지원하기 위해 클래스로 구현
 */
export class MockTimestamp {
  private _seconds: number;
  private _nanoseconds: number;

  constructor(seconds: number, nanoseconds: number = 0) {
    this._seconds = seconds;
    this._nanoseconds = nanoseconds;
  }

  get seconds(): number {
    return this._seconds;
  }

  get nanoseconds(): number {
    return this._nanoseconds;
  }

  toDate(): Date {
    return new Date(this._seconds * 1000 + this._nanoseconds / 1000000);
  }

  toMillis(): number {
    return this._seconds * 1000 + this._nanoseconds / 1000000;
  }

  isEqual(other: MockTimestamp): boolean {
    return this._seconds === other._seconds && this._nanoseconds === other._nanoseconds;
  }

  valueOf(): string {
    return `Timestamp(seconds=${this._seconds}, nanoseconds=${this._nanoseconds})`;
  }

  static now(): MockTimestamp {
    const now = Date.now();
    return new MockTimestamp(Math.floor(now / 1000), (now % 1000) * 1000000);
  }

  static fromDate(date: Date): MockTimestamp {
    const ms = date.getTime();
    return new MockTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }

  static fromMillis(milliseconds: number): MockTimestamp {
    return new MockTimestamp(Math.floor(milliseconds / 1000), (milliseconds % 1000) * 1000000);
  }
}

// ============================================================================
// Mock Document/Query Helpers
// ============================================================================

export interface MockDocumentSnapshot<T = Record<string, unknown>> {
  id: string;
  exists: () => boolean;
  data: () => T | undefined;
  ref: { id: string; path: string };
}

export interface MockQuerySnapshot<T = Record<string, unknown>> {
  docs: MockDocumentSnapshot<T>[];
  empty: boolean;
  size: number;
  forEach: (callback: (doc: MockDocumentSnapshot<T>) => void) => void;
}

export function createMockDocumentSnapshot<T = Record<string, unknown>>(
  id: string,
  data: T | null,
  collectionPath: string = 'test'
): MockDocumentSnapshot<T> {
  return {
    id,
    exists: () => data !== null,
    data: () => data ?? undefined,
    ref: { id, path: `${collectionPath}/${id}` },
  };
}

export function createMockQuerySnapshot<T = Record<string, unknown>>(
  docs: { id: string; data: T }[]
): MockQuerySnapshot<T> {
  const mockDocs = docs.map((d) => createMockDocumentSnapshot(d.id, d.data));
  return {
    docs: mockDocs,
    empty: mockDocs.length === 0,
    size: mockDocs.length,
    forEach: (callback) => mockDocs.forEach(callback),
  };
}

// ============================================================================
// Firebase Firestore Mock Factory
// ============================================================================

export const createFirestoreMock = () => {
  const mockGetDoc = jest.fn();
  const mockGetDocs = jest.fn();
  const mockSetDoc = jest.fn();
  const mockUpdateDoc = jest.fn();
  const mockDeleteDoc = jest.fn();
  const mockAddDoc = jest.fn();
  const mockRunTransaction = jest.fn();
  const mockWriteBatch = jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  }));
  const mockOnSnapshot = jest.fn((_query, callback) => {
    callback({ docs: [] });
    return jest.fn(); // unsubscribe
  });

  return {
    // Firestore instance
    getFirestore: jest.fn(() => ({})),

    // Document operations
    doc: jest.fn((_db, ...pathSegments) => ({
      id: pathSegments[pathSegments.length - 1] || 'mock-doc-id',
      path: pathSegments.join('/'),
    })),
    getDoc: mockGetDoc,
    setDoc: mockSetDoc,
    updateDoc: mockUpdateDoc,
    deleteDoc: mockDeleteDoc,
    addDoc: mockAddDoc,

    // Collection operations
    collection: jest.fn((_db, path) => ({ path })),
    collectionGroup: jest.fn((_db, collectionId) => ({ collectionId })),
    getDocs: mockGetDocs,

    // Query operations
    query: jest.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
    where: jest.fn((field, op, value) => ({ type: 'where', field, op, value })),
    orderBy: jest.fn((field, direction = 'asc') => ({ type: 'orderBy', field, direction })),
    limit: jest.fn((n) => ({ type: 'limit', n })),
    limitToLast: jest.fn((n) => ({ type: 'limitToLast', n })),
    startAt: jest.fn((...values) => ({ type: 'startAt', values })),
    startAfter: jest.fn((...values) => ({ type: 'startAfter', values })),
    endAt: jest.fn((...values) => ({ type: 'endAt', values })),
    endBefore: jest.fn((...values) => ({ type: 'endBefore', values })),

    // Real-time operations
    onSnapshot: mockOnSnapshot,

    // Batch/Transaction operations
    runTransaction: mockRunTransaction,
    writeBatch: mockWriteBatch,

    // Field values
    serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
    increment: jest.fn((n: number) => ({ _increment: n })),
    arrayUnion: jest.fn((...elements) => ({ _arrayUnion: elements })),
    arrayRemove: jest.fn((...elements) => ({ _arrayRemove: elements })),
    deleteField: jest.fn(() => ({ _deleteField: true })),

    // Timestamp class
    Timestamp: MockTimestamp,

    // Mock references (for test access)
    _mocks: {
      getDoc: mockGetDoc,
      getDocs: mockGetDocs,
      setDoc: mockSetDoc,
      updateDoc: mockUpdateDoc,
      deleteDoc: mockDeleteDoc,
      addDoc: mockAddDoc,
      runTransaction: mockRunTransaction,
      writeBatch: mockWriteBatch,
      onSnapshot: mockOnSnapshot,
    },
  };
};

// ============================================================================
// Firebase Auth Mock Factory
// ============================================================================

export const createFirebaseAuthMock = () => {
  const mockOnAuthStateChanged = jest.fn((_auth, callback) => {
    callback(null);
    return jest.fn(); // unsubscribe
  });

  return {
    getAuth: jest.fn(() => ({
      currentUser: null,
      onAuthStateChanged: jest.fn((callback) => {
        callback(null);
        return jest.fn();
      }),
    })),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve()),
    sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
    sendEmailVerification: jest.fn(() => Promise.resolve()),
    updateProfile: jest.fn(() => Promise.resolve()),
    updatePassword: jest.fn(() => Promise.resolve()),
    reauthenticateWithCredential: jest.fn(() => Promise.resolve()),
    deleteUser: jest.fn(() => Promise.resolve()),
    onAuthStateChanged: mockOnAuthStateChanged,
    onIdTokenChanged: jest.fn((_auth, callback) => {
      callback(null);
      return jest.fn();
    }),
    EmailAuthProvider: {
      credential: jest.fn((email, password) => ({ email, password })),
    },
    GoogleAuthProvider: jest.fn(),
    OAuthProvider: jest.fn(),

    _mocks: {
      onAuthStateChanged: mockOnAuthStateChanged,
    },
  };
};

// ============================================================================
// Firebase Storage Mock Factory
// ============================================================================

export const createFirebaseStorageMock = () => {
  return {
    getStorage: jest.fn(() => ({})),
    ref: jest.fn((_storage, path) => ({ path })),
    uploadBytes: jest.fn(() => Promise.resolve({ ref: { fullPath: 'mock-path' } })),
    uploadBytesResumable: jest.fn(() => ({
      on: jest.fn(),
      snapshot: { ref: { fullPath: 'mock-path' } },
    })),
    getDownloadURL: jest.fn(() => Promise.resolve('https://mock-download-url.com/file')),
    deleteObject: jest.fn(() => Promise.resolve()),
    listAll: jest.fn(() => Promise.resolve({ items: [], prefixes: [] })),
  };
};

// ============================================================================
// Firebase Functions Mock Factory
// ============================================================================

export const createFirebaseFunctionsMock = () => {
  return {
    getFunctions: jest.fn(() => ({})),
    httpsCallable: jest.fn((_functions, _name) => jest.fn(() => Promise.resolve({ data: {} }))),
    connectFunctionsEmulator: jest.fn(),
  };
};

// ============================================================================
// @/lib/firebase Mock Factory
// ============================================================================

export const createFirebaseLibMock = () => {
  return {
    // Firebase instances
    db: {},
    auth: {},
    storage: {},
    functions: {},

    // Getter functions
    getFirebaseDb: jest.fn(() => ({})),
    getFirebaseAuth: jest.fn(() => ({
      currentUser: null,
      onAuthStateChanged: jest.fn((callback: (user: unknown) => void) => {
        callback(null);
        return jest.fn();
      }),
    })),
    getFirebaseStorage: jest.fn(() => ({})),
    getFirebaseFunctions: jest.fn(() => ({})),

    // Initialization
    initializeFirebase: jest.fn(() => Promise.resolve()),
    isFirebaseInitialized: jest.fn(() => true),
  };
};

// ============================================================================
// Combined Mock Export (for jest.setup.js)
// ============================================================================

export const firebaseMocks = {
  firestore: createFirestoreMock(),
  auth: createFirebaseAuthMock(),
  storage: createFirebaseStorageMock(),
  functions: createFirebaseFunctionsMock(),
  lib: createFirebaseLibMock(),
};
