import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttendanceStatusPopover from '../attendance/AttendanceStatusPopover';
import { customRender as render } from '../../__tests__/setup/test-utils';
import { updateDoc, Timestamp } from 'firebase/firestore';

// Firebase 함수 모킹
jest.mock('firebase/firestore', () => ({
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() }))
  }
}));

// useToast 모킹
jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn()
  })
}));

describe('AttendanceStatusPopover', () => {
  const defaultProps = {
    workLogId: 'work-log-1',
    currentStatus: 'not_started' as const,
    staffId: 'staff-1',
    staffName: '홍길동',
    eventId: 'event-1',
    onStatusChange: jest.fn(),
    canEdit: true,
    applyOptimisticUpdate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('현재 상태가 올바르게 표시되어야 함', () => {
    render(<AttendanceStatusPopover {...defaultProps} />);

    expect(screen.getByText('출근 전')).toBeInTheDocument();
  });

  test('버튼 클릭 시 팝오버가 열려야 함', async () => {
    const user = userEvent.setup();
    render(<AttendanceStatusPopover {...defaultProps} />);

    const statusButton = screen.getByRole('button', { name: /출근 전/i });
    await user.click(statusButton);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('출근')).toBeInTheDocument();
    expect(screen.getByText('퇴근')).toBeInTheDocument();
  });

  test('편집 권한이 없을 때 버튼이 비활성화되어야 함', () => {
    render(<AttendanceStatusPopover {...defaultProps} canEdit={false} />);

    const statusButton = screen.getByRole('button', { name: /출근 전/i });
    expect(statusButton).toBeDisabled();
  });

  test('상태 변경 시 업데이트가 실행되어야 함', async () => {
    const user = userEvent.setup();
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    
    render(<AttendanceStatusPopover {...defaultProps} />);

    const statusButton = screen.getByRole('button', { name: /출근 전/i });
    await user.click(statusButton);

    const checkedInOption = screen.getByText('출근');
    await user.click(checkedInOption);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
    });
    
    expect(defaultProps.onStatusChange).toHaveBeenCalledWith('checked_in');
    expect(defaultProps.applyOptimisticUpdate).toHaveBeenCalledWith('work-log-1', 'checked_in');
  });

  test('출근 상태로 변경 시 actualStartTime이 설정되어야 함', async () => {
    const user = userEvent.setup();
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    
    render(<AttendanceStatusPopover {...defaultProps} />);

    const statusButton = screen.getByRole('button', { name: /출근 전/i });
    await user.click(statusButton);

    const checkedInOption = screen.getByText('출근');
    await user.click(checkedInOption);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'checked_in',
          actualStartTime: expect.anything()
        })
      );
    });
  });

  test('퇴근 상태로 변경 시 actualEndTime이 설정되어야 함', async () => {
    const user = userEvent.setup();
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    
    render(
      <AttendanceStatusPopover 
        {...defaultProps} 
        currentStatus="checked_in"
        actualStartTime={new Date('2024-07-25T09:00:00')}
      />
    );

    const statusButton = screen.getByRole('button', { name: /출근/i });
    await user.click(statusButton);

    const checkedOutOption = screen.getByText('퇴근');
    await user.click(checkedOutOption);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'checked_out',
          actualEndTime: expect.anything()
        })
      );
    });
  });

  test('이미 선택된 상태를 다시 선택하면 변경되지 않아야 함', async () => {
    const user = userEvent.setup();
    render(<AttendanceStatusPopover {...defaultProps} />);

    const statusButton = screen.getByRole('button', { name: /출근 전/i });
    await user.click(statusButton);

    const notStartedOption = screen.getByText('출근 전');
    await user.click(notStartedOption);

    expect(updateDoc).not.toHaveBeenCalled();
    expect(defaultProps.onStatusChange).not.toHaveBeenCalled();
  });

  test('시간 정보가 표시되어야 함', () => {
    const startTime = Timestamp.fromDate(new Date('2024-07-25T09:05:00'));
    const endTime = Timestamp.fromDate(new Date('2024-07-25T18:10:00'));
    
    render(
      <AttendanceStatusPopover 
        {...defaultProps}
        currentStatus="checked_out"
        actualStartTime={startTime}
        actualEndTime={endTime}
      />
    );

    expect(screen.getByText(/09:05/)).toBeInTheDocument();
    expect(screen.getByText(/18:10/)).toBeInTheDocument();
  });

  test('팝오버 외부 클릭 시 닫혀야 함', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <AttendanceStatusPopover {...defaultProps} />
        <button>Outside Button</button>
      </div>
    );

    const statusButton = screen.getByRole('button', { name: /출근 전/i });
    await user.click(statusButton);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    const outsideButton = screen.getByText('Outside Button');
    await user.click(outsideButton);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  test('로딩 상태가 올바르게 표시되어야 함', async () => {
    const user = userEvent.setup();
    (updateDoc as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<AttendanceStatusPopover {...defaultProps} />);

    const statusButton = screen.getByRole('button', { name: /출근 전/i });
    await user.click(statusButton);

    const checkedInOption = screen.getByText('출근');
    await user.click(checkedInOption);

    expect(statusButton).toBeDisabled();

    await waitFor(() => {
      expect(statusButton).not.toBeDisabled();
    });
  });

  test('에러 발생 시 적절히 처리되어야 함', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));
    
    render(<AttendanceStatusPopover {...defaultProps} />);

    const statusButton = screen.getByRole('button', { name: /출근 전/i });
    await user.click(statusButton);

    const checkedInOption = screen.getByText('출근');
    await user.click(checkedInOption);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '출석 상태 업데이트 오류:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  test('다양한 크기가 올바르게 적용되어야 함', () => {
    const { rerender } = render(
      <AttendanceStatusPopover {...defaultProps} size="sm" />
    );

    let statusButton = screen.getByRole('button', { name: /출근 전/i });
    expect(statusButton.className).toContain('text-xs');

    rerender(<AttendanceStatusPopover {...defaultProps} size="lg" />);

    statusButton = screen.getByRole('button', { name: /출근 전/i });
    expect(statusButton.className).toContain('text-base');
  });
});