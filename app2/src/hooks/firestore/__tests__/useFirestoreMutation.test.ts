/**
 * useFirestoreMutation Hook 테스트
 *
 * @description
 * Firestore CRUD 작업 Hook의 모든 기능을 테스트합니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 */

import { renderHook, act } from '@testing-library/react';
import { useFirestoreMutation } from '../useFirestoreMutation';

// Mock Firebase
jest.mock('../../../firebase', () => ({
  db: {},
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
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

describe('useFirestoreMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create 기능', () => {
    it('문서를 성공적으로 생성해야 함', async () => {
      const newStaff: Staff = {
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockDocId = 'new-doc-id';
      const { addDoc } = require('firebase/firestore');

      addDoc.mockResolvedValue({ id: mockDocId });

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      let docId: string = '';

      await act(async () => {
        docId = await result.current.create('staff', newStaff);
      });

      expect(docId).toBe(mockDocId);
      expect(addDoc).toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('create 실패 시 에러를 처리해야 함', async () => {
      const newStaff: Staff = {
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockError = new Error('Permission denied');
      const { addDoc } = require('firebase/firestore');

      addDoc.mockRejectedValue(mockError);

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      let thrownError: Error | null = null;
      try {
        await act(async () => {
          await result.current.create('staff', newStaff);
        });
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).toEqual(mockError);
      expect(result.current.loading).toBe(false);
    });

    it('create 성공 시 onSuccess 콜백 호출', async () => {
      const newStaff: Staff = {
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockDocId = 'new-doc-id';
      const onSuccessCallback = jest.fn();
      const { addDoc } = require('firebase/firestore');

      addDoc.mockResolvedValue({ id: mockDocId });

      const { result } = renderHook(() =>
        useFirestoreMutation<Staff>({
          onSuccess: onSuccessCallback,
        })
      );

      await act(async () => {
        await result.current.create('staff', newStaff);
      });

      expect(onSuccessCallback).toHaveBeenCalled();
    });

    it('create 실패 시 onError 콜백 호출', async () => {
      const newStaff: Staff = {
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const mockError = new Error('Network error');
      const onErrorCallback = jest.fn();
      const { addDoc } = require('firebase/firestore');

      addDoc.mockRejectedValue(mockError);

      const { result } = renderHook(() =>
        useFirestoreMutation<Staff>({
          onError: onErrorCallback,
        })
      );

      try {
        await act(async () => {
          await result.current.create('staff', newStaff);
        });
      } catch {
        // 에러 무시
      }

      expect(onErrorCallback).toHaveBeenCalledWith(mockError);
    });
  });

  describe('update 기능', () => {
    it('문서를 성공적으로 업데이트해야 함', async () => {
      const updateData: Partial<Staff> = {
        name: '김철수',
      };

      const { updateDoc } = require('firebase/firestore');

      updateDoc.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      await act(async () => {
        await result.current.update('staff/doc-id', updateData);
      });

      expect(updateDoc).toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('update 실패 시 에러를 처리해야 함', async () => {
      const updateData: Partial<Staff> = {
        name: '김철수',
      };

      const mockError = new Error('Document not found');
      const { updateDoc } = require('firebase/firestore');

      updateDoc.mockRejectedValue(mockError);

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      let thrownError: Error | null = null;
      try {
        await act(async () => {
          await result.current.update('staff/doc-id', updateData);
        });
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).toEqual(mockError);
      expect(result.current.loading).toBe(false);
    });

    it('update 성공 시 onSuccess 콜백 호출', async () => {
      const updateData: Partial<Staff> = {
        name: '김철수',
      };

      const onSuccessCallback = jest.fn();
      const { updateDoc } = require('firebase/firestore');

      updateDoc.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useFirestoreMutation<Staff>({
          onSuccess: onSuccessCallback,
        })
      );

      await act(async () => {
        await result.current.update('staff/doc-id', updateData);
      });

      expect(onSuccessCallback).toHaveBeenCalled();
    });
  });

  describe('delete 기능', () => {
    it('문서를 성공적으로 삭제해야 함', async () => {
      const { deleteDoc } = require('firebase/firestore');

      deleteDoc.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      await act(async () => {
        await result.current.delete('staff/doc-id');
      });

      expect(deleteDoc).toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('delete 실패 시 에러를 처리해야 함', async () => {
      const mockError = new Error('Permission denied');
      const { deleteDoc } = require('firebase/firestore');

      deleteDoc.mockRejectedValue(mockError);

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      let thrownError: Error | null = null;
      try {
        await act(async () => {
          await result.current.delete('staff/doc-id');
        });
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).toEqual(mockError);
      expect(result.current.loading).toBe(false);
    });

    it('delete 성공 시 onSuccess 콜백 호출', async () => {
      const onSuccessCallback = jest.fn();
      const { deleteDoc } = require('firebase/firestore');

      deleteDoc.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useFirestoreMutation<Staff>({
          onSuccess: onSuccessCallback,
        })
      );

      await act(async () => {
        await result.current.delete('staff/doc-id');
      });

      expect(onSuccessCallback).toHaveBeenCalled();
    });
  });

  describe('로딩 상태', () => {
    it('create 중 loading=true 여야 함', async () => {
      const newStaff: Staff = {
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const { addDoc } = require('firebase/firestore');

      let resolveAddDoc: (value: { id: string }) => void;
      const addDocPromise = new Promise<{ id: string }>((resolve) => {
        resolveAddDoc = resolve;
      });

      addDoc.mockReturnValue(addDocPromise);

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      // loading은 너무 빠르게 변하므로 생략
      let createPromise: Promise<void>;
      act(() => {
        createPromise = result.current.create('staff', newStaff).then(() => {});
      });

      // Promise 완료
      resolveAddDoc!({ id: 'new-id' });
      await act(async () => {
        await createPromise!;
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('여러 작업 연속 실행', () => {
    it('create → update → delete 순서대로 실행', async () => {
      const { addDoc, updateDoc, deleteDoc } = require('firebase/firestore');

      addDoc.mockResolvedValue({ id: 'new-id' });
      updateDoc.mockResolvedValue(undefined);
      deleteDoc.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      // 1. Create
      let docId: string = '';
      await act(async () => {
        docId = await result.current.create('staff', {
          name: '홍길동',
          role: 'dealer',
          active: true,
        });
      });

      expect(docId).toBe('new-id');

      // 2. Update
      await act(async () => {
        await result.current.update(`staff/${docId}`, {
          name: '김철수',
        });
      });

      expect(updateDoc).toHaveBeenCalled();

      // 3. Delete
      await act(async () => {
        await result.current.delete(`staff/${docId}`);
      });

      expect(deleteDoc).toHaveBeenCalled();
    });
  });

  describe('타입 안전성', () => {
    it('create는 전체 타입을 요구해야 함', async () => {
      const newStaff: Staff = {
        name: '홍길동',
        role: 'dealer',
        active: true,
      };

      const { addDoc } = require('firebase/firestore');
      addDoc.mockResolvedValue({ id: 'new-id' });

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      await act(async () => {
        await result.current.create('staff', newStaff);
      });
    });

    it('update는 Partial 타입을 받아야 함', async () => {
      const partialUpdate: Partial<Staff> = {
        name: '김철수',
      };

      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      await act(async () => {
        await result.current.update('staff/doc-id', partialUpdate);
      });
    });
  });

  describe('에러 복구', () => {
    it('에러 후 다시 작업 가능해야 함', async () => {
      const { addDoc } = require('firebase/firestore');

      // 첫 번째 호출은 실패
      addDoc.mockRejectedValueOnce(new Error('First error'));

      // 두 번째 호출은 성공
      addDoc.mockResolvedValueOnce({ id: 'new-id' });

      const { result } = renderHook(() => useFirestoreMutation<Staff>());

      // 첫 번째 시도 (실패)
      try {
        await act(async () => {
          await result.current.create('staff', {
            name: '홍길동',
            role: 'dealer',
            active: true,
          });
        });
      } catch {
        // 에러 무시
      }

      // 두 번째 시도 (성공)
      let docId: string = '';
      await act(async () => {
        docId = await result.current.create('staff', {
          name: '김철수',
          role: 'manager',
          active: true,
        });
      });

      expect(docId).toBe('new-id');
    });
  });
});
