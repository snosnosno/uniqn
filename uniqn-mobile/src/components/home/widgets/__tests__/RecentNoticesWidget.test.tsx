import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecentNoticesWidget } from '../RecentNoticesWidget';

import { usePublishedAnnouncements } from '@/hooks/useAnnouncement';
import type { Announcement } from '@/types/announcement';

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

jest.mock('@/hooks/useAnnouncement', () => ({
  usePublishedAnnouncements: jest.fn(),
}));

const mockUsePublishedAnnouncements = usePublishedAnnouncements as jest.MockedFunction<
  typeof usePublishedAnnouncements
>;

const makeNotice = (id: string, title: string): Announcement => ({
  id,
  title,
  content: '공지 내용',
  category: 'notice',
  status: 'published',
  priority: 0,
  isPinned: false,
  targetAudience: { type: 'all' },
  authorId: 'author-1',
  authorName: '관리자',
  viewCount: 0,
  publishedAt: new Date('2026-04-01'),
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
});

const makeQueryResult = (overrides: Partial<ReturnType<typeof usePublishedAnnouncements>>) =>
  ({
    data: undefined,
    isLoading: false,
    isFetchingNextPage: false,
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    ...overrides,
  }) as unknown as ReturnType<typeof usePublishedAnnouncements>;

describe('RecentNoticesWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 중이면 로딩 상태를 표시한다', () => {
    mockUsePublishedAnnouncements.mockReturnValue(makeQueryResult({ isLoading: true }));

    render(<RecentNoticesWidget />);

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('공지 최대 3건의 제목을 표시한다', () => {
    mockUsePublishedAnnouncements.mockReturnValue(
      makeQueryResult({
        data: {
          pages: [
            {
              announcements: [
                makeNotice('n1', '4월 운영 공지'),
                makeNotice('n2', '홀덤펍 안전 수칙'),
                makeNotice('n3', '신규 기능 업데이트'),
                makeNotice('n4', '네 번째 공지 — 보이면 안됨'),
              ],
              hasMore: false,
              lastDoc: null,
            },
          ],
          pageParams: [undefined],
        },
      })
    );

    render(<RecentNoticesWidget />);

    expect(screen.getByText('4월 운영 공지')).toBeTruthy();
    expect(screen.getByText('홀덤펍 안전 수칙')).toBeTruthy();
    expect(screen.getByText('신규 기능 업데이트')).toBeTruthy();
    expect(screen.queryByText('네 번째 공지 — 보이면 안됨')).toBeNull();
  });

  it('공지가 없으면 빈 상태를 표시한다', () => {
    mockUsePublishedAnnouncements.mockReturnValue(
      makeQueryResult({
        data: {
          pages: [{ announcements: [], hasMore: false, lastDoc: null }],
          pageParams: [undefined],
        },
      })
    );

    render(<RecentNoticesWidget />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText(/새 공지가 없습니다/)).toBeTruthy();
  });

  it('에러 시 에러 상태를 표시한다', () => {
    mockUsePublishedAnnouncements.mockReturnValue(
      makeQueryResult({ error: new Error('fetch failed') })
    );

    render(<RecentNoticesWidget />);

    expect(screen.getByText('불러오지 못했습니다')).toBeTruthy();
  });
});
