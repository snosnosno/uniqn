import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ReviewDetailScreen from '../[workLogId]';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRefetch = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useReviews', () => ({
  useWorkLogReviews: jest.fn(),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    profile: {
      role: 'staff',
    },
  }),
}));

jest.mock('@/components/review/ReviewCard', () => 'ReviewCard');
jest.mock('@/components/review/ReviewBlindMessage', () => 'ReviewBlindMessage');

jest.mock('@/components/headers', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    StackHeader: ({ title }: { title: string }) => (
      <ReactNative.View>
        <ReactNative.Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" />
        <ReactNative.Text>{title}</ReactNative.Text>
      </ReactNative.View>
    ),
  };
});

describe('ReviewDetailScreen', () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router') as {
    useLocalSearchParams: jest.Mock;
  };
  const { useWorkLogReviews } = jest.requireMock('@/hooks/useReviews') as {
    useWorkLogReviews: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a safe fallback state when workLogId is missing', () => {
    useLocalSearchParams.mockReturnValue({
      reviewerType: 'staff',
    });
    useWorkLogReviews.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { getByText } = render(<ReviewDetailScreen />);

    fireEvent.press(getByText('히스토리로 이동'));

    expect(mockReplace).toHaveBeenCalledWith('/(app)/reviews/history');
  });

  it('retries the review query when loading fails', () => {
    useLocalSearchParams.mockReturnValue({
      workLogId: 'worklog-1',
      reviewerType: 'staff',
      revieweeId: 'user-1',
      revieweeName: 'Alice',
      jobPostingId: 'job-1',
      jobPostingTitle: 'Night Shift',
      workDate: '2025-01-15',
    });
    useWorkLogReviews.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: mockRefetch,
    });

    const { getByText } = render(<ReviewDetailScreen />);

    fireEvent.press(getByText('다시 시도'));

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('uses review data fallbacks when route metadata is missing', () => {
    useLocalSearchParams.mockReturnValue({
      workLogId: 'worklog-2',
      reviewerType: 'staff',
      revieweeId: 'user-2',
      revieweeName: '',
      jobPostingId: 'job-2',
      jobPostingTitle: '',
      workDate: '2025-01-16',
    });
    useWorkLogReviews.mockReturnValue({
      data: {
        myReview: null,
        opponentReview: {
          reviewerName: 'Owner Kim',
          jobPostingTitle: 'Night Shift',
        },
        canViewOpponent: false,
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { getByText } = render(<ReviewDetailScreen />);

    fireEvent.press(getByText('리뷰 작성하기'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/reviews/write',
      params: expect.objectContaining({
        revieweeName: 'Owner Kim',
        jobPostingTitle: 'Night Shift',
      }),
    });
  });
});
