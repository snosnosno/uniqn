/**
 * useNotifications Hook 테스트
 *
 * 알림 관리 Hook 테스트
 * Firestore 실시간 구독, 필터링, CRUD 작업을 검증합니다.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import {
  mockOnSnapshot,
  mockUpdateDoc,
  mockDeleteDoc,
  mockCollection,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockDoc,
  mockWriteBatch,
  resetFirebaseMocks,
  triggerSnapshot,
} from '../../__tests__/mocks/firebase';
import { createMockSnapshot } from '../../__tests__/setup/mockFactories';
import {
  createMockNotification,
  notificationFactories,
} from '../../__tests__/mocks/testData';

// ========================================
// Mock Setup
// ========================================

// Firebase Firestore Mock - 테스트 파일에서 직접 mock 설정
jest.mock('firebase/firestore', () => {
  const mocks = require('../../__tests__/mocks/firebase');
  return {
    ...jest.requireActual('firebase/firestore'),
    collection: mocks.mockCollection,
    query: mocks.mockQuery,
    where: mocks.mockWhere,
    orderBy: mocks.mockOrderBy,
    limit: mocks.mockLimit,
    onSnapshot: mocks.mockOnSnapshot,
    doc: mocks.mockDoc,
    updateDoc: mocks.mockUpdateDoc,
    deleteDoc: mocks.mockDeleteDoc,
    writeBatch: mocks.mockWriteBatch,
  };
});

// Firebase db Mock
jest.mock('../../firebase', () => ({
  db: {},
}));

// AuthContext Mock
const mockCurrentUser = {
  uid: 'test-user-1',
  email: 'test@example.com',
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
  }),
}));

// Toast Mock
jest.mock('../useToast', () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

// Logger Mock
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// ========================================
// Test Suite
// ========================================

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFirebaseMocks();

    // mockOnSnapshot 기본 구현: 빈 알림 목록 반환 + 유효한 unsubscribe
    // onSnapshot(query, onNext, onError) - 3개의 인자를 받음
    mockOnSnapshot.mockImplementation((query: any, onNext: Function, onError?: Function) => {
      // 기본적으로 빈 snapshot 반환
      const emptySnapshot = createMockSnapshot([]);
      onNext(emptySnapshot);
      return jest.fn(); // unsubscribe function
    });

    // mockDoc 기본 구현: document reference 반환
    mockDoc.mockImplementation((db: any, collection: string, id: string) => ({
      id,
      path: `${collection}/${id}`,
      type: 'document'
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========================================
  // T057: 초기 상태 테스트
  // ========================================
  describe('초기화', () => {
    test('초기 상태가 올바르게 설정된다', async () => {
      const { result } = renderHook(() => useNotifications());

      // 초기 상태 검증 (useEffect 실행 전)
      expect(result.current.notifications).toEqual([]);
      // beforeEach의 mock이 즉시 실행되어 loading은 false가 됨
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.error).toBeNull();
      expect(result.current.unreadCount).toBe(0);
    });

    test('currentUser가 없으면 빈 알림을 반환한다', async () => {
      // AuthContext Mock 재정의 - spyOn 사용 후 즉시 restore
      const spy = jest.spyOn(require('../../contexts/AuthContext'), 'useAuth')
        .mockReturnValueOnce({
          currentUser: null,
        });

      const { result, unmount } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);

      // 테스트 종료 후 즉시 정리
      unmount();
      spy.mockRestore();
    });
  });

  // ========================================
  // T058: Firestore onSnapshot 구독 테스트
  // ========================================
  describe('실시간 구독', () => {
    test('onSnapshot이 호출되어 실시간 구독을 시작한다', () => {
      renderHook(() => useNotifications());

      // onSnapshot이 호출되었는지 확인
      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    test('알림 데이터를 실시간으로 받아온다', async () => {
      const mockNotifications = [
        createMockNotification({ id: 'notif-1', isRead: false }),
        createMockNotification({ id: 'notif-2', isRead: true }),
      ];

      // onSnapshot Mock 설정
      mockOnSnapshot.mockImplementation((query: any, onNext: Function, onError?: Function) => {
        const snapshot = createMockSnapshot(mockNotifications);
        onNext(snapshot);
        return jest.fn(); // unsubscribe
      });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.unreadCount).toBe(1);
    });
  });

  // ========================================
  // T060: Cleanup 테스트
  // ========================================
  describe('메모리 누수 방지', () => {
    test('언마운트 시 구독이 해제된다', () => {
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useNotifications());

      unmount();

      // unsubscribe가 호출되었는지 확인
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // T061: 필터링 테스트
  // ========================================
  describe('필터링', () => {
    test('읽지 않은 알림만 필터링할 수 있다', async () => {
      const mockNotifications = [
        createMockNotification({ id: 'notif-1', isRead: false }),
        createMockNotification({ id: 'notif-2', isRead: true }),
        createMockNotification({ id: 'notif-3', isRead: false }),
      ];

      mockOnSnapshot.mockImplementation((query: any, onNext: Function, onError?: Function) => {
        const snapshot = createMockSnapshot(mockNotifications);
        onNext(snapshot);
        return jest.fn();
      });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 읽지 않은 알림 개수 확인
      expect(result.current.unreadCount).toBe(2);
    });

    test('필터를 변경할 수 있다', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.setFilter({}); // 빈 필터로 테스트
      });

      expect(result.current.filter).toEqual({});
    });
  });

  // ========================================
  // T064: markAsRead 테스트
  // ========================================
  describe('알림 작업', () => {
    test('알림을 읽음 처리할 수 있다', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      // updateDoc이 호출되었는지 확인
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isRead: true })
      );
    });

    test('모든 알림을 읽음 처리할 수 있다', async () => {
      const mockNotifications = [
        createMockNotification({ id: 'notif-1', isRead: false }),
        createMockNotification({ id: 'notif-2', isRead: false }),
      ];

      mockOnSnapshot.mockImplementation((query: any, onNext: Function, onError?: Function) => {
        const snapshot = createMockSnapshot(mockNotifications);
        onNext(snapshot);
        return jest.fn();
      });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.markAllAsRead();
      });

      // writeBatch를 사용하므로 writeBatch가 호출되었는지 확인
      expect(mockWriteBatch).toHaveBeenCalled();
    });

    test('알림을 삭제할 수 있다', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteNotification('notif-1');
      });

      // deleteDoc이 호출되었는지 확인
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  // ========================================
  // T068: 에러 처리 테스트
  // ========================================
  describe('에러 처리', () => {
    test('Firestore 연결 에러를 처리한다', async () => {
      const mockUnsubscribe = jest.fn();

      // onSnapshot은 항상 unsubscribe를 반환하고, 에러는 error callback으로 전달
      mockOnSnapshot.mockImplementation((query: any, onNext: Function, onError?: Function) => {
        // 에러 콜백 즉시 호출
        if (onError) {
          onError(new Error('Firestore connection error'));
        }
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.notifications).toEqual([]);
    });

    test('업데이트 실패 시 에러를 처리한다', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Permission denied'));

      // 기본 빈 알림 반환하도록 설정
      mockOnSnapshot.mockImplementation((query: any, onNext: Function, onError?: Function) => {
        const snapshot = createMockSnapshot([]);
        onNext(snapshot);
        return jest.fn();
      });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      // 에러가 발생해도 Hook은 정상 동작해야 함
      expect(result.current.notifications).toBeDefined();
    });
  });

  // ========================================
  // T073: 대량 알림 성능 테스트
  // ========================================
  describe('성능', () => {
    test('1000개 이상의 알림을 처리할 수 있다', async () => {
      const manyNotifications = Array.from({ length: 1000 }, (_, i) =>
        createMockNotification({ id: `notif-${i}`, isRead: i % 2 === 0 })
      );

      mockOnSnapshot.mockImplementation((query: any, onNext: Function, onError?: Function) => {
        const snapshot = createMockSnapshot(manyNotifications);
        onNext(snapshot);
        return jest.fn();
      });

      const startTime = performance.now();

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 1000개 처리에 2초 이내
      expect(duration).toBeLessThan(2000);
      expect(result.current.notifications).toHaveLength(1000);
      expect(result.current.unreadCount).toBe(500);
    }, 5000); // 테스트 타임아웃 5초
  });
});
