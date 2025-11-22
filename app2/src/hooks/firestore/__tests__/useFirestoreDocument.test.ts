/**
 * useFirestoreDocument Hook 테스트
 *
 * @description
 * Firestore 단일 문서 실시간 구독 Hook의 모든 기능을 테스트합니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useFirestoreDocument } from '../useFirestoreDocument';
import type { FirestoreDocument } from '../types';

// Mock Firebase
jest.mock('../../../firebase', () => ({
  db: {},
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
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

describe('useFirestoreDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('기본 구독', () => {
    it('문서를 성공적으로 구독해야 함', async () => {
      const mockData = {
        id: '1',
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean; id: string; data: () => unknown }) => void
        ) => {
          onNext({
            exists: () => true,
            id: mockData.id,
            data: () => ({
              name: mockData.name,
              role: mockData.role,
              active: mockData.active,
            }),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
    });

    it('문서가 없을 때 null을 반환해야 함', async () => {
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean }) => void
        ) => {
          onNext({
            exists: () => false,
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/999')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('errorOnNotFound 옵션', () => {
    it('errorOnNotFound=true일 때 문서 없으면 에러 발생', async () => {
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean }) => void
        ) => {
          onNext({
            exists: () => false,
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/999', {
          errorOnNotFound: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(
        new Error('Document not found: staff/999')
      );
    });

    it('errorOnNotFound=false일 때 문서 없어도 정상', async () => {
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean }) => void
        ) => {
          onNext({
            exists: () => false,
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/999', {
          errorOnNotFound: false,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('update 기능', () => {
    it('문서를 성공적으로 업데이트해야 함', async () => {
      const mockData = {
        id: '1',
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockUnsubscribe = jest.fn();
      const { onSnapshot, updateDoc } = require('firebase/firestore');

      updateDoc.mockResolvedValue(undefined);

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean; id: string; data: () => unknown }) => void
        ) => {
          onNext({
            exists: () => true,
            id: mockData.id,
            data: () => ({
              name: mockData.name,
              role: mockData.role,
              active: mockData.active,
            }),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // update 호출
      await act(async () => {
        await result.current.update({ name: '김철수' });
      });

      expect(updateDoc).toHaveBeenCalled();
    });

    it('update 실패 시 에러를 throw해야 함', async () => {
      const mockData = {
        id: '1',
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockError = new Error('Update failed');
      const mockUnsubscribe = jest.fn();
      const { onSnapshot, updateDoc } = require('firebase/firestore');

      updateDoc.mockRejectedValue(mockError);

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean; id: string; data: () => unknown }) => void
        ) => {
          onNext({
            exists: () => true,
            id: mockData.id,
            data: () => ({
              name: mockData.name,
              role: mockData.role,
              active: mockData.active,
            }),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // update 호출 및 에러 확인
      await expect(
        act(async () => {
          await result.current.update({ name: '김철수' });
        })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('에러 처리', () => {
    it('Firestore 에러를 처리해야 함', async () => {
      const mockError = new Error('Permission denied');
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          _onNext: unknown,
          onError: (error: Error) => void
        ) => {
          onError(mockError);
          return jest.fn();
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(mockError);
      expect(result.current.data).toBeNull();
    });

    it('onError 콜백을 호출해야 함', async () => {
      const mockError = new Error('Network error');
      const onErrorCallback = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          _onNext: unknown,
          onError: (error: Error) => void
        ) => {
          onError(mockError);
          return jest.fn();
        }
      );

      renderHook(() =>
        useFirestoreDocument<Staff>('staff/1', {
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
        useFirestoreDocument<Staff>('staff/1', {
          enabled: false,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('onSuccess 콜백을 호출해야 함', async () => {
      const mockData = {
        id: '1',
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const onSuccessCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean; id: string; data: () => unknown }) => void
        ) => {
          onNext({
            exists: () => true,
            id: mockData.id,
            data: () => ({
              name: mockData.name,
              role: mockData.role,
              active: mockData.active,
            }),
          });
          return mockUnsubscribe;
        }
      );

      renderHook(() =>
        useFirestoreDocument<Staff>('staff/1', {
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
      const mockData = {
        id: '1',
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      let callCount = 0;
      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean; id: string; data: () => unknown }) => void
        ) => {
          callCount++;
          onNext({
            exists: () => true,
            id: mockData.id,
            data: () => ({
              name: mockData.name,
              role: mockData.role,
              active: mockData.active,
            }),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/1')
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
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean }) => void
        ) => {
          onNext({ exists: () => false });
          return mockUnsubscribe;
        }
      );

      const { unmount } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/1')
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
      const mockData = {
        id: '1',
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockUnsubscribe = jest.fn();
      const { onSnapshot } = require('firebase/firestore');

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean; id: string; data: () => unknown }) => void
        ) => {
          onNext({
            exists: () => true,
            id: mockData.id,
            data: () => ({
              name: mockData.name,
              role: mockData.role,
              active: mockData.active,
            }),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const doc = result.current.data as FirestoreDocument<Staff> | null;
      expect(doc?.id).toBe('1');
      expect(doc?.name).toBe('홍길동');
    });

    it('update 함수는 Partial<T>를 받아야 함', async () => {
      const mockData = {
        id: '1',
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockUnsubscribe = jest.fn();
      const { onSnapshot, updateDoc } = require('firebase/firestore');

      updateDoc.mockResolvedValue(undefined);

      onSnapshot.mockImplementation(
        (
          _docRef: unknown,
          onNext: (snapshot: { exists: () => boolean; id: string; data: () => unknown }) => void
        ) => {
          onNext({
            exists: () => true,
            id: mockData.id,
            data: () => ({
              name: mockData.name,
              role: mockData.role,
              active: mockData.active,
            }),
          });
          return mockUnsubscribe;
        }
      );

      const { result } = renderHook(() =>
        useFirestoreDocument<Staff>('staff/1')
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Partial update
      await act(async () => {
        await result.current.update({ name: '김철수' });
      });
    });
  });
});
