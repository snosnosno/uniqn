import React from 'react';
import * as mockReactNative from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import ReviewWriteScreen from '../write';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockMutate = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useReviews', () => ({
  useCreateReview: () => ({
    mutate: (...args: unknown[]) => mockMutate(...args),
    isPending: false,
  }),
}));

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

jest.mock('@/components/review/ReviewForm', () => {
  return function MockReviewForm(props: {
    onSubmit: (values: { sentiment: 'positive'; tags: ['punctual']; comment: '' }) => void;
    revieweeName: string;
  }) {
    return (
      <mockReactNative.Pressable
        accessibilityRole="button"
        accessibilityLabel="mock-review-form-submit"
        onPress={() =>
          props.onSubmit({
            sentiment: 'positive',
            tags: ['punctual'],
            comment: '',
          })
        }
      >
        <mockReactNative.Text>{props.revieweeName}</mockReactNative.Text>
      </mockReactNative.Pressable>
    );
  };
});

describe('ReviewWriteScreen', () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router') as {
    useLocalSearchParams: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows review creation when jobPostingTitle is missing and uses the default title', () => {
    useLocalSearchParams.mockReturnValue({
      workLogId: 'worklog-1',
      revieweeId: 'user-1',
      revieweeName: 'Alice',
      reviewerType: 'employer',
      jobPostingId: 'job-1',
      workDate: '2025-01-15',
    });

    const { getByLabelText, getByText, queryByText } = render(<ReviewWriteScreen />);

    expect(getByText('Alice')).toBeTruthy();
    expect(queryByText('히스토리로 이동')).toBeNull();

    fireEvent.press(getByLabelText('mock-review-form-submit'));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        jobPostingTitle: '공고',
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );
  });

  it('uses a role-based fallback name when revieweeName is missing', () => {
    useLocalSearchParams.mockReturnValue({
      workLogId: 'worklog-2',
      revieweeId: 'user-2',
      reviewerType: 'employer',
      jobPostingId: 'job-2',
      jobPostingTitle: 'Night Shift',
      workDate: '2025-01-16',
    });

    const { getByLabelText, getByText, queryByText } = render(<ReviewWriteScreen />);

    expect(getByText('스태프')).toBeTruthy();
    expect(queryByText('히스토리로 이동')).toBeNull();

    fireEvent.press(getByLabelText('mock-review-form-submit'));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        revieweeName: '스태프',
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );
  });
});
