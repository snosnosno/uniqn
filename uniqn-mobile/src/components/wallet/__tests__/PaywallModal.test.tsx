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

  it('하트로 결제 가능하면 diamond 힌트여도 부족분이 0이다 (EF-wallet-1 회귀)', () => {
    // 실제 차감 RPC는 currency_hint 무관하게 하트 우선 + 다이아 합산(8+5=13 ≥ 10).
    // 따라서 결제력 표시도 합산이어야 하고 부족분은 0 이어야 한다.
    const { getByText, queryByText } = render(
      <PaywallModal
        visible
        cost={10}
        currencyHint="diamond"
        heartBalance={8}
        diamondBalance={5}
        onClose={jest.fn()}
        onCharge={jest.fn()}
      />
    );
    expect(getByText('0💎')).toBeTruthy();
    expect(queryByText('5💎')).toBeNull();
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
