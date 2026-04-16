import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CancellationWidget } from '../CancellationWidget';

import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useQueries } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

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

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueries: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockUseMyJobPostings = useMyJobPostings as jest.MockedFunction<typeof useMyJobPostings>;
const mockUseQueries = useQueries as jest.MockedFunction<typeof useQueries>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

const makePosting = (id: string) => ({
  id,
  status: 'active' as const,
  title: `공고 ${id}`,
  workDate: '2026-04-20',
  totalPositions: 3,
  filledPositions: 0,
  ownerId: 'owner-1',
  location: { address: '서울', latitude: 37.5, longitude: 127.0 },
  schedule: { kind: 'dated' as const, primaryDate: '2026-04-20', allDates: [], requirements: [] },
  roleCatalog: [],
  compensation: { mode: 'shared' as const },
  questions: { items: [] },
  schemaVersion: 3 as const,
});

const makeCancellationApp = (id: string) => ({
  id,
  applicantId: 'applicant-1',
  applicantName: '홍길동',
  jobPostingId: 'job-1',
  jobPostingDate: '2026-04-20',
  status: 'cancellation_requested' as const,
  assignments: [],
  cancellationRequest: {
    status: 'pending' as const,
    requestedAt: new Date(),
    reason: '개인 사정',
  },
});

describe('CancellationWidget', () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({ user: { uid: 'owner-1' } } as ReturnType<
      typeof useAuthStore
    >);
  });

  it('pending 취소 요청이 있으면 렌더한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: [makePosting('p1')],
      isLoading: false,
      error: null,
      isError: false,
    } as ReturnType<typeof useMyJobPostings>);

    mockUseQueries.mockReturnValue([
      { data: [makeCancellationApp('app-1')], isLoading: false, isError: false },
    ] as ReturnType<typeof useQueries>);

    render(<CancellationWidget />);

    expect(screen.getByText(/1건 대기 중/)).toBeTruthy();
  });

  it('pending 취소 요청이 0건이면 null을 반환한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: [makePosting('p1')],
      isLoading: false,
      error: null,
      isError: false,
    } as ReturnType<typeof useMyJobPostings>);

    mockUseQueries.mockReturnValue([{ data: [], isLoading: false, isError: false }] as ReturnType<
      typeof useQueries
    >);

    const { toJSON } = render(<CancellationWidget />);

    expect(toJSON()).toBeNull();
  });

  it('데이터 로딩 중이면 로딩 상태를 표시한다', () => {
    mockUseMyJobPostings.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    } as ReturnType<typeof useMyJobPostings>);

    mockUseQueries.mockReturnValue([] as ReturnType<typeof useQueries>);

    render(<CancellationWidget />);

    expect(screen.getByTestId('loading')).toBeTruthy();
  });
});
