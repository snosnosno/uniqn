import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WeeklyStaffWidget } from '../WeeklyStaffWidget';

import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

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

jest.mock('@/hooks/useJobManagement', () => ({
  useMyJobPostings: jest.fn(),
}));

jest.mock('@/hooks/useConfirmedStaff', () => ({
  useConfirmedStaff: jest.fn(),
}));

const mockUseMyJobPostings = useMyJobPostings as jest.MockedFunction<typeof useMyJobPostings>;
const mockUseConfirmedStaff = useConfirmedStaff as jest.MockedFunction<typeof useConfirmedStaff>;

const makeStaffReturn = (staff: { date: string }[]) => ({
  staff: staff.map((s, i) => ({
    id: `staff-${i}`,
    staffId: `staff-id-${i}`,
    staffName: `스태프${i}`,
    role: 'dealer',
    date: s.date,
    status: 'scheduled' as const,
  })),
  grouped: [],
  stats: {
    total: staff.length,
    scheduled: staff.length,
    checkedIn: 0,
    checkedOut: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    settled: 0,
  },
  isLoading: false,
  error: null,
  refresh: jest.fn(),
  isRefreshing: false,
  changeRole: jest.fn(),
  updateWorkTime: jest.fn(),
  removeStaff: jest.fn(),
  setNoShow: jest.fn(),
  changeStatus: jest.fn(),
  addStaff: jest.fn(),
  isChangingRole: false,
  isUpdatingTime: false,
  isRemoving: false,
  isSettingNoShow: false,
  isChangingStatus: false,
  isAddingStaff: false,
});

describe('WeeklyStaffWidget', () => {
  it('isLoading=true이면 로딩 상태를 표시한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as unknown as ReturnType<typeof useMyJobPostings>);

    mockUseConfirmedStaff.mockReturnValue(makeStaffReturn([]));

    render(<WeeklyStaffWidget />, { wrapper: createWrapper() });

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('active 공고가 없으면 빈 상태를 표시한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
    } as unknown as ReturnType<typeof useMyJobPostings>);

    mockUseConfirmedStaff.mockReturnValue(makeStaffReturn([]));

    render(<WeeklyStaffWidget />, { wrapper: createWrapper() });

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText(/이번 주 스케줄된 공고가 없습니다/)).toBeTruthy();
  });
});
