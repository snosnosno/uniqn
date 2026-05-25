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
  ShareIcon: () => null,
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({
    shareJob: jest.fn(),
    shareJobById: jest.fn(),
    share: jest.fn(),
    isSharing: false,
  }),
}));

describe('JobPostingCard', () => {
  const basePosting: JobPosting = {
    id: 'posting-1',
    schemaVersion: 3,
    title: 'Test Posting',
    status: 'active',
    location: {
      name: 'Gimpo',
      district: 'Gimpo',
      detailedAddress: '123-45',
    },
    workDate: '2026-03-31',
    roleCatalog: [
      { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
      { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
    ],
    schedule: {
      kind: 'dated',
      primaryDate: '2026-03-31',
      allDates: ['2026-03-31'],
      requirements: [
        {
          date: '2026-03-31',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [{ role: 'dealer', count: 1, filled: 0 }],
            },
            {
              startTime: '13:00',
              roles: [
                { role: 'dealer', count: 1, filled: 0 },
                { role: 'floor', count: 1, filled: 0 },
              ],
            },
          ],
        },
      ],
    },
    compensation: {
      mode: 'by_role',
      defaultSalary: { type: 'hourly', amount: 20000 },
      taxSettings: {
        type: 'rate',
        value: 3.3,
      },
    },
    questions: {
      items: [],
    },
    totalPositions: 3,
    filledPositions: 0,
    ownerId: 'owner-1',
    ownerName: 'Owner',
    stats: {
      totalApplicants: 1,
      activeApplicants: 1,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
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
