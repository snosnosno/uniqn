/**
 * UNIQN Mobile - ReviewHubScreen Test (평점관리 통합 허브)
 * TDD: RED → GREEN
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ReviewHistoryScreen from '../history';
import type { Review } from '@/types/review';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ profile: { uid: 'user-1' } }),
}));

jest.mock('@/hooks/useReviews', () => ({
  usePendingReviews: jest.fn(),
  useReceivedReviews: jest.fn(),
  useGivenReviews: jest.fn(),
  useBubbleScore: jest.fn(),
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

// ============================================================================
// 헬퍼
// ============================================================================

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    workLogId: 'wl-default',
    jobPostingId: 'jp-default',
    jobPostingTitle: '기본공고',
    workDate: '2026-06-01',
    reviewerId: 'reviewer-id',
    reviewerName: '리뷰어',
    reviewerType: 'employer',
    revieweeId: 'reviewee-id',
    revieweeName: '피평가자',
    sentiment: 'positive',
    tags: [],
    bubbleScoreChange: 1,
    createdAt: new Date('2026-06-01'),
    ...overrides,
  };
}

function emptyPaginatedData() {
  return {
    data: undefined,
    isLoading: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}

type HookMocks = {
  usePendingReviews: jest.Mock;
  useReceivedReviews: jest.Mock;
  useGivenReviews: jest.Mock;
  useBubbleScore: jest.Mock;
};

function getHookMocks(): HookMocks {
  return jest.requireMock('@/hooks/useReviews') as HookMocks;
}

function getRouter(): { push: jest.Mock } {
  return (jest.requireMock('expo-router') as { router: { push: jest.Mock } }).router;
}

// ============================================================================
// 기존 테스트: 탭 렌더링
// ============================================================================

describe('평점관리 허브', () => {
  beforeEach(() => {
    const { usePendingReviews, useReceivedReviews, useGivenReviews, useBubbleScore } =
      getHookMocks();

    usePendingReviews.mockReturnValue({
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
    });
    useReceivedReviews.mockReturnValue(emptyPaginatedData());
    useGivenReviews.mockReturnValue(emptyPaginatedData());
    useBubbleScore.mockReturnValue(null);
    getRouter().push.mockClear();
  });

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

  it('미작성 목록 상단에 작성 기한(7일) 안내를 표시한다 (QW7)', () => {
    const { getByText } = render(<ReviewHistoryScreen />);
    expect(getByText(/7일까지만 작성할 수 있어요/)).toBeTruthy();
  });

  it('미작성 빈 상태에 기간 만료 안내를 표시한다 (QW7)', () => {
    getHookMocks().usePendingReviews.mockReturnValue({
      pendingReviews: [],
      pendingCount: 0,
      isLoading: false,
    });
    const { getByText } = render(<ReviewHistoryScreen />);
    fireEvent.press(getByText('미작성'));
    expect(getByText(/작성 기간\(7일\)이 지난 평가는 자동으로 사라져요/)).toBeTruthy();
  });
});

// ============================================================================
// 신규 테스트: 받은/작성한 탭 카드 탭 → 블라인드 상세 진입
// ============================================================================

describe('받은/작성한 탭 카드 탭 → 블라인드 상세 진입', () => {
  // received: 상대방(staff)이 나(employer)를 평가한 리뷰
  const receivedReview = makeReview({
    workLogId: 'wl-recv',
    jobPostingId: 'jp-recv',
    jobPostingTitle: '받은공고',
    workDate: '2026-06-10',
    reviewerId: 'opponent-id', // 평가자(상대방)
    reviewerName: '상대방이름',
    reviewerType: 'staff', // 상대방 타입
    revieweeId: 'me-user-1', // 피평가자=나
    revieweeName: '내이름',
  });

  // given: 내가(employer) 상대방(staff)을 평가한 리뷰
  const givenReview = makeReview({
    workLogId: 'wl-given',
    jobPostingId: 'jp-given',
    jobPostingTitle: '작성공고',
    workDate: '2026-06-11',
    reviewerId: 'me-user-1',
    reviewerName: '내이름',
    reviewerType: 'employer', // 내 타입
    revieweeId: 'staff-id', // 피평가자
    revieweeName: '스태프이름',
  });

  beforeEach(() => {
    const { usePendingReviews, useReceivedReviews, useGivenReviews, useBubbleScore } =
      getHookMocks();

    // pendingCount=0 → 기본 탭이 'received'
    usePendingReviews.mockReturnValue({
      pendingReviews: [],
      pendingCount: 0,
      isLoading: false,
    });
    useReceivedReviews.mockReturnValue({
      data: { pages: [{ items: [receivedReview] }] },
      isLoading: false,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    useGivenReviews.mockReturnValue({
      data: { pages: [{ items: [givenReview] }] },
      isLoading: false,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    useBubbleScore.mockReturnValue(null);
    getRouter().push.mockClear();
  });

  it('received 탭에서 카드를 탭하면 revieweeId=상대방(review.reviewerId), reviewerType 미포함으로 상세 진입', () => {
    const { getByTestId } = render(<ReviewHistoryScreen />);
    const testId = `review-item-${receivedReview.workLogId}_${receivedReview.reviewerType}`;
    fireEvent.press(getByTestId(testId));

    const router = getRouter();
    expect(router.push).toHaveBeenCalledTimes(1);
    const callArg = router.push.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(callArg.pathname).toBe('/(app)/reviews/[workLogId]');
    expect(callArg.params.workLogId).toBe(receivedReview.workLogId);
    expect(callArg.params.revieweeId).toBe(receivedReview.reviewerId); // 상대방 ID
    expect(callArg.params.jobPostingId).toBe(receivedReview.jobPostingId);
    expect(callArg.params).not.toHaveProperty('reviewerType'); // 내 타입은 상세화면이 profile.role에서 파생
  });

  it('given 탭에서 카드를 탭하면 revieweeId=review.revieweeId, reviewerType=review.reviewerType 포함으로 상세 진입', () => {
    const { getByText, getByTestId } = render(<ReviewHistoryScreen />);

    // '작성한 평가' 탭으로 전환
    fireEvent.press(getByText('작성한 평가'));

    const testId = `review-item-${givenReview.workLogId}_${givenReview.reviewerType}`;
    fireEvent.press(getByTestId(testId));

    const router = getRouter();
    expect(router.push).toHaveBeenCalledTimes(1);
    const callArg = router.push.mock.calls[0][0] as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(callArg.pathname).toBe('/(app)/reviews/[workLogId]');
    expect(callArg.params.workLogId).toBe(givenReview.workLogId);
    expect(callArg.params.revieweeId).toBe(givenReview.revieweeId);
    expect(callArg.params.reviewerType).toBe(givenReview.reviewerType);
    expect(callArg.params.jobPostingId).toBe(givenReview.jobPostingId);
  });
});
