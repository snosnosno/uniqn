// Firebase 모킹
export const mockFirestore: any = {
  collection: jest.fn(() => mockFirestore),
  doc: jest.fn(() => mockFirestore),
  where: jest.fn(() => mockFirestore),
  orderBy: jest.fn(() => mockFirestore),
  limit: jest.fn(() => mockFirestore),
  get: jest.fn(() =>
    Promise.resolve({
      docs: [],
      empty: true,
      size: 0,
    })
  ),
  onSnapshot: jest.fn((callback: any) => {
    // 즉시 빈 스냅샷 콜백 실행
    callback({
      docs: [],
      empty: true,
      size: 0,
    });
    // unsubscribe 함수 반환
    return jest.fn();
  }),
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
  add: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
};

export const mockAuth = {
  currentUser: null,
  onAuthStateChanged: jest.fn((callback: any) => {
    callback(null);
    return jest.fn(); // unsubscribe 함수
  }),
  signInWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({
      user: { uid: 'test-user-id', email: 'test@example.com' },
    })
  ),
  signOut: jest.fn(() => Promise.resolve()),
  sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
};

export const db = mockFirestore;
export const auth = mockAuth;
export const storage = {};
