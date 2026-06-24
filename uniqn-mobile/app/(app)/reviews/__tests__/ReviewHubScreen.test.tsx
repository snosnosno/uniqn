/**
 * UNIQN Mobile - ReviewHubScreen Test (평점관리 통합 허브)
 * TDD: RED → GREEN
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import ReviewHistoryScreen from '../history';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ profile: { uid: 'user-1' } }),
}));

jest.mock('@/hooks/useReviews', () => ({
  usePendingReviews: () => ({
    pendingReviews: [
      {
        workLogId: 'wl1',
        revieweeId: 'r1',
        revieweeName: '스태프A',
        reviewerType: 'employer',
        jobPostingId: 'jp1',
        jobPostingTitle: '공고A',
        workDate: '2026-06-01',
        location: '',
      },
    ],
    pendingCount: 2,
    isLoading: false,
  }),
  useReceivedReviews: () => ({
    reviews: [],
    isLoading: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useGivenReviews: () => ({
    reviews: [],
    isLoading: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useBubbleScore: () => null,
}));

jest.mock('@/components/review/ReviewCard', () => 'ReviewCard');
jest.mock('@/components/review/BubbleScoreBadge', () => 'BubbleScoreBadge');
jest.mock('@/components/review/PendingReviewCard', () => 'PendingReviewCard');

jest.mock('@/components/headers', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    StackHeader: ({ title }: { title: string }) => (
      <ReactNative.View>
        <ReactNative.Text>{title}</ReactNative.Text>
      </ReactNative.View>
    ),
  };
});

jest.mock('@shopify/flash-list', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    FlashList: ReactNative.FlatList,
  };
});

describe('평점관리 허브', () => {
  it('미작성/받은/작성한 3개 탭과 제목 "평점관리"를 렌더한다', () => {
    const { getByText } = render(<ReviewHistoryScreen />);
    expect(getByText('평점관리')).toBeTruthy();
    expect(getByText(/미작성/)).toBeTruthy();
    expect(getByText('받은 평가')).toBeTruthy();
    expect(getByText('작성한 평가')).toBeTruthy();
  });

  it('미작성 탭 라벨에 건수 배지(2)를 표시한다', () => {
    const { getByText } = render(<ReviewHistoryScreen />);
    expect(getByText(/미작성 2/)).toBeTruthy();
  });
});
