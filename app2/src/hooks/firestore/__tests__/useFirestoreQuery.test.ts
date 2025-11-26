/**
 * useFirestoreQuery Hook 테스트
 *
 * @description
 * Firestore 복잡한 쿼리 실시간 구독 Hook의 모든 기능을 테스트합니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import type { Query, DocumentData } from 'firebase/firestore';
import { useFirestoreQuery } from '../useFirestoreQuery';
import type { FirestoreDocument } from '../types';

// Mock Firebase
jest.mock('../../../firebase', () => ({
  db: {},
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  query: jest.fn(),
  collection: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// 테스트용 타입
interface Staff {
  name: string;
  role: string;
  active: boolean;
}

describe('useFirestoreQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('기본 구독', () => {
    it('쿼리를 성공적으로 구독해야 함', async () => {
      const mockData = [
        { id: '1', name: '홍길동', role: 'dealer', active: true },
        { id: '2', name: '김철수', role: 'manager', active: true },
      ];

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({
            docs: mockData.map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      const mockQuery = {} as Query<DocumentData>;

      const { result } = renderHook(() => useFirestoreQuery<Staff>(mockQuery));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0]).toEqual(mockData[0]);
      expect(result.current.error).toBeNull();
    });

    it('null 쿼리일 때 구독하지 않아야 함', () => {
      const { onSnapshot } = require('firebase/firestore');

      const { result } = renderHook(() => useFirestoreQuery<Staff>(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toHaveLength(0);
      expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('빈 결과를 처리해야 함', async () => {
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({ docs: [] });
          return mockUnsubscribe;
        }
      );

      const mockQuery = {} as Query<DocumentData>;

      const { result } = renderHook(() => useFirestoreQuery<Staff>(mockQuery));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe('에러 처리', () => {
    it('Firestore 에러를 처리해야 함', async () => {
      const mockError = new Error('Permission denied');
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, _onNext: unknown, onError: (error: Error) => void) => {
          onError(mockError);
          return jest.fn();
        }
      );

      const mockQuery = {} as Query<DocumentData>;

      const { result } = renderHook(() => useFirestoreQuery<Staff>(mockQuery));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.data).toHaveLength(0);
    });

    it('onError 콜백을 호출해야 함', async () => {
      const mockError = new Error('Network error');
      const onErrorCallback = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, _onNext: unknown, onError: (error: Error) => void) => {
          onError(mockError);
          return jest.fn();
        }
      );

      const mockQuery = {} as Query<DocumentData>;

      renderHook(() =>
        useFirestoreQuery<Staff>(mockQuery, {
          onError: onErrorCallback,
        })
      );

      await waitFor(() => {
        expect(onErrorCallback).toHaveBeenCalledWith(mockError);
      });
    });
  });

  describe('Hook 옵션', () => {
    it('enabled=false일 때 구독하지 않아야 함', () => {
      const { onSnapshot } = require('firebase/firestore');
      const mockQuery = {} as Query<DocumentData>;

      const { result } = renderHook(() =>
        useFirestoreQuery<Staff>(mockQuery, {
          enabled: false,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toHaveLength(0);
      expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('onSuccess 콜백을 호출해야 함', async () => {
      const mockData = [{ id: '1', name: '홍길동', role: 'dealer', active: true }];

      const onSuccessCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({
            docs: mockData.map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      const mockQuery = {} as Query<DocumentData>;

      renderHook(() =>
        useFirestoreQuery<Staff>(mockQuery, {
          onSuccess: onSuccessCallback,
        })
      );

      await waitFor(() => {
        expect(onSuccessCallback).toHaveBeenCalled();
      });
    });
  });

  describe('refetch 기능', () => {
    it('refetch를 호출하면 재구독해야 함', async () => {
      const mockData = [{ id: '1', name: '홍길동', role: 'dealer', active: true }];

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      let callCount = 0;
      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          callCount++;
          onNext({
            docs: mockData.map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      const mockQuery = {} as Query<DocumentData>;

      const { result } = renderHook(() => useFirestoreQuery<Staff>(mockQuery));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = callCount;

      // refetch 호출
      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(callCount).toBe(initialCallCount + 1);
      });
    });
  });

  describe('cleanup', () => {
    it('unmount 시 구독 해제해야 함', async () => {
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({ docs: [] });
          return mockUnsubscribe;
        }
      );

      const mockQuery = {} as Query<DocumentData>;

      const { unmount } = renderHook(() => useFirestoreQuery<Staff>(mockQuery));

      await waitFor(() => {
        expect(mockUnsubscribe).not.toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('쿼리 변경 시 이전 구독 해제해야 함', async () => {
      const mockUnsubscribe1 = jest.fn();
      const mockUnsubscribe2 = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      let currentUnsubscribe = mockUnsubscribe1;
      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({ docs: [] });
          return currentUnsubscribe;
        }
      );

      const mockQuery1 = { id: 1 } as unknown as Query<DocumentData>;
      const mockQuery2 = { id: 2 } as unknown as Query<DocumentData>;

      const { rerender } = renderHook(({ query }) => useFirestoreQuery<Staff>(query), {
        initialProps: { query: mockQuery1 },
      });

      await waitFor(() => {
        expect(mockUnsubscribe1).not.toHaveBeenCalled();
      });

      // 쿼리 변경
      currentUnsubscribe = mockUnsubscribe2;
      rerender({ query: mockQuery2 });

      await waitFor(() => {
        expect(mockUnsubscribe1).toHaveBeenCalled();
      });
    });
  });

  describe('타입 안전성', () => {
    it('FirestoreDocument 타입 배열을 반환해야 함', async () => {
      const mockData = [{ id: '1', name: '홍길동', role: 'dealer', active: true }];

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({
            docs: mockData.map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      const mockQuery = {} as Query<DocumentData>;

      const { result } = renderHook(() => useFirestoreQuery<Staff>(mockQuery));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const firstDoc = result.current.data[0] as FirestoreDocument<Staff> | undefined;
      if (firstDoc) {
        expect(firstDoc.id).toBe('1');
        expect(firstDoc.name).toBe('홍길동');
      }
    });
  });

  describe('실제 쿼리 시나리오', () => {
    it('조건부 쿼리를 처리해야 함', async () => {
      const mockData = [{ id: '1', name: '홍길동', role: 'dealer', active: true }];

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({
            docs: mockData.map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      // userId가 있을 때만 쿼리 생성
      const userId = 'user123';
      const mockQuery = userId ? ({} as Query<DocumentData>) : null;

      const { result } = renderHook(() => useFirestoreQuery<Staff>(mockQuery));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
    });
  });
});
