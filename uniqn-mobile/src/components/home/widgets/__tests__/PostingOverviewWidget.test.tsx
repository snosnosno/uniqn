import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PostingOverviewWidget } from '../PostingOverviewWidget';

import { useMyJobPostings } from '@/hooks/useJobManagement';

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

const mockUseMyJobPostings = useMyJobPostings as jest.MockedFunction<typeof useMyJobPostings>;

const makePosting = (status: string, id = 'posting-1') => ({
  id,
  status,
  title: `공고 ${id}`,
  workDate: '2026-04-20',
  totalPositions: 3,
  filledPositions: 1,
  ownerId: 'owner-1',
  location: { address: '서울', latitude: 37.5, longitude: 127.0 },
  schedule: { kind: 'dated' as const, primaryDate: '2026-04-20', allDates: [], requirements: [] },
  roleCatalog: [],
  compensation: { mode: 'shared' as const },
  questions: { items: [] },
  schemaVersion: 3 as const,
  stats: {
    totalApplicants: 2,
    activeApplicants: 1,
    confirmedApplicants: 1,
    cancellationPendingApplicants: 0,
    filledPositions: 1,
  },
});

describe('PostingOverviewWidget', () => {
  it('isLoading=true이면 로딩 상태를 표시한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as unknown as ReturnType<typeof useMyJobPostings>);

    render(<PostingOverviewWidget />);

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('모집중/마감 공고 카운트를 표시한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: [makePosting('active', 'p1'), makePosting('active', 'p2'), makePosting('closed', 'p3')],
      isLoading: false,
      error: null,
      isError: false,
    } as unknown as ReturnType<typeof useMyJobPostings>);

    render(<PostingOverviewWidget />);

    // hero 레이아웃: "공고 N건 모집중" + 보조 라인 "모집중 N · 마감 M"
    expect(screen.getByText(/공고 2건 모집중/)).toBeTruthy();
    expect(screen.getByText(/모집중 2 · 마감 1/)).toBeTruthy();
  });

  it('공고가 없으면 emptyState를 표시한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
    } as unknown as ReturnType<typeof useMyJobPostings>);

    render(<PostingOverviewWidget />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText(/진행 중인 공고가 없습니다/)).toBeTruthy();
  });
});
