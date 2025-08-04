// Firebase Firestore 모킹
export const collection = jest.fn();
export const doc = jest.fn();
export const where = jest.fn();
export const orderBy = jest.fn();
export const limit = jest.fn();
export const query = jest.fn();
export const getDocs = jest.fn(() => Promise.resolve({
  docs: [],
  empty: true,
  size: 0
}));
export const getDoc = jest.fn(() => Promise.resolve({
  exists: jest.fn(() => false),
  data: jest.fn(() => null),
  id: 'mock-id'
}));
export const setDoc = jest.fn(() => Promise.resolve());
export const updateDoc = jest.fn(() => Promise.resolve());
export const deleteDoc = jest.fn(() => Promise.resolve());
export const addDoc = jest.fn(() => Promise.resolve({ id: 'mock-id' }));
export const onSnapshot = jest.fn((ref, callback) => {
  // 즉시 빈 스냅샷 콜백 실행
  if (typeof callback === 'function') {
    callback({
      docs: [],
      empty: true,
      size: 0
    });
  }
  // unsubscribe 함수 반환
  return jest.fn();
});
export const Timestamp = {
  now: jest.fn(() => ({
    toDate: jest.fn(() => new Date()),
    seconds: Math.floor(Date.now() / 1000),
    nanoseconds: 0
  })),
  fromDate: jest.fn((date: Date) => ({
    toDate: jest.fn(() => date),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0
  }))
};
export const serverTimestamp = jest.fn(() => new Date());
export const getFirestore = jest.fn(() => ({}));