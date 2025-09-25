import { renderHook, act, waitFor } from '@testing-library/react';
import { useAttendanceStatus } from '../useAttendanceStatus';
import type { AttendanceStatus } from '../../types/schedule';

// Firebase 모킹 - jest.mock 내부에서 정의
jest.mock('../../firebase', () => {
  const mockFirestore: any = {
    collection: jest.fn((_path) => mockFirestore),
    doc: jest.fn(() => mockFirestore),
    where: jest.fn(() => mockFirestore),
    orderBy: jest.fn(() => mockFirestore),
    limit: jest.fn(() => mockFirestore),
    get: jest.fn(() => Promise.resolve({
      docs: [],
      empty: true,
      size: 0
    })),
    onSnapshot: jest.fn((callback: any) => {
      if (typeof callback === 'function') {
        callback({
          docs: [],
          empty: true,
          size: 0
        });
      }
      return jest.fn();
    }),
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    add: jest.fn(() => Promise.resolve({ id: 'mock-id' }))
  };
  
  return {
    db: mockFirestore,
    auth: { currentUser: { uid: 'test-user' } }
  };
});

// firebaseConnectionManager 모킹
jest.mock('../../utils/firebaseConnectionManager', () => ({
  firebaseConnectionManager: {
    safeOnSnapshot: jest.fn((path, callback, _errorCallback) => {
      // 즉시 빈 데이터로 콜백 실행
      if (typeof callback === 'function') {
        callback([]);
      }
      return jest.fn(); // unsubscribe 함수
    })
  },
  safeOnSnapshot: jest.fn((path, callback, _errorCallback) => {
    if (typeof callback === 'function') {
      callback([]);
    }
    return jest.fn();
  })
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({
    docs: [],
    empty: true,
    size: 0
  })),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn((query, callback) => {
    if (typeof callback === 'function') {
      callback({
        docs: [],
        empty: true,
        size: 0
      });
    }
    return jest.fn();
  }),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  Timestamp: {
    now: jest.fn(() => ({ 
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0
    }))
  }
}));

describe('useAttendanceStatus', () => {
  const mockStaffId = 'test-staff-id';
  const mockDate = '2024-07-25';
  const _mockWorkLog = {
    id: 'work-log-1',
    staffId: mockStaffId,
    date: mockDate,
    scheduledStartTime: '09:00',
    scheduledEndTime: '18:00',
    actualStartTime: '09:05',
    actualEndTime: null,
    status: 'checked_in' as AttendanceStatus
  };

  const _mockAttendanceRecord = {
    id: 'attendance-1',
    staffId: mockStaffId,
    date: mockDate,
    status: 'checked_in' as AttendanceStatus,
    actualStartTime: new Date('2024-07-25T09:05:00'),
    actualEndTime: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initializes with loading state', () => {
    const { result } = renderHook(() => useAttendanceStatus({ eventId: 'event-1' }));

    expect(result.current.loading).toBe(true);
    expect(result.current.attendanceRecords).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  test('loads attendance data successfully', async () => {
    const { result } = renderHook(() => useAttendanceStatus({ eventId: 'event-1' }));

    // 초기 로딩 상태
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 모킹된 데이터가 빈 배열이므로 null이 예상됨
    expect(result.current.attendanceRecords).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  test('updates attendance status', async () => {
    const { result } = renderHook(() => useAttendanceStatus({ eventId: 'event-1' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newStatus: AttendanceStatus = 'checked_out';
    
    act(() => {
      // updateAttendanceStatus 메서드가 없으므로 applyOptimisticUpdate 테스트로 변경
      result.current.applyOptimisticUpdate('worklog-1', newStatus);
    });

    // updateDoc이 호출되었는지 확인
    const { updateDoc } = require('firebase/firestore');
    expect(updateDoc).toHaveBeenCalled();
  });

  test('handles errors gracefully', async () => {
    // 에러를 발생시키도록 모킹 수정
    const { safeOnSnapshot } = require('../../utils/firebaseConnectionManager');
    safeOnSnapshot.mockImplementation((path: string, callback: any, errorCallback: any) => {
      if (errorCallback) {
        errorCallback(new Error('Firebase error'));
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useAttendanceStatus({ eventId: 'event-1' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Firebase error');
    expect(result.current.attendanceRecords).toEqual([]);
  });

  test('cleans up subscriptions on unmount', () => {
    const unsubscribeMock = jest.fn();
    const { safeOnSnapshot } = require('../../utils/firebaseConnectionManager');
    safeOnSnapshot.mockReturnValue(unsubscribeMock);

    const { unmount } = renderHook(() => useAttendanceStatus({ eventId: 'event-1' }));

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});