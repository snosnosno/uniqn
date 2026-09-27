import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FixedPostingExpiryCard } from '../FixedPostingExpiryCard';
import { describeFixedExpiry } from '@/domains/job-posting/fixedExpiry';

const NOW = new Date('2026-09-27T05:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function expiryIn(hours: number) {
  const info = describeFixedExpiry(new Date(NOW.getTime() + hours * HOUR), NOW);
  if (!info) throw new Error('fixture');
  return info;
}

describe('FixedPostingExpiryCard', () => {
  it('남은 일수와 [7일 연장] 버튼을 보여 주고, 누르면 연장을 부른다', () => {
    const onExtend = jest.fn();
    const { getByText, getByTestId } = render(
      <FixedPostingExpiryCard expiry={expiryIn(49)} onExtend={onExtend} isExtending={false} />
    );

    expect(getByText(/3일 남음/)).toBeTruthy();
    fireEvent.press(getByTestId('fixed-posting-extend-button'));
    expect(onExtend).toHaveBeenCalledTimes(1);
  });

  it('24시간 안이면 임박 문구로 바뀐다', () => {
    const { getByText } = render(
      <FixedPostingExpiryCard expiry={expiryIn(5)} onExtend={jest.fn()} isExtending={false} />
    );

    expect(getByText(/오늘·내일 마감/)).toBeTruthy();
  });

  it('만료가 지났는데 아직 게시 중이면 연장을 권한다', () => {
    const onExtend = jest.fn();
    const { getByText, getByTestId } = render(
      <FixedPostingExpiryCard expiry={expiryIn(-1)} onExtend={onExtend} isExtending={false} />
    );

    expect(getByText(/게시 기간이 지났어요/)).toBeTruthy();
    fireEvent.press(getByTestId('fixed-posting-extend-button'));
    expect(onExtend).toHaveBeenCalledTimes(1);
  });
});
