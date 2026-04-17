import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ApplicationStatusWidget } from '../ApplicationStatusWidget';

import { useApplications } from '@/hooks/useApplications';

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

jest.mock('@/hooks/useApplications', () => ({
  useApplications: jest.fn(),
}));

const mockUseApplications = useApplications as jest.MockedFunction<typeof useApplications>;

const makeApplication = (status: string, id = 'app-1') => ({
  id,
  status,
  jobPostingId: 'job-1',
  staffId: 'staff-1',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ApplicationStatusWidget', () => {
  it('isLoading=true이면 로딩 상태를 표시한다', () => {
    mockUseApplications.mockReturnValue({
      myApplications: [],
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useApplications>);

    render(<ApplicationStatusWidget />);

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('지원 현황 카운트를 정확히 표시한다', () => {
    mockUseApplications.mockReturnValue({
      myApplications: [
        makeApplication('applied', 'a1'),
        makeApplication('applied', 'a2'),
        makeApplication('confirmed', 'a3'),
        makeApplication('rejected', 'a4'),
        makeApplication('cancelled', 'a5'),
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useApplications>);

    render(<ApplicationStatusWidget />);

    // 대기중 2, 확정 1, 거절 1, 취소 1
    expect(screen.getByText('2')).toBeTruthy();
    // "1"이 확정·거절·취소 3개이므로 getAllByText 사용
    const ones = screen.getAllByText('1');
    expect(ones).toHaveLength(3);
  });

  it('지원 내역이 없으면 emptyState를 표시한다', () => {
    mockUseApplications.mockReturnValue({
      myApplications: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useApplications>);

    render(<ApplicationStatusWidget />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText(/아직 지원한 공고가 없습니다/)).toBeTruthy();
  });

  it('에러 발생 시 에러 상태를 표시한다', () => {
    mockUseApplications.mockReturnValue({
      myApplications: [],
      isLoading: false,
      error: new Error('fetch error'),
    } as unknown as ReturnType<typeof useApplications>);

    render(<ApplicationStatusWidget />);

    expect(screen.getByText('불러오지 못했습니다')).toBeTruthy();
  });
});
