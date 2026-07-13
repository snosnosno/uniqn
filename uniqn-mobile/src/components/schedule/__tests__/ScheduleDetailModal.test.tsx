import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScheduleDetailModal } from '../ScheduleDetailModal';
import { createMockScheduleEvent } from '@/__tests__/mocks/factories';
import type { ScheduleEvent } from '@/types';

const mockGetUserProfile = jest.fn();

jest.mock('@/components/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Modal: ({ visible, children }: any) => (visible ? <View>{children}</View> : null),
    Badge: ({ children }: any) => <Text>{children}</Text>,
    Button: ({ children, onPress }: any) => <Pressable onPress={onPress}>{children}</Pressable>,
  };
});

jest.mock('@/components/icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const MockIcon = () => <View />;

  return {
    XMarkIcon: MockIcon,
    DocumentIcon: MockIcon,
    ClockIcon: MockIcon,
    BanknotesIcon: MockIcon,
    AlertTriangleIcon: MockIcon,
    ChevronLeftIcon: MockIcon,
    ChevronRightIcon: MockIcon,
    CalendarIcon: MockIcon,
  };
});

jest.mock('../tabs', () => ({
  InfoTab: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>info-tab</Text>;
  },
  WorkTab: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>work-tab</Text>;
  },
  SettlementTab: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>settlement-tab</Text>;
  },
}));

jest.mock('@/components/employer/ReportModal', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    ReportModal: ({ visible, target }: { visible: boolean; target?: { name?: string } | null }) =>
      visible ? <Text>{target?.name ?? 'report-modal'}</Text> : null,
  };
});

jest.mock('@/services/auth', () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
}));

jest.mock('@/services/admin', () => ({
  createReport: jest.fn(),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
}));

jest.mock('@/stores/modalStore', () => ({
  useModal: () => ({ showConfirm: jest.fn() }),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('ScheduleDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides the duplicate cancellation request action while review is pending', () => {
    const schedule = createMockScheduleEvent({
      type: 'confirmed',
      applicationId: 'app-1',
      isCancellationPending: true,
    }) as unknown as ScheduleEvent;

    const { queryByText, getByText } = render(
      <ScheduleDetailModal
        schedule={schedule}
        visible={true}
        onClose={jest.fn()}
        onRequestCancellation={jest.fn()}
      />
    );

    expect(getByText('info-tab')).toBeTruthy();
    expect(queryByText('취소 요청')).toBeNull();
  });

  it('shows the cancellation request action again after rejection clears the pending flag', () => {
    const schedule = createMockScheduleEvent({
      type: 'confirmed',
      applicationId: 'app-1',
    }) as unknown as ScheduleEvent;

    const { getByText } = render(
      <ScheduleDetailModal
        schedule={schedule}
        visible={true}
        onClose={jest.fn()}
        onRequestCancellation={jest.fn()}
      />
    );

    expect(getByText('info-tab')).toBeTruthy();
    expect(getByText('취소 요청')).toBeTruthy();
  });

  it('신고 버튼: 시트를 먼저 닫고 300ms 후 onReport 를 대상 정보와 함께 호출한다', async () => {
    // ReportModal 은 상위(schedule.tsx)로 승격됐다 — 시트는 닫히고 신고 요청만 위로 전달한다.
    // (iOS 중첩 Modal 터치 먹통 방지: 시트 children 이면 시트가 닫힐 때 신고 모달도 언마운트된다)
    const onClose = jest.fn();
    const onReport = jest.fn();

    const schedule = {
      ...createMockScheduleEvent(),
      ownerId: 'owner-1',
      jobPostingId: 'jp-1',
      jobPostingName: '홀덤펍 딜러',
      postingProjection: {
        ownerName: '기본 구인자',
        settlement: {
          roles: [],
        },
      },
    } as unknown as ScheduleEvent;

    const { getByText } = render(
      <ScheduleDetailModal
        schedule={schedule}
        visible={true}
        onClose={onClose}
        onReport={onReport}
      />
    );

    fireEvent.press(getByText('신고'));

    // 시트를 즉시 닫는다
    expect(onClose).toHaveBeenCalledTimes(1);

    // dismiss 애니메이션(300ms) 후 상위로 신고 요청(대상 스냅샷) 전달
    await waitFor(() => {
      expect(onReport).toHaveBeenCalledWith({
        ownerId: 'owner-1',
        ownerName: '기본 구인자',
        jobPostingId: 'jp-1',
        jobPostingTitle: '홀덤펍 딜러',
      });
    });
  });
});
