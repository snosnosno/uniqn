import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkTimeEditor from '../WorkTimeEditor';
import { customRender } from '../../__tests__/setup/test-utils';
import { setupFirestoreMock, mockFirestore } from '../../__tests__/setup/firebase-mock';
import { updateDoc, setDoc, getDocs, Timestamp } from 'firebase/firestore';

// Firebase 함수 모킹
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('../../__tests__/setup/firebase-mock'),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((date: Date) => ({ toDate: () => date }))
  }
}));

// useAttendanceStatus 모킹
jest.mock('../../hooks/useAttendanceStatus', () => ({
  useAttendanceStatus: jest.fn(() => ({
    getStaffAttendanceStatus: jest.fn(() => ({
      status: 'checked_in',
      checkInTime: new Date('2024-07-25T09:00:00'),
      checkOutTime: null
    }))
  }))
}));

// useToast 모킹
jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn()
  })
}));

describe('WorkTimeEditor', () => {
  const mockWorkLog = {
    id: 'work-log-1',
    eventId: 'event-1',
    staffId: 'staff-1',
    date: '2024-07-25',
    scheduledStartTime: Timestamp.fromDate(new Date('2024-07-25T09:00:00')),
    scheduledEndTime: Timestamp.fromDate(new Date('2024-07-25T18:00:00')),
    actualStartTime: null,
    actualEndTime: null
  };

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    workLog: mockWorkLog,
    onUpdate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('모달이 올바르게 렌더링되어야 함', () => {
    customRender(<WorkTimeEditor {...defaultProps} />);

    expect(screen.getByText('근무 시간 편집')).toBeInTheDocument();
    expect(screen.getByLabelText('출근 시간')).toBeInTheDocument();
    expect(screen.getByLabelText('퇴근 시간')).toBeInTheDocument();
  });

  test('workLog 데이터가 입력 필드에 올바르게 표시되어야 함', () => {
    customRender(<WorkTimeEditor {...defaultProps} />);

    const startTimeInput = screen.getByLabelText('출근 시간') as HTMLInputElement;
    const endTimeInput = screen.getByLabelText('퇴근 시간') as HTMLInputElement;

    expect(startTimeInput.value).toBe('09:00');
    expect(endTimeInput.value).toBe('18:00');
  });

  test('시간을 변경할 수 있어야 함', async () => {
    const user = userEvent.setup();
    customRender(<WorkTimeEditor {...defaultProps} />);

    const startTimeInput = screen.getByLabelText('출근 시간') as HTMLInputElement;
    
    await user.clear(startTimeInput);
    await user.type(startTimeInput, '10:00');
    
    expect(startTimeInput.value).toBe('10:00');
  });

  test('저장 버튼 클릭 시 업데이트가 실행되어야 함', async () => {
    const user = userEvent.setup();
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    
    customRender(<WorkTimeEditor {...defaultProps} />);

    const saveButton = screen.getByText('저장');
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
      expect(defaultProps.onUpdate).toHaveBeenCalled();
    });
  });

  test('시간 유효성 검증이 작동해야 함', async () => {
    const user = userEvent.setup();
    customRender(<WorkTimeEditor {...defaultProps} />);

    const startTimeInput = screen.getByLabelText('출근 시간') as HTMLInputElement;
    const endTimeInput = screen.getByLabelText('퇴근 시간') as HTMLInputElement;
    
    // 퇴근 시간을 출근 시간보다 이전으로 설정
    await user.clear(startTimeInput);
    await user.type(startTimeInput, '18:00');
    await user.clear(endTimeInput);
    await user.type(endTimeInput, '09:00');
    
    const saveButton = screen.getByText('저장');
    await user.click(saveButton);

    // 에러 메시지가 표시되어야 함
    await waitFor(() => {
      expect(screen.getByText(/퇴근 시간은 출근 시간보다 늦어야 합니다/)).toBeInTheDocument();
    });
  });

  test('취소 버튼 클릭 시 모달이 닫혀야 함', async () => {
    const user = userEvent.setup();
    customRender(<WorkTimeEditor {...defaultProps} />);

    const cancelButton = screen.getByText('취소');
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('workLog가 없을 때 새 기록을 생성해야 함', async () => {
    const user = userEvent.setup();
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    
    customRender(<WorkTimeEditor {...defaultProps} workLog={null} />);

    const startTimeInput = screen.getByLabelText('출근 시간') as HTMLInputElement;
    const endTimeInput = screen.getByLabelText('퇴근 시간') as HTMLInputElement;
    
    await user.type(startTimeInput, '09:00');
    await user.type(endTimeInput, '18:00');
    
    const saveButton = screen.getByText('저장');
    await user.click(saveButton);

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalled();
    });
  });

  test('특정 시간 타입만 편집할 수 있어야 함', () => {
    customRender(<WorkTimeEditor {...defaultProps} timeType="start" />);

    const startTimeInput = screen.getByLabelText('출근 시간') as HTMLInputElement;
    const endTimeInput = screen.getByLabelText('퇴근 시간') as HTMLInputElement;

    expect(startTimeInput).not.toBeDisabled();
    expect(endTimeInput).toBeDisabled();
  });

  test('퇴근시간 설정 시 자동으로 출석 상태가 변경되어야 함', async () => {
    const user = userEvent.setup();
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (getDocs as jest.Mock).mockResolvedValue({ 
      docs: [{ 
        id: 'attendance-1', 
        data: () => ({ status: 'checked_in' }) 
      }] 
    });
    
    // 출근 상태의 workLog
    const checkedInWorkLog = {
      ...mockWorkLog,
      actualStartTime: Timestamp.fromDate(new Date('2024-07-25T09:05:00')),
      actualEndTime: null
    };
    
    customRender(<WorkTimeEditor {...defaultProps} workLog={checkedInWorkLog} />);

    const endTimeInput = screen.getByLabelText('퇴근 시간') as HTMLInputElement;
    
    await user.clear(endTimeInput);
    await user.type(endTimeInput, '18:00');
    
    const saveButton = screen.getByText('저장');
    await user.click(saveButton);

    await waitFor(() => {
      // workLog 업데이트 확인
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          actualEndTime: expect.anything(),
          status: 'completed'
        })
      );
    });
  });

  test('로딩 상태가 올바르게 표시되어야 함', async () => {
    const user = userEvent.setup();
    (updateDoc as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    customRender(<WorkTimeEditor {...defaultProps} />);

    const saveButton = screen.getByText('저장');
    await user.click(saveButton);

    expect(screen.getByText('저장 중...')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('저장')).toBeInTheDocument();
      expect(saveButton).not.toBeDisabled();
    });
  });

  test('에러 발생 시 적절히 처리되어야 함', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));
    
    customRender(<WorkTimeEditor {...defaultProps} />);

    const saveButton = screen.getByText('저장');
    await user.click(saveButton);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '근무 시간 업데이트 오류:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });
});