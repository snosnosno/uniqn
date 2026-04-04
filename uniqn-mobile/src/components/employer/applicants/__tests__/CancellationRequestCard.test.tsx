import React from 'react';
import { render } from '@testing-library/react-native';
import { Timestamp } from 'firebase/firestore';
import { CancellationRequestCard } from '../CancellationRequestCard';
import { STATUS } from '@/constants';
import type { Application } from '@/types';

const mockUseUserProfile = jest.fn((_params?: unknown) => ({
  displayName: '김소호(스노)',
  profilePhotoURL: 'https://example.com/profile.jpg',
}));

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: (params: unknown) => mockUseUserProfile(params),
}));

jest.mock('../../../ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../../ui/Modal', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../../ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../../ui/Avatar', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Avatar: ({ name, source }: { name?: string; source?: string }) => (
      <Text>{`avatar:${name ?? ''}:${source ?? ''}`}</Text>
    ),
  };
});

jest.mock('../../../icons', () => ({
  ClockIcon: () => null,
  MessageIcon: () => null,
  CheckIcon: () => null,
  XMarkIcon: () => null,
  CalendarIcon: () => null,
}));

jest.mock('@/utils/date', () => ({
  formatAppliedDate: () => '2026-04-01',
  formatRelativeTime: () => '1시간 전',
}));

function createApplication(overrides?: Partial<Application>): Application {
  return {
    id: 'application-1',
    jobPostingId: 'job-1',
    applicantId: 'applicant-1',
    applicantName: '레거시 이름',
    applicantNickname: '레거시닉',
    applicantPhotoURL: 'https://example.com/legacy.jpg',
    status: STATUS.APPLICATION.CANCELLATION_PENDING,
    assignments: [
      {
        roleIds: ['dealer'],
        dates: ['2026-04-01'],
        timeSlot: '10:00~18:00',
      },
    ],
    cancellationRequest: {
      status: STATUS.CANCELLATION_REQUEST.PENDING,
      reason: '개인 사정',
      requestedAt: Timestamp.now(),
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  } as Application;
}

describe('CancellationRequestCard', () => {
  beforeEach(() => {
    mockUseUserProfile.mockClear();
  });

  it('uses the shared profile identity for applicant avatar and name', () => {
    const { getByText } = render(
      <CancellationRequestCard
        application={createApplication()}
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(mockUseUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'applicant-1',
        fallbackName: '레거시 이름',
        fallbackNickname: '레거시닉',
        fallbackPhotoURL: 'https://example.com/legacy.jpg',
      })
    );
    expect(getByText('김소호(스노)')).toBeTruthy();
    expect(getByText('avatar:김소호(스노):https://example.com/profile.jpg')).toBeTruthy();
  });
});
