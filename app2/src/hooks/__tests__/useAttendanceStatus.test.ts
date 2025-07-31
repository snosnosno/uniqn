import { renderHook, act, waitFor } from '@testing-library/react';
import { useAttendanceStatus } from '../useAttendanceStatus';
import { setupFirestoreMock, setupAuthMock, mockFirestore } from '../../__tests__/setup/firebase-mock';
import type { AttendanceStatus } from '../../types/schedule';

// Firebase 모킹
jest.mock('../../firebase', () => ({
  db: mockFirestore,
  auth: { currentUser: { uid: 'test-user' } }
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => mockFirestore),
  doc: jest.fn(() => mockFirestore),
  getDocs: jest.fn(),
  query: jest.fn(() => mockFirestore),
  where: jest.fn(() => mockFirestore),
  orderBy: jest.fn(() => mockFirestore),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() }))
  }
}));

describe('useAttendanceStatus', () => {
  const mockStaffId = 'test-staff-id';
  const mockDate = '2024-07-25';
  const mockWorkLog = {
    id: 'work-log-1',
    staffId: mockStaffId,
    date: mockDate,
    scheduledStartTime: '09:00',
    scheduledEndTime: '18:00',
    actualStartTime: '09:05',
    actualEndTime: null,
    status: 'checked_in' as AttendanceStatus
  };

  const mockAttendanceRecord = {
    id: 'attendance-1',
    staffId: mockStaffId,
    date: mockDate,
    status: 'checked_in' as AttendanceStatus,
    checkInTime: new Date('2024-07-25T09:05:00'),
    checkOutTime: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupFirestoreMock([]);
  });

  test('초기 상태가 올바르게 설정되어야 함', () => {
    const { result } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.status).toBe('not_started');
    expect(result.current.workLog).toBeNull();
    expect(result.current.attendanceRecord).toBeNull();
  });

  test('workLog와 attendanceRecord를 올바르게 로드해야 함', async () => {
    setupFirestoreMock([mockWorkLog]);
    
    const { result } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.workLog).toEqual(mockWorkLog);
    expect(result.current.status).toBe('checked_in');
  });

  test('출석 상태를 업데이트할 수 있어야 함', async () => {
    setupFirestoreMock([mockWorkLog]);
    
    const { result } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateStatus('checked_out');
    });

    // updateDoc이 호출되었는지 확인
    expect(mockFirestore.update).toHaveBeenCalled();
  });

  test('시간을 업데이트할 수 있어야 함', async () => {
    setupFirestoreMock([mockWorkLog]);
    
    const { result } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateTime('10:00', '19:00');
    });

    // updateDoc이 호출되었는지 확인
    expect(mockFirestore.update).toHaveBeenCalled();
  });

  test('퇴근시간 설정 시 자동으로 출석 상태가 변경되어야 함', async () => {
    setupFirestoreMock([{ ...mockWorkLog, actualEndTime: null }]);
    
    const { result } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 퇴근시간 설정
    await act(async () => {
      await result.current.updateTime('09:00', '18:00');
    });

    // updateDoc이 status: 'completed'로 호출되었는지 확인
    expect(mockFirestore.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed'
    }));
  });

  test('출석 기록을 삭제할 수 있어야 함', async () => {
    setupFirestoreMock([mockWorkLog]);
    
    const { result } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteRecord();
    });

    // deleteDoc이 호출되었는지 확인
    expect(mockFirestore.delete).toHaveBeenCalled();
  });

  test('staffId나 date가 없으면 데이터를 로드하지 않아야 함', () => {
    const { result: resultNoStaffId } = renderHook(() => 
      useAttendanceStatus('', mockDate)
    );

    const { result: resultNoDate } = renderHook(() => 
      useAttendanceStatus(mockStaffId, '')
    );

    expect(resultNoStaffId.current.loading).toBe(false);
    expect(resultNoDate.current.loading).toBe(false);
  });

  test('실시간 업데이트를 구독해야 함', async () => {
    const unsubscribeMock = jest.fn();
    mockFirestore.onSnapshot.mockImplementation((callback: any) => {
      callback({
        docs: [{
          id: mockWorkLog.id,
          data: () => mockWorkLog,
          exists: () => true
        }],
        empty: false,
        size: 1
      });
      return unsubscribeMock;
    });

    const { result, unmount } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFirestore.onSnapshot).toHaveBeenCalled();

    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  test('에러를 적절히 처리해야 함', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFirestore.update.mockRejectedValueOnce(new Error('Update failed'));

    const { result } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    await act(async () => {
      await result.current.updateStatus('checked_out');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '출석 상태 업데이트 오류:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  test('로딩 상태를 올바르게 관리해야 함', async () => {
    const { result } = renderHook(() => 
      useAttendanceStatus(mockStaffId, mockDate)
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});