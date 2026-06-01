// src/components/wallet/__tests__/PaywallModal.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaywallModal } from '../PaywallModal';

describe('PaywallModal', () => {
  it('비용/잔액/부족분을 표시한다', () => {
    const { getByText } = render(
      <PaywallModal
        visible
        cost={10}
        currencyHint="diamond"
        heartBalance={3}
        diamondBalance={2}
        onClose={jest.fn()}
        onCharge={jest.fn()}
      />
    );
    expect(getByText(/잔액이 부족/)).toBeTruthy();
  });

  it('충전하기 버튼이 onCharge를 호출한다', () => {
    const onCharge = jest.fn();
    const { getByTestId } = render(
      <PaywallModal
        visible
        cost={10}
        currencyHint="diamond"
        heartBalance={0}
        diamondBalance={0}
        onClose={jest.fn()}
        onCharge={onCharge}
      />
    );
    fireEvent.press(getByTestId('paywall-charge'));
    expect(onCharge).toHaveBeenCalledTimes(1);
  });

  it('닫기 버튼이 onClose를 호출한다', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <PaywallModal
        visible
        cost={10}
        currencyHint="diamond"
        heartBalance={0}
        diamondBalance={0}
        onClose={onClose}
        onCharge={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('paywall-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('visible=false면 내용 미렌더', () => {
    const { queryByText } = render(
      <PaywallModal
        visible={false}
        cost={10}
        currencyHint="diamond"
        heartBalance={0}
        diamondBalance={0}
        onClose={jest.fn()}
        onCharge={jest.fn()}
      />
    );
    expect(queryByText(/잔액이 부족/)).toBeNull();
  });
});
