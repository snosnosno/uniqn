import React from 'react';
import { render } from '@testing-library/react-native';
import { ScheduleDetailSheet } from '../ScheduleDetailSheet';
import type { ScheduleEvent } from '@/types';

// 네이티브 의존(Modal/아이콘)·조회 훅은 렌더 대상이 아니므로 최소 목킹한다.
// WorkTimeDisplay(SSOT)는 목킹하지 않는다 — "익일" 판정을 실제 로직으로 검증해야 한다.
jest.mock('@/components/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
    Badge: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Pressable onPress={onPress}>{children}</Pressable>
    ),
  };
});

jest.mock('@/components/icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const MockIcon = () => <View />;

  return {
    CalendarIcon: MockIcon,
    ClockIcon: MockIcon,
    MapIcon: MockIcon,
    BriefcaseIcon: MockIcon,
    CurrencyDollarIcon: MockIcon,
    XMarkIcon: MockIcon,
    QrCodeIcon: MockIcon,
  };
});

jest.mock('@/hooks/useWorkLogs', () => ({
  useCurrentWorkStatus: () => ({ isWorking: false }),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

describe('ScheduleDetailSheet — 심야(익일) 시간 표시', () => {
  it('자정을 넘기는 18:00~02:00 근무는 종료 시각에 "익일" 라벨을 병기한다', () => {
    // 심야 운영: 시작 18:00, 종료는 다음 날 02:00.
    // ScheduleEvent.startTime/endTime 은 parseTimeSlotToDate 로 달력 날짜가 이미 반영된 Date이며,
    // timeSlot/date 도 함께 전달해 WorkTimeDisplay(SSOT)가 익일 여부를 재계산하도록 한다.
    const schedule = {
      id: 'sched-overnight-1',
      type: 'confirmed',
      status: 'not_started',
      date: '2026-07-17',
      startTime: new Date(2026, 6, 17, 18, 0, 0),
      endTime: new Date(2026, 6, 18, 2, 0, 0),
      timeSlot: '18:00~02:00',
      jobPostingId: 'jp-overnight',
      jobPostingName: '심야 홀덤펍',
      location: '',
      role: '딜러',
      sourceCollection: 'workLogs',
      sourceId: 'sched-overnight-1',
    } as unknown as ScheduleEvent;

    const { getByText } = render(
      <ScheduleDetailSheet schedule={schedule} visible={true} onClose={jest.fn()} />
    );

    expect(getByText('18:00 – 익일 02:00')).toBeTruthy();
  });
});
