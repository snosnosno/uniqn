import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JobCard from '../JobCard';
import { JobPosting, TimeSlot } from '../../../../types/jobPosting';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: jest.fn(),
    },
  }),
}));

// Mock the date utils
jest.mock('../../../../utils/jobPosting/dateUtils', () => ({
  formatDate: (date: Date) => date.toLocaleDateString('ko-KR'),
}));

jest.mock('../../../../utils/jobPosting/jobPostingHelpers', () => ({
  formatSalaryDisplay: (salary: number) => `₩${salary.toLocaleString()}`,
  getBenefitDisplayGroups: () => ({
    financial: [],
    work: [],
    other: [],
  }),
}));

describe('JobCard Component', () => {
  const mockPost: JobPosting = {
    id: '1',
    title: '주말 토너먼트 딜러 모집',
    description: '경험 많은 딜러를 모집합니다',
    startDate: new Date('2024-01-20'),
    endDate: new Date('2024-01-21'),
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
    updatedBy: 'admin',
    location: '강남점',
    eventType: 'tournament',
    timeSlots: [
      {
        time: '18:00 - 02:00',
        roles: [
          {
            name: 'dealer',
            count: 10,
          },
        ],
        isTimeToBeAnnounced: false,
      } as TimeSlot,
    ],
    roleRequirements: [
      {
        role: 'dealer',
        count: 10,
      },
    ],
    salary: 150000,
    benefits: {
      transportation: true,
      meals: true,
      parking: false,
      accommodation: false,
      bonus: false,
      overtimePay: false,
      nightShiftAllowance: false,
      weekendAllowance: false,
      holidayAllowance: false,
      other: '',
    },
    additionalRequirements: '경력 1년 이상',
    confirmedStaff: [],
    workDates: ['2024-01-20', '2024-01-21'],
    dateSpecificRequirements: [],
    differentDailyRequirements: false,
    showDateRange: true,
  };

  const defaultProps = {
    post: mockPost,
    appliedStatus: undefined,
    onApply: jest.fn(),
    onViewDetail: jest.fn(),
    isProcessing: false,
    canApply: true,
  };

  test('renders job card with basic information', () => {
    render(<JobCard {...defaultProps} />);

    expect(screen.getByText('주말 토너먼트 딜러 모집')).toBeInTheDocument();
    expect(screen.getByText('강남점')).toBeInTheDocument();
    expect(screen.getByText(/2024.*1.*20/)).toBeInTheDocument();
    expect(screen.getByText(/2024.*1.*21/)).toBeInTheDocument();
    expect(screen.getByText('18:00 - 02:00')).toBeInTheDocument();
    expect(screen.getByText('₩150,000')).toBeInTheDocument();
  });

  test('shows recruitment type badge', () => {
    render(<JobCard {...defaultProps} />);
    expect(screen.getByText('지원')).toBeInTheDocument();
  });

  test('shows applied status when user has applied', () => {
    render(<JobCard {...defaultProps} appliedStatus="pending" />);
    expect(screen.getByText('jobBoard.applicationStatus.pending')).toBeInTheDocument();
  });

  test('apply button is disabled when already applied', () => {
    render(<JobCard {...defaultProps} appliedStatus="pending" />);
    const applyButton = screen.getByRole('button', { name: 'jobBoard.alreadyApplied' });
    expect(applyButton).toBeDisabled();
  });

  test('apply button is disabled when processing', () => {
    render(<JobCard {...defaultProps} isProcessing={true} />);
    const applyButton = screen.getByRole('button', { name: 'jobBoard.processing' });
    expect(applyButton).toBeDisabled();
  });

  test('apply button is disabled when cannot apply', () => {
    render(<JobCard {...defaultProps} canApply={false} />);
    const applyButton = screen.getByRole('button', { name: 'jobBoard.apply' });
    expect(applyButton).toBeDisabled();
  });

  test('calls onApply when apply button is clicked', () => {
    const onApply = jest.fn();
    render(<JobCard {...defaultProps} onApply={onApply} />);
    
    const applyButton = screen.getByRole('button', { name: 'jobBoard.apply' });
    fireEvent.click(applyButton);
    
    expect(onApply).toHaveBeenCalledWith(mockPost);
  });

  test('calls onViewDetail when view detail link is clicked', () => {
    const onViewDetail = jest.fn();
    render(<JobCard {...defaultProps} onViewDetail={onViewDetail} />);
    
    const detailLink = screen.getByText('jobBoard.viewDetail');
    fireEvent.click(detailLink);
    
    expect(onViewDetail).toHaveBeenCalledWith(mockPost);
  });

  test('shows multiple time slots', () => {
    const postWithMultipleSlots = {
      ...mockPost,
      timeSlots: [
        {
          time: '10:00 - 18:00',
          roles: [{ name: 'dealer', count: 5 }],
          isTimeToBeAnnounced: false,
        } as TimeSlot,
        {
          time: '18:00 - 02:00',
          roles: [{ name: 'dealer', count: 5 }],
          isTimeToBeAnnounced: false,
        } as TimeSlot,
      ],
    };
    
    render(<JobCard {...defaultProps} post={postWithMultipleSlots} />);
    
    expect(screen.getByText('10:00 - 18:00')).toBeInTheDocument();
    expect(screen.getByText('18:00 - 02:00')).toBeInTheDocument();
  });

  test('shows role requirements', () => {
    const postWithMultipleRoles = {
      ...mockPost,
      timeSlots: [
        {
          time: '18:00 - 02:00',
          roles: [
            { name: 'dealer', count: 10 },
            { name: 'manager', count: 2 },
          ],
          isTimeToBeAnnounced: false,
        } as TimeSlot,
      ],
    };
    
    render(<JobCard {...defaultProps} post={postWithMultipleRoles} />);
    
    expect(screen.getByText(/jobPostingAdmin.create.dealer/)).toBeInTheDocument();
    expect(screen.getByText(/10명/)).toBeInTheDocument();
    expect(screen.getByText(/jobPostingAdmin.create.manager/)).toBeInTheDocument();
    expect(screen.getByText(/2명/)).toBeInTheDocument();
  });

  test('handles Firebase timestamp format', () => {
    const postWithTimestamp = {
      ...mockPost,
      startDate: { toDate: () => new Date('2024-01-20') },
      endDate: { toDate: () => new Date('2024-01-21') },
    };
    
    render(<JobCard {...defaultProps} post={postWithTimestamp} />);
    
    expect(screen.getByText(/2024.*1.*20/)).toBeInTheDocument();
    expect(screen.getByText(/2024.*1.*21/)).toBeInTheDocument();
  });

  test('handles seconds timestamp format', () => {
    const postWithSeconds = {
      ...mockPost,
      startDate: { seconds: new Date('2024-01-20').getTime() / 1000 },
      endDate: { seconds: new Date('2024-01-21').getTime() / 1000 },
    };
    
    render(<JobCard {...defaultProps} post={postWithSeconds} />);
    
    expect(screen.getByText(/2024.*1.*20/)).toBeInTheDocument();
    expect(screen.getByText(/2024.*1.*21/)).toBeInTheDocument();
  });

  test('shows 미정 for missing dates', () => {
    const postWithoutDates = {
      ...mockPost,
      startDate: null,
      endDate: null,
    };
    
    render(<JobCard {...defaultProps} post={postWithoutDates} />);
    
    expect(screen.getAllByText('미정')).toHaveLength(2);
  });

  test('shows fixed recruitment type', () => {
    const fixedPost = {
      ...mockPost,
      recruitmentType: 'fixed' as const,
    };
    
    render(<JobCard {...defaultProps} post={fixedPost} />);
    
    expect(screen.getByText('고정')).toBeInTheDocument();
  });
});