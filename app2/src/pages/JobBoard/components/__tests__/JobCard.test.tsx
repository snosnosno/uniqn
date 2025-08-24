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
    // startDate/endDate는 더 이상 사용하지 않음 - dateSpecificRequirements로 관리
    status: 'open',
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date(), toMillis: () => Date.now(), isEqual: () => false, toJSON: () => '' } as any,
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date(), toMillis: () => Date.now(), isEqual: () => false, toJSON: () => '' } as any,
    createdBy: 'admin',
    location: '강남점',
    type: 'application',
    salaryType: 'daily',
    salaryAmount: '150000',
    benefits: {
      transportation: '교통비 지원',
      meal: '식사 제공',
    },
    confirmedStaff: [],
    dateSpecificRequirements: [
      {
        date: '2024-01-20',
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
      },
      {
        date: '2024-01-21',
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
      },
    ],
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
      dateSpecificRequirements: [
        {
          date: '2024-01-20',
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
        },
      ],
    };
    
    render(<JobCard {...defaultProps} post={postWithMultipleSlots} />);
    
    expect(screen.getByText('10:00 - 18:00')).toBeInTheDocument();
    expect(screen.getByText('18:00 - 02:00')).toBeInTheDocument();
  });

  test('shows role requirements', () => {
    const postWithMultipleRoles = {
      ...mockPost,
      dateSpecificRequirements: [
        {
          date: '2024-01-20',
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
        },
      ],
    };
    
    render(<JobCard {...defaultProps} post={postWithMultipleRoles} />);
    
    expect(screen.getByText(/jobPostingAdmin.create.dealer/)).toBeInTheDocument();
    expect(screen.getByText(/10명/)).toBeInTheDocument();
    expect(screen.getByText(/jobPostingAdmin.create.manager/)).toBeInTheDocument();
    expect(screen.getByText(/2명/)).toBeInTheDocument();
  });

  test('shows date range for consecutive dates', () => {
    const postWithConsecutiveDates = {
      ...mockPost,
      dateSpecificRequirements: [
        {
          date: '2024-01-20',
          timeSlots: [
            {
              time: '18:00 - 02:00',
              roles: [{ name: 'dealer', count: 10 }],
              isTimeToBeAnnounced: false,
            } as TimeSlot,
          ],
        },
        {
          date: '2024-01-21',
          timeSlots: [
            {
              time: '18:00 - 02:00',
              roles: [{ name: 'dealer', count: 10 }],
              isTimeToBeAnnounced: false,
            } as TimeSlot,
          ],
        },
        {
          date: '2024-01-22',
          timeSlots: [
            {
              time: '18:00 - 02:00',
              roles: [{ name: 'dealer', count: 10 }],
              isTimeToBeAnnounced: false,
            } as TimeSlot,
          ],
        },
      ],
    };
    
    render(<JobCard {...defaultProps} post={postWithConsecutiveDates} />);
    
    // 연속된 날짜는 범위로 표시되어야 함
    expect(screen.getByText(/2024.*1.*20.*~.*2024.*1.*22/)).toBeInTheDocument();
  });

  test('shows individual dates for non-consecutive dates', () => {
    const postWithNonConsecutiveDates = {
      ...mockPost,
      dateSpecificRequirements: [
        {
          date: '2024-01-20',
          timeSlots: [
            {
              time: '18:00 - 02:00',
              roles: [{ name: 'dealer', count: 10 }],
              isTimeToBeAnnounced: false,
            } as TimeSlot,
          ],
        },
        {
          date: '2024-01-25',
          timeSlots: [
            {
              time: '18:00 - 02:00',
              roles: [{ name: 'dealer', count: 10 }],
              isTimeToBeAnnounced: false,
            } as TimeSlot,
          ],
        },
      ],
    };
    
    render(<JobCard {...defaultProps} post={postWithNonConsecutiveDates} />);
    
    // 비연속 날짜는 개별적으로 표시되어야 함
    expect(screen.getByText(/2024.*1.*20/)).toBeInTheDocument();
    expect(screen.getByText(/2024.*1.*25/)).toBeInTheDocument();
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