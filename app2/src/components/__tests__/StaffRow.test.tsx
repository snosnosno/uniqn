import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffRow from '../StaffRow';
import { render } from '../../test-utils/test-utils';
import type { StaffData } from '../../hooks/useStaffManagement';

// AttendanceStatusCard 컴포넌트 모킹
jest.mock('../AttendanceStatusCard', () => ({
  __esModule: true,
  default: ({ status, onEdit }: any) => (
    <div data-testid="attendance-status-card">
      <span>{status || 'not_started'}</span>
      {onEdit && <button onClick={onEdit}>Edit Status</button>}
    </div>
  )
}));

// AttendanceStatusPopover 컴포넌트 모킹
jest.mock('../AttendanceStatusPopover', () => ({
  __esModule: true,
  default: ({ children, onStatusChange }: any) => (
    <div data-testid="attendance-popover">
      {children}
      <button onClick={() => onStatusChange('checked_in')}>체크인</button>
      <button onClick={() => onStatusChange('checked_out')}>체크아웃</button>
    </div>
  )
}));

describe('StaffRow', () => {
  const mockStaff: StaffData = {
    id: 'staff-1',
    userId: 'user-1',
    name: '홍길동',
    email: 'hong@example.com',
    phone: '010-1234-5678',
    role: 'Dealer',
    userRole: 'staff',
    assignedRole: '딜러',
    assignedTime: '09:00-18:00',
    assignedDate: '2024-07-25',
    postingId: 'posting-1',
    postingTitle: '테스트 공고'
  };

  const defaultProps = {
    staff: mockStaff,
    onEditWorkTime: jest.fn(),
    onDeleteStaff: jest.fn(),
    getStaffAttendanceStatus: jest.fn(() => ({
      status: 'not_started',
      workLogId: 'work-log-1'
    })),
    attendanceRecords: [],
    formatTimeDisplay: jest.fn((time) => time || '시간 미정'),
    getTimeSlotColor: jest.fn(() => 'bg-blue-100'),
    showDate: false,
    onShowProfile: jest.fn(),
    eventId: 'event-1',
    canEdit: true,
    getStaffWorkLog: jest.fn(() => null),
    applyOptimisticUpdate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('스태프 정보가 올바르게 표시되어야 함', () => {
    render(<StaffRow {...defaultProps} />);

    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('딜러')).toBeInTheDocument();
    expect(screen.getByText('09:00-18:00')).toBeInTheDocument();
    expect(screen.getByText('hong@example.com')).toBeInTheDocument();
    expect(screen.getByText('010-1234-5678')).toBeInTheDocument();
  });

  test('날짜가 표시 모드일 때 날짜가 보여야 함', () => {
    render(<StaffRow {...defaultProps} showDate={true} />);

    expect(screen.getByText('7월 25일')).toBeInTheDocument();
  });

  test('편집 권한이 없을 때 편집 버튼이 숨겨져야 함', () => {
    render(<StaffRow {...defaultProps} canEdit={false} />);

    expect(screen.queryByText('Edit Status')).not.toBeInTheDocument();
  });

  test('시간 편집 버튼 클릭 시 콜백이 호출되어야 함', async () => {
    const user = userEvent.setup();
    render(<StaffRow {...defaultProps} />);

    const timeDisplay = screen.getByText('09:00-18:00');
    await user.click(timeDisplay);

    expect(defaultProps.onEditWorkTime).toHaveBeenCalledWith('staff-1', undefined);
  });

  test('프로필 보기 버튼 클릭 시 콜백이 호출되어야 함', async () => {
    const user = userEvent.setup();
    render(<StaffRow {...defaultProps} />);

    const profileButton = screen.getByRole('button', { name: /프로필 보기/i });
    await user.click(profileButton);

    expect(defaultProps.onShowProfile).toHaveBeenCalledWith('staff-1');
  });

  test('삭제 버튼 클릭 시 확인 후 삭제가 실행되어야 함', async () => {
    const user = userEvent.setup();
    window.confirm = jest.fn(() => true);
    
    render(<StaffRow {...defaultProps} />);

    const deleteButton = screen.getByRole('button', { name: /삭제/i });
    await user.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('정말로 이 스태프를 삭제하시겠습니까?');
    expect(defaultProps.onDeleteStaff).toHaveBeenCalledWith('staff-1');
  });

  test('멀티 선택 모드에서 체크박스가 표시되어야 함', () => {
    render(<StaffRow {...defaultProps} multiSelectMode={true} />);

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  test('선택된 상태에서 올바른 스타일이 적용되어야 함', () => {
    render(<StaffRow {...defaultProps} multiSelectMode={true} isSelected={true} />);

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  test('체크박스 클릭 시 선택 콜백이 호출되어야 함', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    
    render(
      <StaffRow 
        {...defaultProps} 
        multiSelectMode={true} 
        onSelect={onSelect}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(onSelect).toHaveBeenCalledWith('staff-1', expect.any(Object));
  });

  test('스태프 정보가 없을 때 기본값이 표시되어야 함', () => {
    const incompleteStaff: StaffData = {
      ...mockStaff,
      name: undefined,
      assignedRole: undefined,
      assignedTime: undefined,
      phone: undefined,
      email: undefined
    };

    render(<StaffRow {...defaultProps} staff={incompleteStaff} />);

    expect(screen.getByText('이름 미정')).toBeInTheDocument();
    expect(screen.getByText('역할 미정')).toBeInTheDocument();
    expect(screen.getByText('시간 미정')).toBeInTheDocument();
  });

  test('출석 상태가 올바르게 표시되어야 함', () => {
    defaultProps.getStaffAttendanceStatus.mockReturnValue({
      status: 'checked_in',
      workLogId: 'work-log-1'
    });

    render(<StaffRow {...defaultProps} />);

    expect(screen.getByText('checked_in')).toBeInTheDocument();
  });

  test('시간 슬롯 색상이 올바르게 적용되어야 함', () => {
    defaultProps.getTimeSlotColor.mockReturnValue('bg-green-100 text-green-800');
    
    render(<StaffRow {...defaultProps} />);

    const timeElement = screen.getByText('09:00-18:00');
    expect(timeElement.className).toContain('bg-green-100');
    expect(timeElement.className).toContain('text-green-800');
  });

  test('workLog 데이터가 있을 때 우선 표시되어야 함', () => {
    defaultProps.getStaffWorkLog.mockReturnValue({
      scheduledStartTime: '10:00',
      scheduledEndTime: '19:00'
    });

    render(<StaffRow {...defaultProps} />);

    // formatTimeDisplay가 workLog 시간으로 호출되었는지 확인
    expect(defaultProps.formatTimeDisplay).toHaveBeenCalledWith('10:00-19:00');
  });
});