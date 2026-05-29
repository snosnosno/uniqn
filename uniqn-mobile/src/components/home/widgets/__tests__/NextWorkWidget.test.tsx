import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NextWorkWidget } from '../NextWorkWidget';

import { useUpcomingSchedules } from '@/hooks/useSchedules';

jest.mock('@/components/home/DashboardWidgetShell', () => ({
  DashboardWidgetShell: ({
    children,
    title,
    isLoading,
    emptyState,
    error,
    onRetry,
  }: Record<string, unknown>) => {
    const { View, Text, Pressable } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    if (isLoading) return <View testID="loading" />;
    if (error && !children)
      return (
        <View>
          <Text>불러오지 못했습니다</Text>
          <Pressable testID="retry" onPress={onRetry as () => void}>
            <Text>다시 시도</Text>
          </Pressable>
        </View>
      );
    if (emptyState && !children)
      return <Text testID="empty-state">{(emptyState as { message: string }).message}</Text>;
    return (
      <View>
        <Text>{title as string}</Text>
        {children as React.ReactNode}
      </View>
    );
  },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/hooks/useSchedules', () => ({
  useUpcomingSchedules: jest.fn(),
}));

const mockUseUpcomingSchedules = useUpcomingSchedules as jest.MockedFunction<
  typeof useUpcomingSchedules
>;

const makeSchedule = (overrides = {}) => ({
  id: 'sched-1',
  date: '2099-12-31',
  startTime: null,
  endTime: null,
  location: '강남 홀덤펍',
  jobPostingName: '딜러 공고',
  role: 'dealer',
  type: 'confirmed' as const,
  status: 'not_started' as const,
  jobPostingId: 'job-1',
  sourceCollection: 'workLogs' as const,
  sourceId: 'src-1',
  ...overrides,
});

describe('NextWorkWidget', () => {
  it('isLoading=true이면 로딩 상태를 표시한다', () => {
    mockUseUpcomingSchedules.mockReturnValue({
      schedules: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<NextWorkWidget />);

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('확정 스케줄이 있으면 D-N 배지를 표시한다', () => {
    mockUseUpcomingSchedules.mockReturnValue({
      schedules: [makeSchedule({ type: 'confirmed' })],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<NextWorkWidget />);

    // D-N 배지가 화면에 렌더링됨 (날짜가 먼 미래이므로 D-숫자 형태)
    const badgePattern = /D-\d+|D\+\d+|D-DAY/;
    expect(screen.getByText(badgePattern)).toBeTruthy();
  });

  it('confirmed 스케줄이 없으면 emptyState를 표시한다', () => {
    mockUseUpcomingSchedules.mockReturnValue({
      schedules: [makeSchedule({ type: 'applied' })],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<NextWorkWidget />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText(/예정된 근무가 없습니다/)).toBeTruthy();
  });

  it('에러 발생 시 에러 상태를 표시한다', () => {
    mockUseUpcomingSchedules.mockReturnValue({
      schedules: [],
      isLoading: false,
      error: new Error('network error'),
      refetch: jest.fn(),
    });

    render(<NextWorkWidget />);

    expect(screen.getByText('불러오지 못했습니다')).toBeTruthy();
  });
});
