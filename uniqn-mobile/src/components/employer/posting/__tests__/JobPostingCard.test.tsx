import React from 'react';
import { render } from '@testing-library/react-native';
import { JobPostingCard } from '../JobPostingCard';
import type { JobPosting } from '@/types';

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/jobs/PostingTypeBadge', () => ({
  PostingTypeBadge: () => null,
}));

jest.mock('@/components/jobs/TournamentStatusBadge', () => ({
  TournamentStatusBadge: () => null,
}));

jest.mock('@/components/jobs/FixedScheduleDisplay', () => ({
  FixedScheduleDisplay: () => null,
}));

jest.mock('@/components/icons', () => ({
  UsersIcon: () => null,
  QrCodeIcon: () => null,
}));

describe('JobPostingCard', () => {
  const basePosting: JobPosting = {
    id: 'posting-1',
    title: 'Test Posting',
    status: 'active',
    location: {
      name: 'Gimpo',
      district: 'Gimpo',
    },
    workDate: '2026-03-31',
    timeSlot: '',
    dateSpecificRequirements: [
      {
        date: '2026-03-31',
        timeSlots: [
          {
            startTime: '09:00',
            roles: [{ role: 'dealer', headcount: 1, filled: 0 }],
          },
          {
            startTime: '13:00',
            roles: [
              { role: 'dealer', headcount: 1, filled: 0 },
              { role: 'floor', headcount: 1, filled: 0 },
            ],
          },
        ],
      },
    ],
    roles: [
      { role: 'dealer', count: 2, filled: 0, salary: { type: 'hourly', amount: 20000 } },
      { role: 'floor', count: 1, filled: 0, salary: { type: 'hourly', amount: 30000 } },
    ],
    totalPositions: 3,
    filledPositions: 0,
    ownerId: 'owner-1',
    ownerName: 'Owner',
    applicationCount: 1,
    useSameSalary: false,
    taxSettings: {
      type: 'rate',
      value: 3.3,
    },
    createdAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date('2026-03-01') } as never,
    updatedAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date('2026-03-01') } as never,
  };

  it('renders every time slot in the employer card schedule summary', () => {
    const { getByText } = render(
      <JobPostingCard
        posting={basePosting}
        onPress={jest.fn()}
        onClose={jest.fn()}
        onReopen={jest.fn()}
        onShowQR={jest.fn()}
        isClosing={false}
        isReopening={false}
      />
    );

    expect(getByText(/09:00/)).toBeTruthy();
    expect(getByText(/13:00/)).toBeTruthy();
  });

  it('renders tax settings like the public card', () => {
    const { getByText } = render(
      <JobPostingCard
        posting={basePosting}
        onPress={jest.fn()}
        onClose={jest.fn()}
        onReopen={jest.fn()}
        onShowQR={jest.fn()}
        isClosing={false}
        isReopening={false}
      />
    );

    expect(getByText(/3.3%/)).toBeTruthy();
  });
});
