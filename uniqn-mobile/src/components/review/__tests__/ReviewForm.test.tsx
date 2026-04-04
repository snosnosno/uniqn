import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ReviewForm from '../ReviewForm';
import { SENTIMENT_LABELS, getTagsForReviewerType } from '@/types/review';

jest.mock('@/components/ui/Modal', () => ({
  ConfirmModal: () => null,
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

describe('ReviewForm', () => {
  const employerTags = getTagsForReviewerType('employer');
  const positiveLabel = employerTags.find((tag) => tag.key === 'punctual')?.label ?? 'punctual';
  const negativeLabel = employerTags.find((tag) => tag.key === 'late')?.label ?? 'late';

  it('drops incompatible tags when sentiment changes from neutral to positive', async () => {
    const { getByLabelText, getByText, queryByLabelText } = render(
      <ReviewForm reviewerType="employer" revieweeName="Alice" onSubmit={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByLabelText(SENTIMENT_LABELS.neutral));
    });

    await waitFor(() => {
      expect(getByLabelText(positiveLabel)).toBeTruthy();
      expect(getByLabelText(negativeLabel)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByLabelText(negativeLabel));
    });

    await waitFor(() => {
      expect(getByLabelText(negativeLabel).props.accessibilityState.checked).toBe(true);
    });

    await act(async () => {
      fireEvent.press(getByLabelText(SENTIMENT_LABELS.positive));
    });

    await waitFor(() => {
      expect(getByText('감정 변경에 맞지 않는 태그는 자동으로 해제되었어요.')).toBeTruthy();
      expect(getByLabelText(positiveLabel)).toBeTruthy();
      expect(queryByLabelText(negativeLabel)).toBeNull();
      expect(getByText('0/5개 선택됨 (최소 1개)')).toBeTruthy();
    });
  });
});
