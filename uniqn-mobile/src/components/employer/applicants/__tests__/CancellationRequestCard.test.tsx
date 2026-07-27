import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
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

// 실제 Modal 은 footer 를 스크롤 영역 밖 형제로 렌더한다 — mock 도 같은 계약을 지켜야
// 액션 버튼이 사라지지 않는다(2026-07-25 footer prop 전환 시 이 mock 이 먼저 깨졌다).
// ⚠️ visible 을 **존중해야** 한다 — 무시하면 '거절 실패 시 모달이 유지된다'(CANCEL-14)를
//    관측할 수 없다. 무조건 렌더하면 닫힌 모달도 열린 것처럼 보인다.
jest.mock('../../../ui/Modal', () => ({
  Modal: ({
    visible,
    children,
    footer,
  }: {
    visible?: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
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

  it('유효한 사유로 거절을 제출하면 onReject 가 1회 호출된다', async () => {
    const onReject = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      <CancellationRequestCard
        application={createApplication()}
        onApprove={jest.fn()}
        onReject={onReject}
        isProcessing={false}
      />
    );

    fireEvent.press(getByText('거절'));
    fireEvent.changeText(getByPlaceholderText('최소 3자 이상 입력해주세요'), '개인 사정으로 취소');
    await act(async () => {
      fireEvent.press(getByLabelText('거절하기'));
    });

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith('application-1', '개인 사정으로 취소');
  });

  it('처리 중(isProcessing)에는 거절 제출이 중복 호출되지 않는다 (EF-CAN-2 회귀)', async () => {
    const onReject = jest.fn().mockResolvedValue(undefined);
    // 모달을 먼저 연 뒤 처리 중으로 전환한다 — 처리 중에는 여는 버튼 자체가 비활성이라
    // 이 순서가 아니면 입력에 도달할 수 없다(Modal mock 이 visible 을 존중하게 되면서 드러남).
    const { getByPlaceholderText, getByLabelText, getByText, rerender } = render(
      <CancellationRequestCard
        application={createApplication()}
        onApprove={jest.fn()}
        onReject={onReject}
        isProcessing={false}
      />
    );

    fireEvent.press(getByText('거절'));
    fireEvent.changeText(getByPlaceholderText('최소 3자 이상 입력해주세요'), '개인 사정으로 취소');

    rerender(
      <CancellationRequestCard
        application={createApplication()}
        onApprove={jest.fn()}
        onReject={onReject}
        isProcessing
      />
    );

    await act(async () => {
      fireEvent.press(getByLabelText('거절하기'));
    });

    expect(onReject).not.toHaveBeenCalled();
  });

  // W1-11 / CANCEL-14: 옛 코드는 결과를 보지 않고 동기적으로 닫아, 실패하면 사용자가 입력한
  // 200자 사유가 통째로 사라지고 에러 토스트만 남았다.
  it('거절이 실패하면 모달과 입력한 사유가 그대로 남는다', async () => {
    const onReject = jest.fn().mockRejectedValue(new Error('네트워크 오류'));
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      <CancellationRequestCard
        application={createApplication()}
        onApprove={jest.fn()}
        onReject={onReject}
        isProcessing={false}
      />
    );

    fireEvent.press(getByText('거절'));
    fireEvent.changeText(getByPlaceholderText('최소 3자 이상 입력해주세요'), '개인 사정으로 취소');
    await act(async () => {
      fireEvent.press(getByLabelText('거절하기'));
    });

    expect(getByPlaceholderText('최소 3자 이상 입력해주세요').props.value).toBe(
      '개인 사정으로 취소'
    );
  });

  it('거절이 성공하면 모달이 닫히고 입력이 비워진다', async () => {
    const onReject = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByLabelText, getByText, queryByPlaceholderText } = render(
      <CancellationRequestCard
        application={createApplication()}
        onApprove={jest.fn()}
        onReject={onReject}
        isProcessing={false}
      />
    );

    fireEvent.press(getByText('거절'));
    fireEvent.changeText(getByPlaceholderText('최소 3자 이상 입력해주세요'), '개인 사정으로 취소');
    await act(async () => {
      fireEvent.press(getByLabelText('거절하기'));
    });

    expect(queryByPlaceholderText('최소 3자 이상 입력해주세요')).toBeNull();
  });
});
