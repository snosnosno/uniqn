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

  describe('지원 취소 / 취소 요청 — 시트 안 인라인 2단 확인 (fake timers)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // 예전에는 버튼을 누르는 즉시 시트를 닫고 300ms 뒤 전역 다이얼로그를 띄웠다.
    // '아니오'를 눌러도 돌아갈 상세가 이미 사라져 목록에 덩그러니 남는 게 이 랭크의 결함이다.
    it('지원 취소: 버튼을 눌러도 시트를 닫지 않고 그 자리에서 묻는다', () => {
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

      expect(onClose).not.toHaveBeenCalled();
      expect(getByText('아니오')).toBeTruthy();
      expect(getByText('지원 취소하기')).toBeTruthy();
    });

    it("'아니오'는 상세를 그대로 두고 확인 패널만 걷는다", () => {
      const onClose = jest.fn();
      const onCancelApplication = jest.fn();
      const schedule = createMockScheduleEvent({
        type: 'applied',
        applicationId: 'app-cancel-1',
      }) as unknown as ScheduleEvent;

      const { getByText, queryByText } = render(
        <ScheduleDetailModal
          schedule={schedule}
          visible={true}
          onClose={onClose}
          onCancelApplication={onCancelApplication}
        />
      );

      fireEvent.press(getByText('지원 취소'));
      fireEvent.press(getByText('아니오'));

      // 시트는 한 번도 닫히지 않았고, 상세(탭 콘텐츠)와 원래 버튼이 그대로 있다.
      expect(onClose).not.toHaveBeenCalled();
      expect(onCancelApplication).not.toHaveBeenCalled();
      expect(queryByText('아니오')).toBeNull();
      expect(getByText('info-tab')).toBeTruthy();
      expect(getByText('지원 취소')).toBeTruthy();
    });

    it("'예' 확정에서만 시트를 닫고 300ms 뒤 콜백한다 (iOS 중첩 Modal 회피 유지)", () => {
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
      fireEvent.press(getByText('지원 취소하기'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCancelApplication).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onCancelApplication).toHaveBeenCalledWith('app-cancel-1');
    });

    it('취소 요청: 동일 패턴', () => {
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
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.press(getByText('취소 요청하기'));
      expect(onClose).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onRequestCancellation).toHaveBeenCalledWith('app-req-1');
    });

    it('다중일 지원은 며칠치가 사라지는지 밝힌다', () => {
      const dates = ['2026-07-27', '2026-07-28', '2026-07-29'];
      const schedule = createMockScheduleEvent({
        type: 'applied',
        applicationId: 'app-multi',
        date: dates[0],
      }) as unknown as ScheduleEvent;

      const { getByText } = render(
        <ScheduleDetailModal
          schedule={schedule}
          visible={true}
          onClose={jest.fn()}
          onCancelApplication={jest.fn()}
          groupedSchedule={
            {
              dateRange: { start: dates[0], end: dates[2], dates, totalDays: 3 },
              originalEvents: [schedule],
            } as never
          }
        />
      );

      fireEvent.press(getByText('지원 취소'));

      expect(getByText('3일 지원 취소')).toBeTruthy();
    });

    it("'예' 더블탭에서도 콜백은 1회만 — closeSheetThen 재진입 가드는 유지된다", () => {
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

      fireEvent.press(getByText('지원 취소'));
      const confirmButton = getByText('지원 취소하기');
      fireEvent.press(confirmButton);
      fireEvent.press(confirmButton);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCancelApplication).toHaveBeenCalledTimes(1);
    });
  });

  // 예전엔 tabs 배열이 schedule.type 과 무관한 리터럴이라 3탭이 항상 떴다 —
  // 지원 중인 건에서 근무·정산 탭을 눌러도 안내문뿐이라 헛탭이 두 번씩 났다.
  describe('상태별 탭 가시성', () => {
    const renderFor = (type: ScheduleEvent['type']) =>
      render(
        <ScheduleDetailModal
          schedule={createMockScheduleEvent({ type }) as unknown as ScheduleEvent}
          visible={true}
          onClose={jest.fn()}
        />
      );

    it('지원 중이면 정보 하나만 — 탭바 자체를 띄우지 않는다', () => {
      const { getByText, queryByText } = renderFor('applied');

      expect(getByText('info-tab')).toBeTruthy();
      expect(queryByText('work-tab')).toBeNull();
      expect(queryByText('settlement-tab')).toBeNull();
      // 탭이 하나뿐이면 탭바는 누를 곳 없는 장식이다.
      expect(queryByText('근무')).toBeNull();
      expect(queryByText('정산')).toBeNull();
      expect(queryByText('정보')).toBeNull();
    });

    it('취소도 정보 단일이다', () => {
      const { getByText, queryByText } = renderFor('cancelled');

      expect(getByText('info-tab')).toBeTruthy();
      expect(queryByText('근무')).toBeNull();
      expect(queryByText('정산')).toBeNull();
    });

    it('확정이면 정보+근무 — 아직 정산할 것이 없다', () => {
      const { getByText, queryByText } = renderFor('confirmed');

      expect(getByText('정보')).toBeTruthy();
      expect(getByText('근무')).toBeTruthy();
      expect(queryByText('정산')).toBeNull();
    });

    it('완료면 3탭 전부', () => {
      const { getByText } = renderFor('completed');

      expect(getByText('정보')).toBeTruthy();
      expect(getByText('근무')).toBeTruthy();
      expect(getByText('정산')).toBeTruthy();
    });

    it('노쇼도 3탭 — 근무=사유·이의 제기, 정산=확정 0원 여부를 각자 말한다', () => {
      const { getByText } = renderFor('no_show');

      expect(getByText('정보')).toBeTruthy();
      expect(getByText('근무')).toBeTruthy();
      expect(getByText('정산')).toBeTruthy();
    });

    it('보던 탭이 사라지면 첫 유효 탭으로 떨어진다', () => {
      const { getByText, queryByText, rerender } = renderFor('completed');

      fireEvent.press(getByText('정산'));
      expect(getByText('settlement-tab')).toBeTruthy();

      // 그룹 모드에서 날짜를 옮기면 같은 모달이 다른 상태의 건을 그린다.
      rerender(
        <ScheduleDetailModal
          schedule={createMockScheduleEvent({ type: 'applied' }) as unknown as ScheduleEvent}
          visible={true}
          onClose={jest.fn()}
        />
      );

      expect(queryByText('settlement-tab')).toBeNull();
      expect(getByText('info-tab')).toBeTruthy();
    });
  });
});
