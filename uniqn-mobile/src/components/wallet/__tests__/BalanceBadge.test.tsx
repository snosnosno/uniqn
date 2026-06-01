import React from 'react';
import { render } from '@testing-library/react-native';
import { BalanceBadge } from '@/components/wallet/BalanceBadge';

describe('BalanceBadge', () => {
  it('하트·다이아 잔액을 표시한다', () => {
    const { getByText } = render(<BalanceBadge heartBalance={12} diamondBalance={5} />);
    expect(getByText('12')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('만료 임박 요약이 있으면 inline 표시한다', () => {
    const { getByText } = render(
      <BalanceBadge
        heartBalance={12}
        diamondBalance={0}
        expiring={{ totalAmount: 3, daysUntilExpiry: 2 }}
      />
    );
    expect(getByText(/3/)).toBeTruthy();
    expect(getByText(/D-2/)).toBeTruthy();
  });

  it('만료 요약이 없으면 만료 텍스트를 렌더하지 않는다', () => {
    const { queryByText } = render(
      <BalanceBadge heartBalance={12} diamondBalance={0} expiring={null} />
    );
    expect(queryByText(/만료/)).toBeNull();
  });

  it('isLoading이면 잔액 대신 플레이스홀더(—)를 표시한다', () => {
    const { getAllByText } = render(<BalanceBadge heartBalance={0} diamondBalance={0} isLoading />);
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
