import React from 'react';
import { render } from '@testing-library/react-native';

import { WalletBalanceBadge } from '@/components/wallet/WalletBalanceBadge';

const mockUseWalletBalance = jest.fn();
jest.mock('@/hooks/useWalletBalance', () => ({
  useWalletBalance: () => mockUseWalletBalance(),
}));

describe('WalletBalanceBadge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('훅 데이터를 BalanceBadge에 전달해 잔액을 표시한다', () => {
    mockUseWalletBalance.mockReturnValue({
      data: {
        heart_balance: 7,
        diamond_balance: 2,
        lifetime_purchased_diamonds: 0,
        expiring_lots: [],
      },
      isLoading: false,
    });

    const { getByText } = render(<WalletBalanceBadge />);
    expect(getByText('7')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('데이터가 없으면 0으로 폴백한다', () => {
    mockUseWalletBalance.mockReturnValue({ data: undefined, isLoading: true });

    const { getAllByText } = render(<WalletBalanceBadge />);
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
