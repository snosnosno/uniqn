import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MonthSummaryWidget } from '../MonthSummaryWidget';

import { useScheduleStats } from '@/hooks/useSchedules';
import { usePendingReviews } from '@/hooks/useReviews';

jest.mock('@/components/home/DashboardWidgetShell', () => ({
  DashboardWidgetShell: ({
    children,
    title,
    isLoading,
    emptyState,
    error,
    partial,
    onRetry,
  }: Record<string, unknown>) => {
    const { View, Text, Pressable } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    if (isLoading) return <View testID="loading" />;
    if (error && !partial)
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
  useScheduleStats: jest.fn(),
}));

jest.mock('@/hooks/useReviews', () => ({
  usePendingReviews: jest.fn(),
}));

const mockUseScheduleStats = useScheduleStats as jest.MockedFunction<typeof useScheduleStats>;
const mockUsePendingReviews = usePendingReviews as jest.MockedFunction<typeof usePendingReviews>;

const defaultPendingReviews = {
  pendingReviews: [],
  pendingCount: 0,
  isLoading: false,
};

describe('MonthSummaryWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scheduleStats 로딩 중이면 로딩 상태를 표시한다', () => {
    mockUseScheduleStats.mockReturnValue({
      stats: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    mockUsePendingReviews.mockReturnValue({
      ...defaultPendingReviews,
      isLoading: false,
    });

    render(<MonthSummaryWidget />);

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('확정 근무 수, 수익, 미작성 리뷰 수를 표시한다', () => {
    mockUseScheduleStats.mockReturnValue({
      stats: {
        confirmedSchedules: 5,
        thisMonthEarnings: 300000,
        totalSchedules: 5,
        completedSchedules: 0,
        upcomingSchedules: 5,
        totalEarnings: 300000,
        hoursWorked: 0,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUsePendingReviews.mockReturnValue({
      pendingReviews: [],
      pendingCount: 3,
      isLoading: false,
    });

    render(<MonthSummaryWidget />);

    expect(screen.getByText(/5일/)).toBeTruthy();
    expect(screen.getByText(/300,000/)).toBeTruthy();
    expect(screen.getByText(/3건/)).toBeTruthy();
  });

  it('stats가 undefined이고 로딩이 끝났으면 빈 상태를 표시한다', () => {
    mockUseScheduleStats.mockReturnValue({
      stats: undefined,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUsePendingReviews.mockReturnValue({
      ...defaultPendingReviews,
    });

    render(<MonthSummaryWidget />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText(/이번 달 근무 기록이 없습니다/)).toBeTruthy();
  });

  it('pendingReviews 로딩 중이면 partial=true이고 리뷰 수를 —으로 표시한다', () => {
    mockUseScheduleStats.mockReturnValue({
      stats: {
        confirmedSchedules: 2,
        thisMonthEarnings: 120000,
        totalSchedules: 2,
        completedSchedules: 0,
        upcomingSchedules: 2,
        totalEarnings: 120000,
        hoursWorked: 0,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUsePendingReviews.mockReturnValue({
      pendingReviews: [],
      pendingCount: 0,
      isLoading: true,
    });

    render(<MonthSummaryWidget />);

    // scheduleStats는 있으므로 에러 UI가 아닌 콘텐츠가 보여야 함 (partial=true)
    expect(screen.queryByText('불러오지 못했습니다')).toBeNull();
    // 리뷰 수는 — 으로 표시
    expect(screen.getByText(/—/)).toBeTruthy();
  });
});
