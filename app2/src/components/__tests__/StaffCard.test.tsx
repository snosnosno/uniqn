import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import StaffCard from '../StaffCard';
import { StaffData } from '../../hooks/useStaffManagement';

// Mock hooks
jest.mock('../../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    lightImpact: jest.fn(),
    mediumImpact: jest.fn(),
    selectionFeedback: jest.fn(),
    isSupported: true
  })
}));

jest.mock('../../hooks/useSwipeGesture', () => ({
  useSwipeGestureReact: () => ({
    onTouchStart: jest.fn(),
    onTouchMove: jest.fn(),
    onTouchEnd: jest.fn()
  })
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Mock utility functions
jest.mock('../../utils/attendanceExceptionUtils', () => ({
  getExceptionIcon: jest.fn(() => '⚠️'),
  getExceptionSeverity: jest.fn(() => 'medium')
}));

describe('StaffCard', () => {
  const mockStaff: StaffData = {
    id: 'staff-1',
    userId: 'user-1',
    name: '홍길동',
    email: 'hong@example.com',
    phone: '010-1234-5678',
    role: 'Dealer',
    assignedRole: '메인 딜러',
    assignedTime: '09:00-18:00',
    assignedDate: '2024-07-25',
    postingId: 'posting-1',
    postingTitle: '테스트 공고'
  };

  const mockProps = {
    staff: mockStaff,
    onEditWorkTime: jest.fn(),
    onExceptionEdit: jest.fn(),
    onDeleteStaff: jest.fn(),
    getStaffAttendanceStatus: jest.fn(() => ({
      status: 'present',
      checkInTime: '09:00',
      checkOutTime: null
    })),
    attendanceRecords: [],
    formatTimeDisplay: jest.fn((time) => time || '시간 미정'),
    getTimeSlotColor: jest.fn(() => 'bg-blue-100 text-blue-800'),
    showDate: true,
    isSelected: false,
    onSelect: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders staff card with basic information', () => {
    render(<StaffCard {...mockProps} />);
    
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('메인 딜러')).toBeInTheDocument();
    expect(screen.getByText('📅 2024-07-25')).toBeInTheDocument();
  });

  test('expands card when clicked', () => {
    render(<StaffCard {...mockProps} />);
    
    const card = screen.getByText('홍길동').closest('div')?.parentElement?.parentElement;
    if (card) {
      fireEvent.click(card);
    }
    
    expect(screen.getByText('연락처 정보')).toBeInTheDocument();
    expect(screen.getByText('010-1234-5678')).toBeInTheDocument();
    expect(screen.getByText('hong@example.com')).toBeInTheDocument();
  });

  test('shows selection checkbox when onSelect is provided', () => {
    render(<StaffCard {...mockProps} />);
    
    const checkbox = screen.getByRole('checkbox', { hidden: true });
    expect(checkbox).toBeInTheDocument();
  });

  test('calls onSelect when selection checkbox is clicked', () => {
    render(<StaffCard {...mockProps} />);
    
    const checkboxContainer = screen.getByRole('checkbox', { hidden: true }).parentElement;
    if (checkboxContainer) {
      fireEvent.click(checkboxContainer);
    }
    
    expect(mockProps.onSelect).toHaveBeenCalledWith('staff-1');
  });

  test('shows swipe indicator when in selection mode', () => {
    render(<StaffCard {...mockProps} />);
    
    expect(screen.getByText('← 액션 • 선택 →')).toBeInTheDocument();
  });

  test('shows action buttons when actions menu is toggled', () => {
    render(<StaffCard {...mockProps} />);
    
    const actionButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(actionButton);
    
    expect(screen.getByText('시간 수정')).toBeInTheDocument();
    expect(screen.getByText('예외 처리')).toBeInTheDocument();
    expect(screen.getByText('삭제')).toBeInTheDocument();
  });

  test('calls appropriate handlers when action buttons are clicked', () => {
    render(<StaffCard {...mockProps} />);
    
    const actionButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(actionButton);
    
    fireEvent.click(screen.getByText('시간 수정'));
    expect(mockProps.onEditWorkTime).toHaveBeenCalledWith('staff-1');
    
    fireEvent.click(screen.getByText('예외 처리'));
    expect(mockProps.onExceptionEdit).toHaveBeenCalledWith('staff-1');
    
    fireEvent.click(screen.getByText('삭제'));
    expect(mockProps.onDeleteStaff).toHaveBeenCalledWith('staff-1');
  });

  test('displays attendance status correctly', () => {
    render(<StaffCard {...mockProps} />);
    
    // AttendanceStatusCard가 렌더링되는지 확인
    // 실제 구현에서는 AttendanceStatusCard 컴포넌트를 모킹해야 할 수 있음
    expect(mockProps.getStaffAttendanceStatus).toHaveBeenCalledWith('staff-1');
  });

  test('shows contact links in expanded view', () => {
    render(<StaffCard {...mockProps} />);
    
    // 카드 확장
    const card = screen.getByText('홍길동').closest('div')?.parentElement?.parentElement;
    if (card) {
      fireEvent.click(card);
    }
    
    const phoneLink = screen.getByRole('link', { name: '통화' });
    const emailLink = screen.getByRole('link', { name: '메일' });
    
    expect(phoneLink).toHaveAttribute('href', 'tel:010-1234-5678');
    expect(emailLink).toHaveAttribute('href', 'mailto:hong@example.com');
  });

  test('handles staff without contact information', () => {
    const staffWithoutContact = {
      ...mockStaff,
      phone: undefined,
      email: undefined
    };

    render(<StaffCard {...mockProps} staff={staffWithoutContact} />);
    
    // 카드 확장
    const card = screen.getByText('홍길동').closest('div')?.parentElement?.parentElement;
    if (card) {
      fireEvent.click(card);
    }
    
    expect(screen.getByText('연락처 정보가 없습니다')).toBeInTheDocument();
  });

  test('applies selected styling when isSelected is true', () => {
    render(<StaffCard {...mockProps} isSelected={true} />);
    
    const card = screen.getByText('홍길동').closest('div')?.parentElement?.parentElement;
    expect(card).toHaveClass('border-blue-500', 'bg-blue-50');
  });

  test('does not show swipe indicator when onSelect is not provided', () => {
    render(<StaffCard {...mockProps} onSelect={undefined} />);
    
    expect(screen.queryByText('← 액션 • 선택 →')).not.toBeInTheDocument();
  });
});