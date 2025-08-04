import React from 'react';
import { render, screen } from '@testing-library/react';
import AttendanceStatusCard from '../AttendanceStatusCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
    i18n: {
      changeLanguage: jest.fn(),
    },
  }),
}));

// Mock the icons
jest.mock('../Icons', () => ({
  ClockIcon: ({ className }: { className?: string }) => (
    <span data-testid="clock-icon" className={className}>Clock</span>
  ),
  CheckCircleIcon: ({ className }: { className?: string }) => (
    <span data-testid="check-circle-icon" className={className}>Check</span>
  ),
  ExclamationTriangleIcon: ({ className }: { className?: string }) => (
    <span data-testid="exclamation-icon" className={className}>Warning</span>
  ),
}));

describe('AttendanceStatusCard Component', () => {
  test('renders not_started status correctly', () => {
    render(<AttendanceStatusCard status="not_started" />);

    expect(screen.getByText('출근 전')).toBeInTheDocument();
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    expect(screen.getByTestId('clock-icon')).toHaveClass('text-gray-500');
    
    // Get the root container
    const container = screen.getByTestId('clock-icon').closest('div');
    expect(container?.className).toContain('bg-gray-100');
    expect(container?.className).toContain('text-gray-700');
    expect(container?.className).toContain('border-gray-300');
  });

  test('renders checked_in status correctly', () => {
    render(<AttendanceStatusCard status="checked_in" checkInTime="09:00" />);

    expect(screen.getByText('출근')).toBeInTheDocument();
    expect(screen.getByText(/출근: 09:00/)).toBeInTheDocument();
    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    expect(screen.getByTestId('check-circle-icon')).toHaveClass('text-green-500');
    
    const container = screen.getByTestId('check-circle-icon').closest('div');
    expect(container?.className).toContain('bg-green-100');
    expect(container?.className).toContain('text-green-700');
    expect(container?.className).toContain('border-green-300');
  });

  test('renders checked_out status correctly', () => {
    render(
      <AttendanceStatusCard 
        status="checked_out" 
        checkInTime="09:00" 
        checkOutTime="18:00" 
      />
    );

    expect(screen.getByText('퇴근')).toBeInTheDocument();
    expect(screen.getByText(/출근: 09:00/)).toBeInTheDocument();
    expect(screen.getByText(/퇴근: 18:00/)).toBeInTheDocument();
    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
    expect(screen.getByTestId('check-circle-icon')).toHaveClass('text-blue-500');
    
    const container = screen.getByTestId('check-circle-icon').closest('div');
    expect(container?.className).toContain('bg-blue-100');
    expect(container?.className).toContain('text-blue-700');
    expect(container?.className).toContain('border-blue-300');
  });

  test('renders with small size', () => {
    render(<AttendanceStatusCard status="not_started" size="sm" />);
    
    const container = screen.getByTestId('clock-icon').closest('div');
    expect(container?.className).toContain('px-2');
    expect(container?.className).toContain('py-1');
    expect(container?.className).toContain('text-xs');
  });

  test('renders with medium size (default)', () => {
    render(<AttendanceStatusCard status="not_started" />);
    
    const container = screen.getByTestId('clock-icon').closest('div');
    expect(container?.className).toContain('px-3');
    expect(container?.className).toContain('py-2');
    expect(container?.className).toContain('text-sm');
  });

  test('renders with large size', () => {
    render(<AttendanceStatusCard status="not_started" size="lg" />);
    
    const container = screen.getByTestId('clock-icon').closest('div');
    expect(container?.className).toContain('px-4');
    expect(container?.className).toContain('py-3');
    expect(container?.className).toContain('text-base');
  });

  test('applies custom className', () => {
    render(
      <AttendanceStatusCard 
        status="not_started" 
        className="custom-class" 
      />
    );
    
    const container = screen.getByTestId('clock-icon').closest('div');
    expect(container?.className).toContain('custom-class');
  });

  test('handles checked_in without checkInTime', () => {
    render(<AttendanceStatusCard status="checked_in" />);

    expect(screen.getByText('출근')).toBeInTheDocument();
    expect(screen.queryByText('09:00')).not.toBeInTheDocument();
  });

  test('handles checked_out with only checkOutTime', () => {
    render(
      <AttendanceStatusCard 
        status="checked_out" 
        checkOutTime="18:00" 
      />
    );

    expect(screen.getByText('퇴근')).toBeInTheDocument();
    expect(screen.getByText(/퇴근: 18:00/)).toBeInTheDocument();
    // Should not show checkIn time
    expect(screen.queryByText(/출근:/)).not.toBeInTheDocument();
  });

  test('does not show times for small size', () => {
    render(
      <AttendanceStatusCard 
        status="checked_in" 
        checkInTime="09:00"
        size="sm"
      />
    );

    expect(screen.getByText('출근')).toBeInTheDocument();
    // Should not show time details in small size
    expect(screen.queryByText(/출근: 09:00/)).not.toBeInTheDocument();
  });
});