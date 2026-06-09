// src/components/wallet/__tests__/PurchaseSheet.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PurchaseSheet } from '../PurchaseSheet';
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockRouterPush(...a) },
}));

jest.mock('@/hooks/usePurchaseDiamonds', () => ({
  usePurchaseDiamonds: () => ({ status: 'idle', purchase: jest.fn(), reset: jest.fn() }),
}));

const mockRestoreFn = jest.fn();
let mockRestoring = false;
jest.mock('@/hooks/useRestorePurchases', () => ({
  useRestorePurchases: () => ({ restoring: mockRestoring, restore: mockRestoreFn }),
}));
jest.mock('@/services/purchases', () => ({
  purchasesService: {
    isAvailable: () => true,
    getDiamondPackages: jest.fn(() => Promise.resolve([])),
  },
}));
jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: {
    listProducts: jest.fn(() =>
      Promise.resolve([
        {
          product_id: 'uniqn_diamonds_3000',
          diamonds: 10,
          bonus_diamonds: 0,
          price_krw: 3000,
          display_order: 2,
          active: true,
        },
      ])
    ),
  },
}));

it('닫힌 상태면 시트 내용 미렌더', () => {
  usePurchaseSheetStore.setState({ isOpen: false });
  const { queryByText } = render(<PurchaseSheet />);
  expect(queryByText(/다이아 충전/)).toBeNull();
});

it('열린 상태면 제목 렌더', () => {
  usePurchaseSheetStore.setState({ isOpen: true });
  const { getByText } = render(<PurchaseSheet />);
  expect(getByText(/다이아 충전/)).toBeTruthy();
});

describe('IAP 심사 footer', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
    mockRestoreFn.mockClear();
    mockRestoring = false;
    usePurchaseSheetStore.setState({ isOpen: true });
  });

  it('약관·개인정보처리방침·구매 복원이 렌더된다', () => {
    const { getByText } = render(<PurchaseSheet />);
    expect(getByText('이용약관')).toBeTruthy();
    expect(getByText('개인정보처리방침')).toBeTruthy();
    expect(getByText('구매 복원')).toBeTruthy();
  });

  it('이용약관 탭 → 시트 닫고 약관 화면으로 이동', () => {
    const { getByText } = render(<PurchaseSheet />);
    fireEvent.press(getByText('이용약관'));
    expect(usePurchaseSheetStore.getState().isOpen).toBe(false);
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/settings/terms');
  });

  it('개인정보처리방침 탭 → 시트 닫고 개인정보 화면으로 이동', () => {
    const { getByText } = render(<PurchaseSheet />);
    fireEvent.press(getByText('개인정보처리방침'));
    expect(usePurchaseSheetStore.getState().isOpen).toBe(false);
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/settings/privacy');
  });

  it('구매 복원 탭 → restore 호출', () => {
    const { getByText } = render(<PurchaseSheet />);
    fireEvent.press(getByText('구매 복원'));
    expect(mockRestoreFn).toHaveBeenCalledTimes(1);
  });

  it('복원 진행 중에는 약관 이동·시트 닫기 차단(가드 대칭)', () => {
    mockRestoring = true;
    const { getByText } = render(<PurchaseSheet />);
    fireEvent.press(getByText('이용약관'));
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(usePurchaseSheetStore.getState().isOpen).toBe(true);
  });
});
