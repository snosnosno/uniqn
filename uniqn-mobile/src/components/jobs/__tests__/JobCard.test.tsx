/**
 * UNIQN Mobile - JobCard Component Tests
 *
 * @description 구인공고 카드 컴포넌트 테스트
 * @version 2.0.0 - dateRequirements 지원
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { JobCard } from '../JobCard';
import type { JobPostingCard } from '@/types';

// Mock Badge component
jest.mock('@/components/ui/Badge', () => ({
  Badge: ({
    children,
    variant,
  }: {
    children: React.ReactNode;
    variant?: string;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text testID={`badge-${variant || 'default'}`}>{children}</Text>;
  },
}));

// Mock PostingTypeBadge component
jest.mock('../PostingTypeBadge', () => ({
  PostingTypeBadge: ({
    type,
  }: {
    type: string;
    size?: string;
    className?: string;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text testID={`posting-type-${type}`}>{type}</Text>;
  },
}));

describe('JobCard', () => {
  const mockOnPress = jest.fn();

  const mockJob: JobPostingCard = {
    id: 'job-1',
    title: '테스트 공고',
    location: '서울 강남구',
    workDate: '2025-01-15',
    timeSlot: '18:00 - 02:00',
    roles: ['dealer', 'manager'],
    dateRequirements: [
      {
        date: '2025-01-15',
        timeSlots: [
          {
            startTime: '18:00',
            roles: [
              { role: 'dealer', count: 3, filled: 1 },
              { role: 'manager', count: 2, filled: 0 },
            ],
          },
        ],
      },
    ],
    salary: {
      type: 'daily',
      amount: 150000,
    },
    status: 'active',
    isUrgent: false,
    applicationCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render job title', () => {
    const { getByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    expect(getByText('테스트 공고')).toBeTruthy();
  });

  it('should render location', () => {
    const { getByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    expect(getByText(/서울 강남구/)).toBeTruthy();
  });

  it('should render date from dateRequirements', () => {
    const { getByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    // Date format: M/D(요일)
    // 2025-01-15 is Wednesday
    expect(getByText(/1\/15\(수\)/)).toBeTruthy();
  });

  it('should render start time from dateRequirements', () => {
    const { getByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    expect(getByText(/18:00/)).toBeTruthy();
  });

  it('should render salary correctly for daily type', () => {
    const { getByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    expect(getByText(/일급 150,000원/)).toBeTruthy();
  });

  it('should render salary correctly for hourly type', () => {
    const hourlyJob: JobPostingCard = {
      ...mockJob,
      salary: {
        type: 'hourly',
        amount: 15000,
      },
    };

    const { getByText } = render(
      <JobCard job={hourlyJob} onPress={mockOnPress} />
    );

    expect(getByText(/시급 15,000원/)).toBeTruthy();
  });

  it('should render salary correctly for monthly type', () => {
    const monthlyJob: JobPostingCard = {
      ...mockJob,
      salary: {
        type: 'monthly',
        amount: 3000000,
      },
    };

    const { getByText } = render(
      <JobCard job={monthlyJob} onPress={mockOnPress} />
    );

    expect(getByText(/월급 3,000,000원/)).toBeTruthy();
  });

  it('should render role with count and filled status', () => {
    const { getByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    // 딜러 3명 (1/3), 매니저 2명 (0/2) 형식으로 표시
    expect(getByText(/딜러/)).toBeTruthy();
    expect(getByText(/3명/)).toBeTruthy();
    expect(getByText(/1\/3/)).toBeTruthy();
    expect(getByText(/매니저/)).toBeTruthy();
    expect(getByText(/2명/)).toBeTruthy();
    expect(getByText(/0\/2/)).toBeTruthy();
  });

  it('should render urgent badge when isUrgent is true', () => {
    const urgentJob: JobPostingCard = {
      ...mockJob,
      isUrgent: true,
    };

    const { getByText } = render(
      <JobCard job={urgentJob} onPress={mockOnPress} />
    );

    expect(getByText('긴급')).toBeTruthy();
  });

  it('should not render urgent badge when isUrgent is false', () => {
    const { queryByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    expect(queryByText('긴급')).toBeNull();
  });

  it('should call onPress with job id when pressed', () => {
    const { getByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    const title = getByText('테스트 공고');
    fireEvent.press(title);

    expect(mockOnPress).toHaveBeenCalledWith('job-1');
  });

  it('should render multiple dates from dateRequirements', () => {
    const multiDateJob: JobPostingCard = {
      ...mockJob,
      dateRequirements: [
        {
          date: '2025-01-15',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer', count: 3, filled: 1 }],
            },
          ],
        },
        {
          date: '2025-01-16',
          timeSlots: [
            {
              startTime: '19:00',
              roles: [{ role: 'dealer', count: 2, filled: 0 }],
            },
          ],
        },
      ],
    };

    const { getByText } = render(
      <JobCard job={multiDateJob} onPress={mockOnPress} />
    );

    expect(getByText(/1\/15\(수\)/)).toBeTruthy();
    expect(getByText(/1\/16\(목\)/)).toBeTruthy();
  });

  it('should render allowances when provided', () => {
    const jobWithAllowances: JobPostingCard = {
      ...mockJob,
      allowances: {
        meal: 10000,
        transportation: 5000,
      },
    };

    const { getByText } = render(
      <JobCard job={jobWithAllowances} onPress={mockOnPress} />
    );

    expect(getByText(/식비: 10,000원/)).toBeTruthy();
    expect(getByText(/교통비: 5,000원/)).toBeTruthy();
  });

  it('should not render allowances when not provided', () => {
    const { queryByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    expect(queryByText(/식비/)).toBeNull();
    expect(queryByText(/교통비/)).toBeNull();
  });
});

describe('JobCard role labels', () => {
  const mockOnPress = jest.fn();

  const createJobWithRole = (role: string): JobPostingCard => ({
    id: 'job-1',
    title: '테스트 공고',
    location: '서울',
    workDate: '2025-01-15',
    timeSlot: '18:00 - 02:00',
    roles: [role],
    dateRequirements: [
      {
        date: '2025-01-15',
        timeSlots: [
          {
            startTime: '18:00',
            roles: [{ role, count: 1, filled: 0 }],
          },
        ],
      },
    ],
    salary: { type: 'daily', amount: 150000 },
    status: 'active',
    isUrgent: false,
  });

  it('should display "딜러" for dealer role', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('dealer')} onPress={mockOnPress} />
    );
    expect(getByText(/딜러/)).toBeTruthy();
  });

  it('should display "매니저" for manager role', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('manager')} onPress={mockOnPress} />
    );
    expect(getByText(/매니저/)).toBeTruthy();
  });

  it('should display "칩러너" for chiprunner role', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('chiprunner')} onPress={mockOnPress} />
    );
    expect(getByText(/칩러너/)).toBeTruthy();
  });

  it('should display "관리자" for admin role', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('admin')} onPress={mockOnPress} />
    );
    expect(getByText(/관리자/)).toBeTruthy();
  });

  it('should display role as-is for unknown roles', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('custom')} onPress={mockOnPress} />
    );
    expect(getByText(/custom/)).toBeTruthy();
  });
});

describe('JobCard accessibility', () => {
  const mockOnPress = jest.fn();

  const mockJob: JobPostingCard = {
    id: 'job-1',
    title: '테스트 공고',
    location: '서울 강남구',
    workDate: '2025-01-15',
    timeSlot: '18:00 - 02:00',
    roles: ['dealer'],
    dateRequirements: [
      {
        date: '2025-01-15',
        timeSlots: [
          {
            startTime: '18:00',
            roles: [{ role: 'dealer', count: 1, filled: 0 }],
          },
        ],
      },
    ],
    salary: { type: 'daily', amount: 150000 },
    status: 'active',
    isUrgent: false,
  };

  it('should be pressable', () => {
    const { getByText } = render(
      <JobCard job={mockJob} onPress={mockOnPress} />
    );

    const card = getByText('테스트 공고');
    fireEvent.press(card);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});
