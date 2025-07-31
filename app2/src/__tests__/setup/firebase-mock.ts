// Firebase 모킹 설정
import { vi } from '@jest/globals';

// Firestore 모킹
export const mockFirestore = {
  collection: vi.fn(() => mockFirestore),
  doc: vi.fn(() => mockFirestore),
  where: vi.fn(() => mockFirestore),
  orderBy: vi.fn(() => mockFirestore),
  limit: vi.fn(() => mockFirestore),
  get: vi.fn(() => Promise.resolve({
    docs: [],
    empty: true,
    size: 0
  })),
  onSnapshot: vi.fn((callback: any) => {
    // 즉시 빈 스냅샷 콜백 실행
    callback({
      docs: [],
      empty: true,
      size: 0
    });
    // unsubscribe 함수 반환
    return vi.fn();
  }),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve({ id: 'mock-id' }))
};

// Auth 모킹
export const mockAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn((callback: any) => {
    callback(null);
    return vi.fn(); // unsubscribe 함수
  }),
  signInWithEmailAndPassword: vi.fn(() => Promise.resolve({
    user: { uid: 'test-user-id', email: 'test@example.com' }
  })),
  signOut: vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve())
};

// Firebase 모듈 모킹
vi.mock('../../firebase', () => ({
  db: mockFirestore,
  auth: mockAuth,
  storage: {}
}));

// Firestore 함수 모킹
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => mockFirestore),
  doc: vi.fn(() => mockFirestore),
  getDocs: vi.fn(() => Promise.resolve({
    docs: [],
    empty: true,
    size: 0
  })),
  getDoc: vi.fn(() => Promise.resolve({
    exists: vi.fn(() => false),
    data: vi.fn(() => null),
    id: 'mock-id'
  })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'mock-id' })),
  query: vi.fn(() => mockFirestore),
  where: vi.fn(() => mockFirestore),
  orderBy: vi.fn(() => mockFirestore),
  limit: vi.fn(() => mockFirestore),
  onSnapshot: mockFirestore.onSnapshot,
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date }))
  }
}));

// Auth 함수 모킹
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => mockAuth),
  onAuthStateChanged: mockAuth.onAuthStateChanged,
  signInWithEmailAndPassword: mockAuth.signInWithEmailAndPassword,
  signOut: mockAuth.signOut,
  sendPasswordResetEmail: mockAuth.sendPasswordResetEmail
}));

// 테스트용 헬퍼 함수
export const setupFirestoreMock = (data: any[]) => {
  mockFirestore.get.mockResolvedValue({
    docs: data.map(item => ({
      id: item.id,
      data: () => item,
      exists: () => true
    })),
    empty: data.length === 0,
    size: data.length
  });
  
  mockFirestore.onSnapshot.mockImplementation((callback: any) => {
    callback({
      docs: data.map(item => ({
        id: item.id,
        data: () => item,
        exists: () => true
      })),
      empty: data.length === 0,
      size: data.length
    });
    return vi.fn();
  });
};

export const setupAuthMock = (user: any) => {
  mockAuth.currentUser = user;
  mockAuth.onAuthStateChanged.mockImplementation((callback: any) => {
    callback(user);
    return vi.fn();
  });
};