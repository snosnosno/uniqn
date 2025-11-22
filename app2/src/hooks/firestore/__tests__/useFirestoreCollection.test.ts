/**
 * useFirestoreCollection Hook 테스트
 *
 * @description
 * Firestore 컬렉션 실시간 구독 Hook의 모든 기능을 테스트합니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestoreCollection';
import type { FirestoreDocument } from '../types';

// Mock Firebase
jest.mock('../../../firebase', () => ({
  db: {},
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
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

describe('useFirestoreCollection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('기본 구독', () => {
    it('컬렉션을 성공적으로 구독해야 함', async () => {
      const mockData = [
        { id: '1', name: '홍길동', role: 'dealer', active: true },
        { id: '2', name: '김철수', role: 'manager', active: true },
      ];

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_collectionRef: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({
            docs: mockData.map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreCollection<Staff>('staff')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0]).toEqual(mockData[0]);
      expect(result.current.error).toBeNull();
    });

    it('빈 컬렉션을 처리해야 함', async () => {
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_collectionRef: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({ docs: [] });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreCollection<Staff>('staff')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe('쿼리 제약 조건', () => {
    it('where 절과 함께 동작해야 함', async () => {
      const mockData = [
        { id: '1', name: '홍길동', role: 'dealer', active: true },
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

      const { result } = renderHook(() =>
        useFirestoreCollection<Staff>('staff', {
          queryConstraints: [where('active', '==', true)],
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0]?.active).toBe(true);
    });

    it('orderBy와 limit을 함께 사용해야 함', async () => {
      const mockData = [
        { id: '1', name: '홍길동', role: 'dealer', active: true },
        { id: '2', name: '김철수', role: 'manager', active: true },
      ];

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_query: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({
            docs: mockData.slice(0, 2).map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreCollection<Staff>('staff', {
          queryConstraints: [orderBy('name'), limit(2)],
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
    });
  });

  describe('에러 처리', () => {
    it('Firestore 에러를 처리해야 함', async () => {
      const mockError = new Error('Permission denied');
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _collectionRef: unknown,
          _onNext: unknown,
          onError: (error: Error) => void
        ) => {
          onError(mockError);
          return jest.fn();
        }
      );

      const { result } = renderHook(() =>
        useFirestoreCollection<Staff>('staff')
      );

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
        (
          _collectionRef: unknown,
          _onNext: unknown,
          onError: (error: Error) => void
        ) => {
          onError(mockError);
          return jest.fn();
        }
      );

      renderHook(() =>
        useFirestoreCollection<Staff>('staff', {
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

      const { result } = renderHook(() =>
        useFirestoreCollection<Staff>('staff', {
          enabled: false,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toHaveLength(0);
      expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('onSuccess 콜백을 호출해야 함', async () => {
      const mockData = [
        { id: '1', name: '홍길동', role: 'dealer', active: true },
      ];
      const onSuccessCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_collectionRef: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({
            docs: mockData.map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      renderHook(() =>
        useFirestoreCollection<Staff>('staff', {
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
      const mockData = [
        { id: '1', name: '홍길동', role: 'dealer', active: true },
      ];
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      let callCount = 0;
      onSnapshot.mockImplementation(
        (_collectionRef: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
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

      const { result } = renderHook(() =>
        useFirestoreCollection<Staff>('staff')
      );

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
        (_collectionRef: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({ docs: [] });
          return mockUnsubscribe;
        }
      );

      const { unmount } = renderHook(() =>
        useFirestoreCollection<Staff>('staff')
      );

      await waitFor(() => {
        expect(mockUnsubscribe).not.toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('타입 안전성', () => {
    it('FirestoreDocument 타입을 반환해야 함', async () => {
      const mockData = [
        { id: '1', name: '홍길동', role: 'dealer', active: true },
      ];
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (_collectionRef: unknown, onNext: (snapshot: { docs: unknown[] }) => void) => {
          onNext({
            docs: mockData.map((data) => ({
              id: data.id,
              data: () => ({ name: data.name, role: data.role, active: data.active }),
            })),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreCollection<Staff>('staff')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const firstDoc = result.current.data[0] as FirestoreDocument<Staff> | undefined;
      expect(firstDoc?.id).toBe('1');
      expect(firstDoc?.name).toBe('홍길동');
    });
  });
});
