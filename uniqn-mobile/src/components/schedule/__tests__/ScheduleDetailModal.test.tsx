import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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

const mockShowConfirm = jest.fn();

jest.mock('@/stores/modalStore', () => ({
  useModal: () => ({ showConfirm: mockShowConfirm }),
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

  describe('지원 취소 / 취소 요청 — 시트 닫고 지연 확인 (iOS 중첩 Modal 회피, fake timers)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('지원 취소: 즉시 시트를 닫고 300ms 후 확인 다이얼로그, 확인 시 캡처된 applicationId 로 콜백한다', () => {
      const onClose = jest.fn();
      const onCancelApplication = jest.fn();
      const schedule = createMockScheduleEvent({
        type: 'applied',
        applicationId: 'app-cancel-1',
      }) as unknown as ScheduleEvent;

      const { getByText } = render(
        <ScheduleDetailModal
          schedule={schedule}
          visible={true}
          onClose={onClose}
          onCancelApplication={onCancelApplication}
        />
      );

      fireEvent.press(getByText('지원 취소'));

      // 시트는 즉시 닫히고, 확인 다이얼로그는 아직 뜨지 않는다
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockShowConfirm).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockShowConfirm).toHaveBeenCalledTimes(1);
      // 확인 콜백 실행 시 시트가 닫혔어도 캡처된 applicationId 로 콜백된다
      const confirmCallback = mockShowConfirm.mock.calls[0][2] as () => void;
      confirmCallback();
      expect(onCancelApplication).toHaveBeenCalledWith('app-cancel-1');
    });

    it('취소 요청: 동일 패턴 — 즉시 닫고 지연 확인 후 캡처된 applicationId 로 콜백한다', () => {
      const onClose = jest.fn();
      const onRequestCancellation = jest.fn();
      const schedule = createMockScheduleEvent({
        type: 'confirmed',
        applicationId: 'app-req-1',
      }) as unknown as ScheduleEvent;

      const { getByText } = render(
        <ScheduleDetailModal
          schedule={schedule}
          visible={true}
          onClose={onClose}
          onRequestCancellation={onRequestCancellation}
        />
      );

      fireEvent.press(getByText('취소 요청'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockShowConfirm).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockShowConfirm).toHaveBeenCalledTimes(1);
      const confirmCallback = mockShowConfirm.mock.calls[0][2] as () => void;
      confirmCallback();
      expect(onRequestCancellation).toHaveBeenCalledWith('app-req-1');
    });

    it('300ms 창 안 더블탭: 확인 다이얼로그는 1회만 예약된다 (전역 ConfirmModal 중첩 방지)', () => {
      const onClose = jest.fn();
      const onCancelApplication = jest.fn();
      const schedule = createMockScheduleEvent({
        type: 'applied',
        applicationId: 'app-cancel-2',
      }) as unknown as ScheduleEvent;

      const { getByText } = render(
        <ScheduleDetailModal
          schedule={schedule}
          visible={true}
          onClose={onClose}
          onCancelApplication={onCancelApplication}
        />
      );

      const button = getByText('지원 취소');
      fireEvent.press(button);
      fireEvent.press(button);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // 재진입 가드: 두 번째 탭은 무시 — 닫기 1회·확인 다이얼로그 1회
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockShowConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
