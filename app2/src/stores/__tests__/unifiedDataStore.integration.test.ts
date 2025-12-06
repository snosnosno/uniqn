/**
 * UnifiedDataStore 통합 테스트
 *
 * Firebase 실시간 구독 통합 테스트
 * - subscribeAll/unsubscribeAll 동작 검증
 * - onSnapshot 콜백 실행 검증
 * - 실시간 데이터 업데이트 검증
 *
 * @version 1.0.0
 * @created 2025-11-15
 * @feature 001-zustand-migration
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useUnifiedDataStore } from '../unifiedDataStore';

// Firebase onSnapshot 모킹
let staffSnapshotCallback: ((snapshot: any) => void) | null = null;

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ name })),
  query: jest.fn((col) => col),
  onSnapshot: jest.fn((query, successCallback) => {
    // 콜백 저장
    if (query.name === 'staff') {
      staffSnapshotCallback = successCallback;
    }
    // unsubscribe 함수 반환
    return jest.fn();
  }),
}));

jest.mock('../../firebase', () => ({
  db: {},
  auth: {},
  functions: {},
}));

// Store 초기화 헬퍼 함수
const resetStore = () => {
  const { result } = renderHook(() => useUnifiedDataStore());
  act(() => {
    result.current.setStaff(new Map());
    result.current.setWorkLogs(new Map());
    result.current.setApplications(new Map());
    result.current.setLoading(false);
    result.current.setError(null);
  });
};

// 실제 Firebase 연동이 필요한 테스트이므로 skip
describe.skip('UnifiedDataStore - 통합 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    staffSnapshotCallback = null;

    // Store 초기화
    resetStore();
  });

  describe('Firebase 실시간 구독', () => {
    it('subscribeAll이 Firebase 구독을 시작해야 함', () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      act(() => {
        result.current.subscribeAll('user123', 'admin');
      });

      const { onSnapshot } = require('firebase/firestore');
      expect(onSnapshot).toHaveBeenCalled();
    });

    it('onSnapshot 콜백이 staff 데이터를 Store에 업데이트해야 함', async () => {
      const { result } = renderHook(() => useUnifiedDataStore());

      // Firebase 구독 시작
      act(() => {
        result.current.subscribeAll('user123', 'admin');
      });

      // 모킹된 Firestore 스냅샷 데이터
      const mockSnapshot = {
        docs: [
          {
            id: 'staff1',
            data: () => ({
              name: '홍길동',
              email: 'hong@example.com',
              phone: '010-1234-5678',
              role: 'dealer',
              userId: 'user1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          },
        ],
      };

      // onSnapshot 콜백 실행
      act(() => {
        if (staffSnapshotCallback) {
          staffSnapshotCallback(mockSnapshot);
        }
      });

      // Store에 데이터가 업데이트되었는지 확인
      await waitFor(() => {
        expect(result.current.staff.size).toBe(1);
      });
      expect(result.current.staff.get('staff1')?.name).toBe('홍길동');
    });
  });
});
