/**
 * EmployerReviewPrompt — 내 공고 탭 평가 안내 (UX 감사 H)
 *
 * 구인자 몫 평가 대기만 세고, 0건이면 그리지 않으며, 누르면 평가 허브로 간다.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { EmployerReviewPrompt } from '../EmployerReviewPrompt';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

let mockPendingReviews: { reviewerType: 'employer' | 'staff' }[] = [];
jest.mock('@/hooks/useReviews', () => ({
  usePendingReviews: () => ({ pendingReviews: mockPendingReviews }),
}));

describe('EmployerReviewPrompt', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('구인자 몫 평가만 센다 — 스태프로 일한 근무 평가는 스케줄 탭 몫이다', () => {
    mockPendingReviews = [
      { reviewerType: 'employer' },
      { reviewerType: 'employer' },
      { reviewerType: 'staff' },
    ];
    const { getByText } = render(<EmployerReviewPrompt />);
    expect(getByText('작성할 평가가 2건 있어요')).toBeTruthy();
  });

  it('구인자 몫이 0건이면 렌더하지 않는다', () => {
    mockPendingReviews = [{ reviewerType: 'staff' }];
    const { toJSON } = render(<EmployerReviewPrompt />);
    expect(toJSON()).toBeNull();
  });

  it('누르면 평가 허브로 이동한다', () => {
    mockPendingReviews = [{ reviewerType: 'employer' }];
    const { getByLabelText } = render(<EmployerReviewPrompt />);
    fireEvent.press(getByLabelText('미작성 평가 1건'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/reviews/history');
  });
});
