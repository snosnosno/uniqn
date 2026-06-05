import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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
      requestedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
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

  it('유효한 사유로 거절을 제출하면 onReject 가 1회 호출된다', () => {
    const onReject = jest.fn();
    const { getByPlaceholderText, getByLabelText } = render(
      <CancellationRequestCard
        application={createApplication()}
        onApprove={jest.fn()}
        onReject={onReject}
        isProcessing={false}
      />
    );

    fireEvent.changeText(getByPlaceholderText('최소 3자 이상 입력해주세요'), '개인 사정으로 취소');
    fireEvent.press(getByLabelText('거절하기'));

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith('application-1', '개인 사정으로 취소');
  });

  it('처리 중(isProcessing)에는 거절 제출이 중복 호출되지 않는다 (EF-CAN-2 회귀)', () => {
    const onReject = jest.fn();
    const { getByPlaceholderText, getByLabelText } = render(
      <CancellationRequestCard
        application={createApplication()}
        onApprove={jest.fn()}
        onReject={onReject}
        isProcessing
      />
    );

    // 유효한 사유가 입력돼 있어도, 처리 중이면 제출 버튼이 비활성이라 호출되지 않아야 한다.
    fireEvent.changeText(getByPlaceholderText('최소 3자 이상 입력해주세요'), '개인 사정으로 취소');
    fireEvent.press(getByLabelText('거절하기'));

    expect(onReject).not.toHaveBeenCalled();
  });
});
