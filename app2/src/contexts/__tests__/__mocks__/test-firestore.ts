/**
 * Firestore Mock for UnifiedDataContext 테스트
 * Feature: 002-unifieddatacontext-tests
 */

export const mockFirestore = {
  collection: jest.fn((collectionName: string) => ({
    onSnapshot: jest.fn((callback: any, errorCallback?: any) => {
      // 기본 빈 데이터 반환
      setTimeout(() => {
        callback({
          docs: [],
          empty: true,
          size: 0,
        });
      }, 0);

      // unsubscribe 함수 반환
      return jest.fn();
    }),
    where: jest.fn(() => ({
      onSnapshot: jest.fn((callback: any) => {
        callback({ docs: [], empty: true, size: 0 });
        return jest.fn();
      }),
    })),
  })),
};

// Mock 에러 객체
export const mockFirestoreErrors = {
  connectionFailed: {
    code: 'unavailable',
    message: 'Firestore connection failed',
  },
  permissionDenied: {
    code: 'permission-denied',
    message: 'Insufficient permissions',
  },
  notFound: {
    code: 'not-found',
    message: 'Document not found',
  },
};
